import { ECONOMY, TERRAIN } from '../sim/config.js';
import { battlegroundName, drawMapSketch } from './mapSketch.js';

const $ = (id) => document.getElementById(id);

const APPROACH = { north: 'Northern', south: 'Southern', east: 'Eastern', west: 'Western' };

/** Lore & tactics tips, each with the building whose portrait goes with it (if any). Numbers come from config.js. */
const TIPS = [
  ['cannonTower', 'Cannon Towers hit everything near where the ball lands: set them where the enemy bunches up, at corners and gates.'],
  ['wall', 'Enemies walk round a short wall, but smash straight through when the way round is too long. Give them a long road.'],
  ['archerTower', `Towers on high ground reach ${TERRAIN.hills.rangePerLevel} tile further for every level up.`],
  ['archerTower', `Arrows shot uphill come ${Math.round((1 - 1 / (1 + TERRAIN.hills.uphillReload)) * 100)}% slower. Keep your archers above the enemy, not below.`],
  ['catapult', 'Battering rams and siege catapults break walls far faster than men. Bring them down first.'],
  ['magicSpire', "The Magic Spire's pulse slows every enemy in reach: put it where they must walk past your other towers."],
  [null, `Enemies wade fords at ${Math.round(TERRAIN.fordSpeed * 100)}% speed: a tower by the river gets more shots at them.`],
  [null, `Selling a building returns ${Math.round(ECONOMY.sellRefund * 100)}% of its cost, less if it's damaged.`],
  ['wall', 'A tower can be built into a wall line: the wall pieces under it are replaced and count towards its price.'],
  [null, "Enemy archers stop out of reach and shoot your towers. Catapults and cannons outrange them."],
];

/**
 * The loading screen (after docs/reference/ui-menu.jpg): an iron-framed parchment page with the coming battle's
 * title, an ink sketch of the battleground, a lore & tactics tip and a progress bar.
 */
export class LoadingScreen {
  constructor() {
    this.el = $('loading');
    this.fill = $('loading-fill');
    this.text = $('loading-text');
    this.map = $('loading-map');
    this.progress = 0;
    this._target = 0;
    this._raf = 0;
    this._tip = Math.floor(Math.random() * TIPS.length);
    this.icons = null; // building portraits, once the sprites are loaded
  }

  get isOpen() {
    return !this.el.hidden;
  }

  /** Show the screen for `world` (or, before there is one, just the title), starting from `progress`. */
  show(world = null, progress = 0) {
    this.el.hidden = false;
    this.el.classList.remove('done');
    this.progress = this._target = progress;
    this._render();
    this._nextTip();
    if (world) this.setWorld(world);
  }

  /** Fill in the battle title and the sketch for `world`. */
  setWorld(world) {
    const next = world.waves.next;
    const approach = next.sides.map((s) => APPROACH[s]).join(' & ');
    $('loading-wave').textContent =
      world.mode === 'conquest' ? 'Conquest — Red against Blue, by three lanes' : `Wave ${next.wave} — The ${approach} Approach${next.sides.length > 1 ? 'es' : ''}`;
    $('loading-ground').textContent = `Battleground outline: ${battlegroundName(world)}`;
    this.map.classList.add('drawn');
    drawMapSketch(this.map, world, world.mode === 'conquest' ? [] : next.sides);
  }

  /** Move the bar towards `p` (0–1); with `trickle`, keep creeping on (slower and slower) while work goes on. */
  setProgress(p, { trickle = false } = {}) {
    this._target = p;
    this._trickle = trickle;
    if (!this._raf) this._raf = requestAnimationFrame(() => this._tick());
  }

  _tick() {
    this._raf = 0;
    if (this._trickle) this._target += (0.95 - this._target) * 0.004;
    this.progress += (this._target - this.progress) * 0.18;
    if (Math.abs(this._target - this.progress) < 0.002) this.progress = this._target;
    this._render();
    if (this.isOpen && (this._trickle || this.progress !== this._target)) this._raf = requestAnimationFrame(() => this._tick());
  }

  _render() {
    const pct = Math.round(this.progress * 100);
    this.fill.style.width = `${pct}%`;
    this.text.textContent = pct >= 100 ? 'To arms!' : `Loading… ${pct}%`;
  }

  _nextTip() {
    const [type, text] = TIPS[this._tip++ % TIPS.length];
    $('loading-tip').textContent = text;
    const art = $('loading-tip-art');
    const src = type && this.icons?.[type];
    art.hidden = !src;
    if (src) art.src = src;
  }

  /** Finish: fill the bar, then fade out. Resolves once it's gone. */
  async finish(hold = 350) {
    if (hold === 0) {
      this._trickle = false;
      this.el.hidden = true;
      return;
    }
    this._trickle = false;
    this._target = 1;
    this.progress = 1;
    this._render();
    await wait(hold);
    this.el.classList.add('done');
    await wait(300);
    this.el.hidden = true;
    this.el.classList.remove('done');
  }
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Resolves after the browser has painted at least once (so a screen just shown is on screen). */
export const painted = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
