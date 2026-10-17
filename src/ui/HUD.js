import { BUILDINGS, TIMING } from '../sim/config.js';
import { onPress } from './press.js';
import { summarizeWave } from '../sim/WaveManager.js';
import { frameToDataURL } from '../render/spriteBaker.js';
import { spriteKeys } from '../render/spriteCatalog.js';

const $ = (id) => document.getElementById(id);

const SIDE_NAMES = { north: 'North', east: 'East', south: 'South', west: 'West' };
const joinSides = (sides) => sides.map((s) => SIDE_NAMES[s]).join(' & ');

// Best value of each tower stat across all buildings, for the Codex's segmented stat bars.
const attacks = Object.values(BUILDINGS).map((d) => d.attack).filter(Boolean);
const STAT_MAX = {
  damage: Math.max(...attacks.map((a) => a.damage)),
  range: Math.max(...attacks.map((a) => a.range)),
  rate: Math.max(...attacks.map((a) => 1 / a.cooldown)),
};
const CHRONICLE_LENGTH = 6;

/** A small drawn icon for the Sell card: a stack of coins. */
function sellIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  for (const [x, y] of [[30, 66], [56, 70], [44, 50], [62, 44], [40, 30]]) {
    const g = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, 18);
    g.addColorStop(0, '#fff1a8');
    g.addColorStop(0.55, '#e2b347');
    g.addColorStop(1, '#8a6418');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, 17, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b4a10';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  return c.toDataURL('image/png');
}

/**
 * DOM overlay, styled after docs/reference/ui-style.jpg: framed Town Hall health and gold plaques, a wave
 * sign, tower cards with rendered portraits, cog buttons, the Battle Chronicle log, the Engineer's Codex
 * selection panel, toasts and dialogs.
 */
