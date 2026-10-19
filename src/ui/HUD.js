import { BUILDINGS, HEROES, REALM, TIMING, TROOPS, UPGRADES } from '../sim/config.js';
import { onPress } from './press.js';
import { summarizeWave } from '../sim/WaveManager.js';
import { squadFor } from '../sim/conquest.js';
import { Minimap } from './Minimap.js';
import { RealmPanel } from './RealmPanel.js';

/** Conquest: a squad (a list of troop types) as words, e.g. "3 Men-at-arms, 1 Bowman". */
function summarizeSquad(types) {
  const counts = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;
  return Object.entries(counts)
    .map(([t, n]) => `${n} ${n === 1 ? TROOPS.types[t].name : TROOPS.types[t].plural}`)
    .join(', ');
}
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
/** How long the "tap again to send the wave" prompt waits for the second tap (ms). */
const WAVE_CONFIRM_MS = 4000;

/** A small drawn icon for the Bounty card (Realm): a red flag on a pole over a heap of coins. */
function bountyIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(40, 14, 6, 66);
  ctx.fillStyle = '#b8352a';
  ctx.beginPath();
  ctx.moveTo(46, 16);
  ctx.lineTo(82, 26);
  ctx.lineTo(46, 40);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#6b1f16';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const [x, y] of [[30, 76], [56, 78], [44, 66]]) {
    ctx.fillStyle = '#e2b347';
    ctx.beginPath();
    ctx.ellipse(x, y, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b4a10';
    ctx.stroke();
  }
  return c.toDataURL('image/png');
}

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
    this.minimap = new Minimap(game);
    this.el = {
      gold: $('gold'),
      wave: $('wave'),
      waveNum: $('wave-num'),
      hallRing: $('hall-ring'),
      hallPortrait: $('hall-portrait'),
      waveDial: $('wave-dial'),
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
    this.icons.bounty = bountyIcon();
    this.realm = new RealmPanel(game, this);
    // The herald ribbon (a Realm on a small screen): the latest chronicle entry, in place of toasts that vanish.
    this.el.herald = document.createElement('button');
    this.el.herald.type = 'button';
    this.el.herald.id = 'herald';
    this.el.herald.hidden = true;
    this.el.herald.setAttribute('aria-label', 'Latest news: open the chronicle');
    this.el.herald.innerHTML = '<span class="seal" aria-hidden="true"></span><span class="herald-text"></span>';
    $('hud').appendChild(this.el.herald);
    onPress(this.el.herald, () => this.toggleChronicle());
    // A chronicle entry about somewhere: a tap looks there. (Unrolled on a small screen, a tap anywhere else on it
    // rolls it up.)
    onPress($('chronicle'), (e) => {
      const li = e.target.closest?.('li.jump');
      if (li) game.renderer.focusOn(Number(li.dataset.x), Number(li.dataset.z));
      this.toggleChronicle(false);
    });

    this.buttons = new Map();
    for (const [type, def] of Object.entries(BUILDINGS)) {
      if (!def.buildable) continue;
      this.buttons.set(type, this._makeButton(type, def.name, def.cost, def.hotkey, def.description));
    }
    this.buttons.set('bounty', this._makeButton('bounty', 'Bounty', REALM.bounty.base, 'B', 'Place a bounty flag: on an outlaw camp or foe to have it attacked, or on open ground to have it explored.'));
    this.buttons.set('sell', this._makeButton('sell', 'Sell', null, 'X', 'Click a building to sell it for part of its cost.'));
    this._layoutWheel();
    this.setWheelOpen(!this._compact());
    window.addEventListener('resize', () => this._layoutWheel());
    onPress($('build-fab'), () => {
      this.setWheelOpen(!this.wheelOpen);
      if (!this.wheelOpen) game.build.setMode(null);
    });

    // Sending a wave early takes two taps, on the cog or the wave dial: the first asks, the second sends it.
    this._waveConfirmUntil = 0;
    onPress(this.el.startWave, () => this.requestEarlyWave());
    onPress(this.el.waveDial, () => this.requestEarlyWave());
    onPress(this.el.speed, () => game.cycleSpeed());
    onPress($('hero-btn'), () => this.toggleHeroMode());
    for (const slot of [0, 1]) onPress($(`ability-${slot}`), () => this.useAbility(slot));
    onPress(this.el.pause, () => game.togglePause());
    onPress($('help-btn'), () => this.toggleHelp());
    onPress($('help-close'), () => this.toggleHelp(false));
    onPress($('help-briefing'), () => {
      this.toggleHelp(false);
      game.intro.show(game.world.mode);
    });
    onPress($('restart'), () => game.newMap());
    onPress($('confirm-yes'), () => game.build.confirmPending());
    onPress($('confirm-no'), () => game.build.cancelPending());
  }

  _makeButton(mode, name, cost, hotkey, description) {
    const btn = document.createElement('button');
    btn.className = 'build-btn';
    btn.title = `${name}: ${description}`;
    btn.setAttribute('aria-label', cost === null ? name : `${name}, ${cost} gold`);
    const icon = this.icons[mode];
    btn.innerHTML = `
      <span class="hotkey">${hotkey}</span>
      <span class="card-art">${icon ? `<img src="${icon}" alt="" draggable="false" />` : ''}</span>
      <span class="name">${name}</span>
      <span class="cost">${cost === null ? 'Sell' : cost}</span>`;
    onPress(btn, () => {
      const build = this.game.build;
      build.setMode(build.mode === mode ? null : mode);
      // On a phone the wheel folds away once something is picked, to leave the map clear for placing it.
      if (build.mode && this._compact()) this.setWheelOpen(false);
    });
    this.el.buildbar.appendChild(btn);
    return btn;
  }

  /**
   * The first tap asks ("Tap again to send wave N now"); a second within WAVE_CONFIRM_MS sends the wave early.
   * Only between waves.
   */
  requestEarlyWave() {
    const w = this.world;
    if (w.phase !== 'build') return;
    if (performance.now() < this._waveConfirmUntil) {
      this._waveConfirmUntil = 0;
      w.startWave();
      return;
    }
    this._waveConfirmUntil = performance.now() + WAVE_CONFIRM_MS;
    this._last.phase = null; // redraw the prompt now
  }

  /** A building's portrait at `stage`, cropped from the atlas (cached). */
  _stageIcon(type, stage) {
    if (stage <= 1) return (this.icons[type] ??= frameToDataURL(this.game.renderer.atlas, spriteKeys.icon(type)));
    return (this.icons[`${type}:${stage}`] ??= frameToDataURL(this.game.renderer.atlas, spriteKeys.icon(type, stage)));
  }

  /** Phones and other narrow screens: the build wheel opens on demand, and a selection replaces the corners. */
  _compact() {
    return window.innerWidth < 900;
  }

  /** Open or fold the build wheel (the hammer in the bottom-right corner). */
  setWheelOpen(open) {
    this.wheelOpen = open;
    this._fitChronicle();
    $('build-wheel').classList.toggle('open', open);
    $('build-fab').setAttribute('aria-expanded', String(open));
    $('build-fab').setAttribute('aria-label', open ? 'Close the build wheel' : 'Build');
  }

  /**
   * Lay the build buttons out on a quarter circle round the hammer, from straight up to straight left, on a radius
   * that fits them (and the screen).
   */
  _layoutWheel() {
    const shown = [...this.buttons.values()].filter((b) => !b.hidden);
    const n = shown.length;
    const size = this._compact() ? 56 : 64;
    // Far enough out that neighbours (and their cost tags) don't touch: an arc step of about 1.2 medallions. Too many
    // for one arc on the screen (a Realm's wheel on a phone): two arcs, the inner one a medallion and a bit in.
    const fit = (count) => ((size * 1.2 * Math.max(1, count - 1)) / (Math.PI / 2)) | 0;
    const most = Math.min(window.innerWidth - 90, window.innerHeight - 360); // (clear of the chronicle above it)
    const outer = fit(n) > most ? Math.ceil(n * 0.6) : n;
    const r = Math.min(fit(outer), most);
    const arcs = [
      { items: shown.slice(0, outer), r },
      { items: shown.slice(outer), r: r - size * 1.3 },
    ];
    for (const arc of arcs) {
      arc.items.forEach((btn, i) => {
        const a = (Math.PI / 2) * (1 + (arc.items.length > 1 ? i / (arc.items.length - 1) : 0.5)); // 90° (up) to 180° (left)
        btn.style.width = btn.style.height = `${size}px`;
        btn.style.transform = `translate(${Math.cos(a) * arc.r - size / 2}px, ${-Math.sin(a) * arc.r - size / 2}px)`;
      });
    }
    this._wheelReach = r + size / 2 + 14; // how far above the hammer the wheel goes (with its cost tags)
    this._fitChronicle();
  }

  /** The chronicle (wide screens) stops short of the open build wheel below it: older entries are cut off. */
  _fitChronicle() {
    const list = this.el.chronicle;
    const fab = $('build-fab').getBoundingClientRect();
    if (!this.wheelOpen || !this._wheelReach || !fab.height) {
      list.style.maxHeight = '';
      return;
    }
    const top = fab.top + fab.height / 2 - this._wheelReach;
    list.style.maxHeight = `${Math.max(60, top - list.getBoundingClientRect().top - 16)}px`;
  }

  attach(world) {
    this.world = world;
    this.minimap.attach(world);
    // Only what this mode offers is in the wheel (the Flag Fort in Conquest; guilds, the smithy and bounties in a Realm).
    for (const [type, btn] of this.buttons) btn.hidden = type === 'bounty' ? !world.realm : BUILDINGS[type] ? !world.offers(type) : false;
    this.realm.attach(world);
    document.body.classList.toggle('realm', Boolean(world.realm));
    this._dusk = false;
    this.el.herald.hidden = true;
    this.toggleChronicle(false);
    this._layoutWheel();
    this.el.gameover.hidden = true;
    this._last = {};
    this.el.toasts.replaceChildren();
    this.el.chronicle.replaceChildren();
    const ev = world.events;
    ev.on('waveStarted', ({ wave, sides }) => {
      if (world.mode === 'conquest') this.toast(`Wave ${wave}: the squads march out, ours and theirs!`, 'danger');
      else if (world.realm) this.toast(`Night falls: the blue army comes from the ${joinSides(sides)}!`, 'danger');
      else this.toast(`Wave ${wave} incoming from the ${joinSides(sides)}!`, 'danger');
    });
    ev.on('waveCleared', ({ wave, bonus }) => this.toast(world.realm ? `Dawn! Night ${wave} survived. +${bonus} gold` : `Wave ${wave} survived! +${bonus} gold`, 'good'));
    ev.on('buildingDestroyed', ({ building }) => {
      if ((building.def.attack || building.def.trains) && building.type !== 'townHall') {
        if (building.team === 'blue') this.toast(`Enemy ${building.def.name} destroyed!`, 'good');
        else this.toast(`${building.def.name} destroyed!`, 'warn');
      }
    });
    ev.on('gameOver', (stats) => this.showGameOver(stats));
    ev.on('heroFell', ({ hero, respawnAt }) => {
      const back = Math.round(respawnAt - world.time);
      if (hero.team === 'red') this.toast(`${hero.def.name} has fallen! Back at the hall in ${back}s`, 'warn');
      else this.toast(`${hero.def.name}, the enemy's champion, has fallen!`, 'good');
    });
    ev.on('heroLevelUp', ({ hero, level }) => hero.team === 'red' && this.toast(`${hero.def.name} reaches level ${level}`, 'good'));
    ev.on('campCleared', ({ by }) => by === 'red' && this.toast('Bandit camp cleared! It will fill again in a while', 'good'));
    ev.on('flagCaptured', ({ team }) => this.toast(team === 'red' ? 'We hold a flag: build a Flag Fort on it (7) to make it count' : 'The enemy has taken a flag', team === 'red' ? 'good' : 'warn'));
    ev.on('flagFortBuilt', ({ building }) => building.team === 'blue' && this.toast('The enemy has built a Flag Fort', 'warn'));
    ev.on('flagLost', ({ owner }) => owner === 'red' && this.toast('One of our flags is falling!', 'warn'));
    ev.on('buildingUpgraded', ({ building }) => {
      if (building.type === 'wall') return;
      if (building.team === 'blue') this.toast(`The enemy upgraded a ${building.def.name}: ${building.def.stageName}`, 'warn');
      else this.toast(`${building.def.name} upgraded: ${building.def.stageName}`, 'good');
    });
  }

  // ---------------------------------------------------------------- per-frame

  update() {
    const w = this.world;
    const hall = w.townHall;
    this._set('gold', Math.floor(w.economy.gold));
    this._set('wave', w.waves.wave);
    // The wave dial: the coming wave between waves, else the one being fought.
    this._set('waveNum', String(w.phase === 'build' ? w.waves.wave + 1 : w.waves.wave).padStart(2, '0'));
    this._set('hallHp', `${Math.ceil(hall.hp)} / ${hall.maxHp}`);
    const ratio = hall.hp / hall.maxHp;
    if (this._last.hallRatio !== ratio) {
      this._last.hallRatio = ratio;
      this.el.hallBar.style.width = `${ratio * 100}%`;
      this.el.hallRing.style.setProperty('--hp', ratio.toFixed(3));
      this.el.hallRing.classList.toggle('low', ratio < 0.3);
    }
    // The Town Hall's portrait at its stage.
    if (this._last.hallStage !== hall.stage) {
      this._last.hallStage = hall.stage;
      this.el.hallPortrait.src = this._stageIcon('townHall', hall.stage);
    }

    let phase = '';
    let progress = 0;
    if (w.phase === 'build') {
      phase = w.realm ? `Day ${w.waves.wave + 1} · night falls in ${Math.ceil(w.phaseTimer)}s` : `Next wave in ${Math.ceil(w.phaseTimer)}s`;
      const total = w.realm ? (w.waves.wave === 0 ? REALM.firstDay : REALM.day) : w.waves.wave === 0 ? TIMING.firstBuildPhase : TIMING.buildPhase;
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
    const confirming = w.phase === 'build' && performance.now() < this._waveConfirmUntil;
    if (confirming) phase = `Tap again to send wave ${w.waves.wave + 1} now`;
    this._set('phase', phase);
    // In a Realm the dial is a sun by day and a moon by night, and counts days.
    const dial = confirming ? 'Send?' : !w.realm ? 'Wave' : w.phase === 'wave' ? 'Night' : 'Day';
    if (this._last.confirming !== confirming || this._last.dial !== dial) {
      this._last.confirming = confirming;
      this._last.dial = dial;
      this.el.waveDial.classList.toggle('confirm', confirming);
      this.el.startWave.classList.toggle('confirm', confirming);
      this.el.waveDial.classList.toggle('sun', dial === 'Day');
      this.el.waveDial.classList.toggle('moon', dial === 'Night');
      $('dial-label').textContent = dial;
    }
    // Realm: at dusk, the herald cries where the night's army is gathering.
    if (w.realm && w.phase === 'build' && w.phaseTimer <= REALM.dusk && !this._dusk) {
      this._dusk = true;
      this.chronicle(`Dusk falls: the blue army gathers to the ${joinSides(w.waves.next.sides)}`, 'danger');
    } else if (w.phase !== 'build') {
      this._dusk = false;
    }
    const pct = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
    if (this._last.progress !== pct) {
      this._last.progress = pct;
      this.el.waveProgress.style.width = pct;
      this.el.waveDial.style.setProperty('--p', parseFloat(pct) / 100);
      this.el.waveDial.classList.toggle('fighting', w.phase === 'wave');
    }

    this.el.startWave.hidden = w.phase !== 'build';
    if (w.mode === 'conquest') {
      const men = summarizeSquad(squadFor(w.waves.wave + 1));
      const foe = w.enemyHall;
      const flags = w.flags.filter((f) => f.owner === 'red').length;
      this._set('nextWave', w.phase === 'build' ? `Wave ${w.waves.wave + 1}: ${men} from each Barracks · Flags ${flags}/${w.flags.length} · Enemy Town Hall ${Math.ceil(foe.hp)}/${foe.maxHp}` : '');
    } else if (w.phase === 'build') {
      const next = w.waves.next;
      const units = summarizeWave(next).map((u) => `${u.count} ${u.name}`).join(', ');
      this._set('nextWave', `Wave ${next.wave}: ${units} — from the ${joinSides(next.sides)}`);
    } else {
      this._set('nextWave', '');
    }

    for (const [type, btn] of this.buttons) {
      const def = BUILDINGS[type];
      btn.classList.toggle('active', this.game.build.mode === type);
      btn.classList.toggle('unaffordable', type === 'bounty' ? !w.economy.canAfford(REALM.bounty.base) : !!def && !w.economy.canAfford(def.cost));
    }

    this._updateInfo();
    this._updateHero();
    this.realm.update();
    this.realm.updateRail();
    this.minimap.update();
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

  // The Engineer's Codex: details of the selected building, its stage, and what upgrading it would bring.
  _updateInfo() {
    const pick = this.game.build.picked;
    if (pick) {
      this._updateRealmCard(pick);
      return;
    }
    const b = this.game.build.selected;
    const w = this.world;
    const realm = b && this.realm.buildingSection(b);
    const up = b && w.upgradeCheck(b);
    const fix = b && w.repairCheck(b);
    const line = b?.type === 'wall' && up.next ? w.wallLine(b.id) : [];
    const garrison = b?.def.trains ? this._garrison(b, b.team === 'blue' ? null : up.next) : '';
    const key = b ? [b.id, Math.ceil(b.hp), b.stage, up.ok, up.reason, fix.ok, fix.cost, line.length, w.canSell(b) && w.sellValue(b), garrison, realm?.key].join(':') : '';
    if (this._last.info === key) return;
    this._last.info = key;
    document.body.classList.toggle('has-selection', Boolean(b));
    if (!b) {
      this.el.info.hidden = true;
      return;
    }
    const a = b.def.attack;
    const n = b.team === 'blue' ? null : up.next; // the enemy's buildings: just what they are
    const sellable = w.canSell(b);
    const segments = (value, max) => {
      const filled = Math.max(1, Math.round((value / max) * 5));
      return `<span class="segments">${Array.from({ length: 5 }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('')}</span>`;
    };
    // A stat now, and (in green) what the next stage makes it.
    const after = (now, next, fmt = (v) => v) => (next !== undefined && next !== now ? ` <b class="up">→ ${fmt(next)}</b>` : '');
    const stat = (label, value, max, note, next) => `<div class="codex-stat"><span>${label}</span>${segments(value, max)}<em>${note}${next ?? ''}</em></div>`;
    const stages = b.team === 'blue' ? null : UPGRADES.stages[b.type];
    const pips = stages
      ? `<div class="stage-pips" aria-label="Stage ${b.stage} of ${stages.length}">${stages.map((_, i) => `<i class="${i < b.stage ? 'on' : i === b.stage ? 'next' : ''}"></i>`).join('')}<span>${b.def.stageName} · stage ${b.stage} of ${stages.length}</span></div>`
      : '';
    const icon = this._stageIcon(b.type, b.stage);
    const hpRatio = b.hp / b.maxHp;
    const rate = (c) => `${(1 / c).toFixed(1)}/s`;
    this.el.info.hidden = false;
    this.el.info.innerHTML = `
      <button id="info-close" class="info-close" type="button" aria-label="Close">×</button>
      <div class="codex-body">
        ${icon ? `<img class="codex-art" src="${icon}" alt="" />` : ''}
        <div>
          <h3>${b.team === 'blue' ? `Enemy ${b.def.name}` : b.def.name}</h3>
          ${pips}
          <p class="desc">${b.def.description}</p>
        </div>
      </div>
      <div class="codex-stat"><span>Health</span><span class="bar codex-hp"><span style="width:${hpRatio * 100}%"></span></span><em>${Math.ceil(b.hp)}/${b.maxHp}${after(b.maxHp, n?.maxHp)}</em></div>
      ${
        a
          ? stat('Damage', a.damage, STAT_MAX.damage, a.kind === 'pulse' ? `${a.damage} all` : a.splash ? `${a.damage} area` : `${a.damage}`, after(a.damage, n?.attack.damage)) +
            stat('Range', w.rangeOf(b), STAT_MAX.range, `${w.rangeOf(b)}`, after(a.range, n?.attack.range, (r) => r + (w.rangeOf(b) - a.range))) +
            stat('Fire rate', 1 / a.cooldown, STAT_MAX.rate, rate(a.cooldown), after(a.cooldown, n?.attack.cooldown, rate))
          : ''
      }
      ${garrison ? `<p class="garrison">${garrison}</p>` : ''}
      ${realm ? `<div class="realm-section">${realm.html}</div>` : ''}
      <div class="codex-actions">
        ${
          n
            ? `<button id="upgrade-selected" class="primary" ${up.ok ? '' : 'disabled'} title="${up.ok ? `Upgrade to ${n.stageName} (U)` : up.reason}">Upgrade <i class="coin"></i>${up.cost}</button>`
            : stages
              ? '<span class="maxed">Fully upgraded</span>'
              : ''
        }
        ${b.hp < b.maxHp ? `<button id="repair-selected" ${fix.ok ? '' : 'disabled'} title="${fix.ok ? 'Repair to full health' : fix.reason}">Repair <i class="coin"></i>${fix.cost}</button>` : ''}
        ${!sellable ? '' : `<button id="sell-selected">Sell <i class="coin"></i>${w.sellValue(b)}</button>`}
      </div>
      ${line.length > 1 ? `<button id="upgrade-line" class="line-btn" ${up.ok ? '' : 'disabled'}>Upgrade the whole line: ${line.length} walls, <i class="coin"></i>${line.length * up.cost}</button>` : ''}
      ${n && !up.ok ? `<p class="codex-why">${up.reason}</p>` : ''}`;
    if (b.team === 'blue') this.el.info.querySelector('.codex-actions').replaceChildren();
    realm?.bind();
    onPress($('info-close'), () => this.game.build.select(null));
    if (n) onPress($('upgrade-selected'), () => w.upgrade(b.id));
    if (line.length > 1) onPress($('upgrade-line'), () => w.upgradeLine(b.id));
    if (b.hp < b.maxHp) onPress($('repair-selected'), () => w.repair(b.id));
    if (sellable) {
      onPress($('sell-selected'), () => {
        w.sell(b.id);
        this.game.build.select(null);
      });
    }
  }

  /** Realm: the card of the picked hero, foe, camp or flag (see RealmPanel). */
  _updateRealmCard(pick) {
    const card = this.realm.card(pick);
    if (this._last.info === card.key) return;
    this._last.info = card.key;
    document.body.classList.add('has-selection');
    this.el.info.hidden = false;
    this.el.info.innerHTML = `<button id="info-close" class="info-close" type="button" aria-label="Close">×</button>${card.html}`;
    onPress($('info-close'), () => this.game.build.pick(null));
    card.bind();
  }

  /** Conquest: start (or stop) giving your hero orders; the camera goes to them. */
  toggleHeroMode() {
    const build = this.game.build;
    const h = this.world.heroes?.red;
    if (build.mode === 'hero' || !h) {
      build.setMode(null);
      return;
    }
    build.setMode('hero');
    if (h.alive) {
      this.game.renderer.focusOn(h.x, h.z);
      this.toast(`Tap the map (or the minimap) to send ${h.def.name} there, or an enemy to attack it. Drag to look around`, 'info');
    }
  }

  /** Conquest: your hero's ability in `slot` (Q or E); says why not if it can't be used now. */
  useAbility(slot) {
    const r = this.world.useAbility(slot);
    if (!r.ok) this.toast(r.reason, 'warn');
  }

  /** Conquest: the hero cog (portrait, level, health, or when they're back) and their two abilities' rest. */
  _updateHero() {
    const w = this.world;
    const heroBtn = $('hero-btn');
    const show = w.mode === 'conquest';
    heroBtn.hidden = $('ability-0').hidden = $('ability-1').hidden = !show;
    if (!show) return;
    const h = w.heroes.red;
    const kind = w.heroKinds.red;
    if (this._heroKind !== kind) {
      this._heroKind = kind;
      $('hero-portrait').src = frameToDataURL(this.game.renderer.atlas, spriteKeys.enemy(HEROES.roster[kind].type, Math.PI / 4, true, 'walk', 0, 'red'));
      HEROES.roster[kind].abilities.forEach((name, slot) => {
        const a = HEROES.abilities[name];
        $(`ability-${slot}`).title = `${a.name} (${slot ? 'E' : 'Q'})`;
      });
    }
    const label = h.alive ? h.def.name.split(' ').at(-1) : `Back in ${Math.max(1, Math.ceil(h.respawnAt - w.time))}s`;
    const rests = h.ready.map((t) => Math.max(0, Math.ceil(t - w.time)));
    const key = [kind, h.alive, h.level, Math.ceil((h.hp / h.maxHp) * 20), label, ...rests, this.game.build.mode === 'hero'].join(':');
    if (this._last.hero === key) return;
    this._last.hero = key;
    $('hero-level').textContent = h.level;
    $('hero-label').textContent = label;
    heroBtn.style.setProperty('--hp', h.alive ? (h.hp / h.maxHp).toFixed(2) : 0);
    heroBtn.classList.toggle('down', !h.alive);
    heroBtn.classList.toggle('active', this.game.build.mode === 'hero');
    HEROES.roster[kind].abilities.forEach((name, slot) => {
      $(`ability-${slot}`).disabled = !h.alive || rests[slot] > 0;
      $(`ability-${slot}-label`).textContent = rests[slot] > 0 ? `${rests[slot]}s` : HEROES.abilities[name].name;
    });
  }

  /**
   * A Barracks' men: how many stand, and when the next is ready (or why none can be trained); in Conquest, what it
   * adds to each wave's squad, and what its next stage (`next`) would.
   */
  _garrison(b, next) {
    if (this.world.mode === 'conquest') {
      const levy = ({ men, hp }) => {
        const extra = Object.entries(men).map(([t, n]) => `+${summarizeSquad(Array(n).fill(t))}`);
        return extra.length ? `${extra.join(', ')}, all ${Math.round(hp * 100)}% tougher` : '';
      };
      const now = levy(b.def.levy);
      const then = next ? levy(next.levy) : '';
      return `Each wave: the squad${now ? ` ${now}` : ''}${then ? `<br><b class="up">→ ${next.stageName}: the squad ${then}</b>` : ''}`;
    }
    const { garrison, every } = b.def.trains;
    const alive = b.squad?.filter((t) => t?.alive).length ?? 0;
    const more = next && next.trains.garrison > garrison ? ` <b class="up">→ ${next.trains.garrison} men</b>` : '';
    if (!b.door) return `${alive}/${garrison} men${more} · walled in: leave it a way out to train more`;
    if (alive >= garrison) return `${alive}/${garrison} men${more} · full strength`;
    return `${alive}/${garrison} men${more} · next in ${Math.max(1, Math.ceil(every - (b.trainTimer ?? 0)))}s`;
  }

  // ---------------------------------------------------------------- notifications

  onModeChanged() {
    this._last.info = null;
  }

  onSelectionChanged() {
    this._last.info = null;
  }

  /**
   * Report an event: a short toast (shown on small screens) and an entry in the Battle Chronicle. `kind` is its
   * severity ('good', 'info', 'warn' or 'danger': a gold, grey, amber or red seal); `at` ({ x, z }), where it happened
   * (a tap on its chronicle entry looks there). In a Realm on a small screen, the herald ribbon shows it instead.
   */
  toast(message, kind = 'info', at = null) {
    this.chronicle(message, kind, at);
    if (this.world?.realm) return; // (the herald ribbon has it; see chronicle)
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = message;
    this.el.toasts.appendChild(el);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  /**
   * An entry in the Battle Chronicle only (no toast), sealed by `kind` (see toast). The same news twice running is
   * one entry with a count ("×3"). In a Realm it's also cried by the herald ribbon (small screens).
   */
  chronicle(message, kind = 'info', at = null) {
    const list = this.el.chronicle;
    const top = list.firstElementChild;
    if (top && top.dataset.message === message && top.classList.contains(kind)) {
      top.dataset.count = String(Number(top.dataset.count) + 1);
      top.querySelector('.count').textContent = `×${top.dataset.count}`;
      if (at) Object.assign(top.dataset, { x: at.x, z: at.z });
    } else {
      const li = document.createElement('li');
      li.className = kind;
      Object.assign(li.dataset, { message, count: '1' });
      li.append(message, Object.assign(document.createElement('span'), { className: 'count' }));
      if (at) {
        Object.assign(li.dataset, { x: at.x, z: at.z });
        li.classList.add('jump');
        li.title = 'Look there';
      }
      list.prepend(li);
      while (list.children.length > CHRONICLE_LENGTH) list.lastChild.remove();
    }
    if (this.world?.realm) this._cry(list.firstElementChild);
  }

  /** The herald ribbon (a Realm, small screens): the latest news, sealed; a tap unrolls the chronicle. */
  _cry(li) {
    const herald = this.el.herald;
    herald.className = `herald ${['good', 'info', 'warn', 'danger'].find((k) => li.classList.contains(k)) ?? 'info'}`;
    herald.querySelector('.herald-text').textContent = li.dataset.message + (li.dataset.count > 1 ? ` ×${li.dataset.count}` : '');
    herald.hidden = false;
    herald.classList.remove('cried');
    void herald.offsetWidth; // (restart the flourish)
    herald.classList.add('cried');
  }

  /** Unroll (or roll up) the chronicle as a sheet over the bottom of the screen (small screens). */
  toggleChronicle(open = !document.body.classList.contains('chronicle-open')) {
    document.body.classList.toggle('chronicle-open', open);
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
    if (stats.won !== null && stats.won !== undefined) {
      // Conquest.
      $('gameover-title').textContent = stats.won ? 'Victory! The enemy Town Hall has fallen' : 'Your Town Hall has fallen';
      this.el.gameoverStats.innerHTML = `${stats.won ? 'You took the blue castle' : 'The blue army took your castle'} in <strong>${stats.wave}</strong> wave${stats.wave === 1 ? '' : 's'}, and felled <strong>${stats.kills}</strong> of their soldiers.`;
      this.el.gameover.hidden = false;
      return;
    }
    $('gameover-title').textContent = 'The Town Hall has fallen';
    const r = this.world.realm;
    if (r) {
      const n = stats.wavesSurvived;
      this.el.gameoverStats.innerHTML = `
        Your realm held for <strong>${n}</strong> night${n === 1 ? '' : 's'}. Your heroes burnt <strong>${r.stats.lairsRazed}</strong>
        outlaw camp${r.stats.lairsRazed === 1 ? '' : 's'} and paid <strong>${r.stats.taxes}</strong> gold in tax;
        ${r.stats.heroesLost ? `${r.stats.heroesLost} fell.` : 'not one of them fell.'}`;
      this.el.gameover.hidden = false;
      return;
    }
    const best = this.game.recordBest(stats.wavesSurvived);
    this.el.gameoverStats.innerHTML = `
      You survived <strong>${stats.wavesSurvived}</strong> wave${stats.wavesSurvived === 1 ? '' : 's'}
      and defeated <strong>${stats.kills}</strong> enemies.<br />
      Best: ${best} wave${best === 1 ? '' : 's'}`;
    this.el.gameover.hidden = false;
  }
}
