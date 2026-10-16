import { BUILDINGS } from '../sim/config.js';
import { summarizeWave } from '../sim/WaveManager.js';

const $ = (id) => document.getElementById(id);

const SIDE_NAMES = { north: 'North', east: 'East', south: 'South', west: 'West' };
const joinSides = (sides) => sides.map((s) => SIDE_NAMES[s]).join(' & ');

/** DOM overlay: resource bar, build menu, selection panel, toasts, overlays. */
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
    };
    this._last = {};

    this.buttons = new Map();
    for (const [type, def] of Object.entries(BUILDINGS)) {
      if (!def.buildable) continue;
      this.buttons.set(type, this._makeButton(type, def.name, def.cost, def.hotkey, def.description));
    }
    this.buttons.set('sell', this._makeButton('sell', 'Sell', null, 'X', 'Click a building to sell it for part of its cost.'));

    this.el.startWave.addEventListener('click', () => game.world.startWave());
    this.el.speed.addEventListener('click', () => game.cycleSpeed());
    this.el.pause.addEventListener('click', () => game.togglePause());
    $('help-btn').addEventListener('click', () => this.toggleHelp());
    $('help-close').addEventListener('click', () => this.toggleHelp(false));
    $('restart').addEventListener('click', () => game.newGame());
  }

  _makeButton(mode, name, cost, hotkey, description) {
    const btn = document.createElement('button');
    btn.className = 'build-btn';
    btn.title = description;
    btn.innerHTML = `
      <span class="hotkey">${hotkey}</span>
      <span class="name">${name}</span>
      ${cost === null ? '' : `<span class="cost"><i class="coin"></i>${cost}</span>`}`;
    btn.addEventListener('click', () => {
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
      this.el.hallBar.style.background = `hsl(${ratio * 120}, 70%, 45%)`;
    }

    let phase = '';
    if (w.phase === 'build') phase = `Next wave in ${Math.ceil(w.phaseTimer)}s`;
    else if (w.phase === 'wave') phase = `Enemies remaining: ${w.enemies.length + w.waves.queue.length}`;
    else phase = 'The Town Hall has fallen';
    if (this.game.paused) phase = `PAUSED — ${phase}`;
    this._set('phase', phase);

    this.el.startWave.hidden = w.phase !== 'build';
    if (w.phase === 'build') {
      const next = w.waves.next;
      const units = summarizeWave(next).map((u) => `${u.count} ${u.name}${u.count > 1 ? 's' : ''}`).join(', ');
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
  }

  _set(key, value) {
    if (this._last[key] === value) return;
    this._last[key] = value;
    this.el[key].textContent = value;
  }

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
    const isHall = b === this.world.townHall;
    this.el.info.hidden = false;
    this.el.info.innerHTML = `
      <h3>${b.def.name}</h3>
      <p class="desc">${b.def.description}</p>
      <p>HP: ${Math.ceil(b.hp)} / ${b.maxHp}</p>
      ${a ? `<p>Damage ${a.damage}${a.splash ? ' (splash)' : ''} · Range ${a.range} · ${(1 / a.cooldown).toFixed(1)} shots/s</p>` : ''}
      ${isHall ? '' : `<button id="sell-selected">Sell for <i class="coin"></i>${this.world.sellValue(b)}</button>`}`;
    if (!isHall) {
      $('sell-selected').addEventListener('click', () => {
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

  toast(message, kind = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = message;
    this.el.toasts.appendChild(el);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  setSpeed(speed) {
    this.el.speed.textContent = `${speed}×`;
  }

  setPaused(paused) {
    this.el.pause.textContent = paused ? '▶' : '❚❚';
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