export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      gold: $('gold'),
      wave: $('wave'),
      hallBar: $('hall-bar'),
      hallHp: $('hall-hp'),
      phase: $('phase'),
      nextWave: $('next-wave'),
      startWave: $('start-wave'),
      speed: $('speed'),
      pause: $('pause'),
      buildbar: $('buildbar'),
      info: $('info'),
      toasts: $('toasts'),
      gameover: $('gameover'),
      gameoverStats: $('gameover-stats'),
      help: $('help'),
      confirm: $('confirm'),
      fps: $('fps'),
      confirmLabel: $('confirm-label'),
      buildTag: $('build-tag'),
      confirmYes: $('confirm-yes'),
      waveProgress: $('wave-progress'),
      chronicle: $('chronicle-list'),
      pauseIcon: $('pause-icon'),
      pauseLabel: $('pause-label'),
      speedIcon: $('speed-icon'),
    };
    this._last = {};
    // Portraits cropped from the baked sprite atlas, so the cards match the battlefield exactly.
    this.icons = Object.fromEntries(Object.keys(BUILDINGS).map((t) => [t, frameToDataURL(game.renderer.atlas, spriteKeys.icon(t))]));
    this.icons.sell = sellIcon();

    this.buttons = new Map();
    for (const [type, def] of Object.entries(BUILDINGS)) {
      if (!def.buildable) continue;
      this.buttons.set(type, this._makeButton(type, def.name, def.cost, def.hotkey, def.description));
    }
    this.buttons.set('sell', this._makeButton('sell', 'Sell', null, 'X', 'Click a building to sell it for part of its cost.'));

    onPress(this.el.startWave, () => game.world.startWave());
    onPress(this.el.speed, () => game.cycleSpeed());
    onPress(this.el.pause, () => game.togglePause());
    onPress($('help-btn'), () => this.toggleHelp());
    onPress($('help-close'), () => this.toggleHelp(false));
    onPress($('restart'), () => game.newGame());
    onPress($('confirm-yes'), () => game.build.confirmPending());
    onPress($('confirm-no'), () => game.build.cancelPending());
  }

  _makeButton(mode, name, cost, hotkey, description) {
    const btn = document.createElement('button');
    btn.className = 'build-btn';
    btn.title = description;
    btn.setAttribute('aria-label', cost === null ? name : `${name}, ${cost} gold`);
    const icon = this.icons[mode];
    btn.innerHTML = `
      <span class="hotkey">${hotkey}</span>
      <span class="card-art">${icon ? `<img src="${icon}" alt="" draggable="false" />` : ''}</span>
      <span class="name">${name}</span>
      <span class="cost">${cost === null ? 'Refund' : `${cost}g`}</span>`;
    onPress(btn, () => {
      const build = this.game.build;
      build.setMode(build.mode === mode ? null : mode);
    });
    this.el.buildbar.appendChild(btn);
    return btn;
  }

  attach(world) {
    this.world = world;
    this.el.gameover.hidden = true;
    this._last = {};
    this.el.toasts.replaceChildren();
    this.el.chronicle.replaceChildren();
    const ev = world.events;
    ev.on('waveStarted', ({ wave, sides }) => this.toast(`Wave ${wave} incoming from the ${joinSides(sides)}!`, 'danger'));
    ev.on('waveCleared', ({ wave, bonus }) => this.toast(`Wave ${wave} survived! +${bonus} gold`, 'good'));
    ev.on('buildingDestroyed', ({ building }) => {
      if (building.def.attack && building.type !== 'townHall') this.toast(`${building.def.name} destroyed!`, 'warn');
    });
    ev.on('gameOver', (stats) => this.showGameOver(stats));
  }

  // ---------------------------------------------------------------- per-frame

  update() {
    const w = this.world;
    const hall = w.townHall;
    this._set('gold', Math.floor(w.economy.gold));
    this._set('wave', w.waves.wave);
    this._set('hallHp', `${Math.ceil(hall.hp)} / ${hall.maxHp}`);
    const ratio = hall.hp / hall.maxHp;
    if (this._last.hallRatio !== ratio) {
      this._last.hallRatio = ratio;
      this.el.hallBar.style.width = `${ratio * 100}%`;
      this.el.hallBar.classList.toggle('low', ratio < 0.3);
    }

    let phase = '';
    let progress = 0;
    if (w.phase === 'build') {
      phase = `Next in ${Math.ceil(w.phaseTimer)}s`;
      const total = w.waves.wave === 0 ? TIMING.firstBuildPhase : TIMING.buildPhase;
      progress = 1 - w.phaseTimer / total;
    } else if (w.phase === 'wave') {
      const remaining = w.enemies.length + w.waves.queue.length;
      phase = `${remaining} enemies left`;
      const total = w.waves.current?.entries.length || 1;
      progress = 1 - remaining / total;
    } else {
      phase = 'Fallen';
    }
    if (this.game.paused) phase = `Paused · ${phase}`;
    this._set('phase', phase);
    const pct = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
    if (this._last.progress !== pct) {
      this._last.progress = pct;
      this.el.waveProgress.style.width = pct;
      this.el.waveProgress.classList.toggle('fighting', w.phase === 'wave');
    }

    this.el.startWave.hidden = w.phase !== 'build';
    if (w.phase === 'build') {
      const next = w.waves.next;
      const units = summarizeWave(next).map((u) => `${u.count} ${u.name}`).join(', ');
      this._set('nextWave', `Wave ${next.wave}: ${units} — from the ${joinSides(next.sides)}`);
    } else {
      this._set('nextWave', '');
    }

    for (const [type, btn] of this.buttons) {
      const def = BUILDINGS[type];
      btn.classList.toggle('active', this.game.build.mode === type);
      btn.classList.toggle('unaffordable', !!def && !w.economy.canAfford(def.cost));
    }

    this._updateInfo();
    this._updateConfirm();
    this._updateBuildTag();
    if (!this.el.fps.hidden) {
      this._set('fps', `${this.game.fps} FPS · ${Math.round(this.game.renderer.effectiveScale * 100)}%`);
    }
  }

  // Desktop: cost of the wall being dragged, next to the cursor.
  _updateBuildTag() {
    const tag = this.game.build.dragTag();
    const el = this.el.buildTag;
    el.hidden = !tag;
    if (!tag) return;
    el.textContent = tag.text;
    el.classList.toggle('bad', !tag.ok);
    el.style.transform = `translate(${tag.x + 16}px, ${tag.y + 14}px)`;
  }

  setFpsVisible(visible) {
    this.el.fps.hidden = !visible;
  }

  // ✓/✕ buttons floating above a pending touch placement.
  _updateConfirm() {
    const build = this.game.build;
    const info = build.pendingInfo();
    const pos = info && !build.draggingPending ? this.game.renderer.toScreen(info.cx, info.height + 0.8, info.cz) : null;
    const el = this.el.confirm;
    el.hidden = !pos;
    if (!pos) return;
    const half = el.offsetWidth / 2 || 60;
    const x = Math.min(window.innerWidth - half - 6, Math.max(half + 6, pos.x));
    const y = Math.max(130, pos.y - 30);
    el.style.transform = `translate(${x - half}px, ${y - el.offsetHeight}px)`;
    this.el.confirmYes.classList.toggle('invalid', !info.ok);
    this.el.confirmLabel.textContent = info.ok ? info.label : info.reason;
    this.el.confirmLabel.classList.toggle('bad', !info.ok);
    this.el.confirmYes.title = info.ok ? 'Place' : info.reason;
  }

  _set(key, value) {
    if (this._last[key] === value) return;
    this._last[key] = value;
    this.el[key].textContent = value;
  }

  // The Engineer's Codex: details of the selected building.
  _updateInfo() {
    const b = this.game.build.selected;
    const key = b ? `${b.id}:${Math.ceil(b.hp)}` : '';
    if (this._last.info === key) return;
    this._last.info = key;
    if (!b) {
      this.el.info.hidden = true;
      return;
    }
    const a = b.def.attack;
    const sellable = this.world.canSell(b);
    const segments = (value, max) => {
      const filled = Math.max(1, Math.round((value / max) * 5));
      return `<span class="segments">${Array.from({ length: 5 }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('')}</span>`;
    };
    const stat = (label, value, max, note) => `<div class="codex-stat"><span>${label}</span>${segments(value, max)}<em>${note}</em></div>`;
    const icon = this.icons[b.type];
    const hpRatio = b.hp / b.maxHp;
    this.el.info.hidden = false;
    this.el.info.innerHTML = `
      <div class="codex-head">Engineer's Codex</div>
      <div class="codex-body">
        ${icon ? `<img class="codex-art" src="${icon}" alt="" />` : ''}
        <div>
          <h3>${b.def.name}</h3>
          <p class="desc">${b.def.description}</p>
        </div>
      </div>
      <div class="codex-stat"><span>Health</span><span class="bar codex-hp"><span style="width:${hpRatio * 100}%"></span></span><em>${Math.ceil(b.hp)}/${b.maxHp}</em></div>
      ${
        a
          ? stat('Damage', a.damage, STAT_MAX.damage, a.kind === 'pulse' ? `${a.damage} all` : a.splash ? `${a.damage} area` : `${a.damage}`) +
            stat('Range', a.range, STAT_MAX.range, `${a.range}`) +
            stat('Fire rate', 1 / a.cooldown, STAT_MAX.rate, `${(1 / a.cooldown).toFixed(1)}/s`)
          : ''
      }
      ${!sellable ? '' : `<button id="sell-selected" class="primary">Sell for <i class="coin"></i>${this.world.sellValue(b)}</button>`}`;
    if (sellable) {
      onPress($('sell-selected'), () => {
        this.world.sell(b.id);
        this.game.build.select(null);
      });
    }
  }

  // ---------------------------------------------------------------- notifications

  onModeChanged() {
    this._last.info = null;
  }

  onSelectionChanged() {
    this._last.info = null;
  }

  /** Report an event: a short toast (shown on small screens) and an entry in the Battle Chronicle. */
  toast(message, kind = 'info') {
    this._chronicle(message, kind);
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = message;
    this.el.toasts.appendChild(el);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  _chronicle(message, kind) {
    const li = document.createElement('li');
    li.className = kind;
    li.textContent = message;
    this.el.chronicle.prepend(li);
    while (this.el.chronicle.children.length > CHRONICLE_LENGTH) this.el.chronicle.lastChild.remove();
  }

  setSpeed(speed) {
    this.el.speedIcon.textContent = `${speed}×`;
  }

  setPaused(paused) {
    this.el.pauseIcon.textContent = paused ? '▶' : '❚❚';
    this.el.pauseLabel.textContent = paused ? 'Resume' : 'Pause';
    this.el.pause.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  }

  toggleHelp(force) {
    this.el.help.hidden = force === undefined ? !this.el.help.hidden : !force;
  }

  showError(title, message) {
    $('error-title').textContent = title;
    $('error-message').textContent = message;
    $('error').hidden = false;
  }

  hideError() {
    $('error').hidden = true;
  }

  showGameOver(stats) {
    const best = this.game.recordBest(stats.wavesSurvived);
    this.el.gameoverStats.innerHTML = `
      You survived <strong>${stats.wavesSurvived}</strong> wave${stats.wavesSurvived === 1 ? '' : 's'}
      and defeated <strong>${stats.kills}</strong> enemies.<br />
      Best: ${best} wave${best === 1 ? '' : 's'}`;
    this.el.gameover.hidden = false;
  }
}
