import { T } from '../sim/terrain.js';

/**
 * The minimap (Conquest): the whole lane map in the battlefield's own isometric view, so the lanes run the same way
 * on both, with each side's buildings and soldiers in their colours and a frame round what the camera sees. Press
 * or drag on it to move the camera there. It only reads the world.
 */

const GROUND = {
  [T.open]: '#d8c595',
  [T.water]: '#6f9cbd',
  [T.ford]: '#9fc2cc',
  [T.rock]: '#9b948a',
  [T.forest]: '#6a7a43',
  [T.sea]: '#5f8fb2',
  [T.sand]: '#e3d4a5',
  [T.cliff]: '#7d6c56',
  [T.ramp]: '#c9b07c',
};
const TEAM = { red: '#b3352a', blue: '#2f4f93' };
const REDRAW_EVERY = 5; // frames

export class Minimap {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('minimap');
    this.ctx = this.el.getContext('2d');
    this.world = null;
    this._frame = 0;
    const move = (e) => {
      const at = this.toMap(e.clientX, e.clientY);
      if (at) this.game.renderer.focusOn(at.x, at.z);
    };
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.el.setPointerCapture(e.pointerId);
      this._dragging = true;
      move(e);
    });
    this.el.addEventListener('pointermove', (e) => this._dragging && move(e));
    for (const end of ['pointerup', 'pointercancel']) this.el.addEventListener(end, () => (this._dragging = false));
  }

  /** Shown for Conquest maps only. */
  attach(world) {
    this.world = world;
    this.el.hidden = world.mode !== 'conquest';
    if (this.el.hidden) return;
    this._layout();
    this._paintGround();
  }

  _layout() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = this.el.clientWidth || 200;
    const ch = this.el.clientHeight || 100;
    this.el.width = Math.round(cw * dpr);
    this.el.height = Math.round(ch * dpr);
    this._dpr = dpr;
    const { width: W, height: H } = this.world.grid;
    // A step east goes right and down, a step south left and down (as on the battlefield).
    this.s = Math.min((cw * 0.96) / (W + H), (ch * 0.96 * 2) / (W + H));
    this.ox = cw / 2 - ((W - H) / 2) * this.s;
    this.oy = ch / 2 - ((W + H) / 4) * this.s;
  }

  /** Minimap (CSS px, within the canvas) of map point (x, z). */
  project(x, z) {
    return [this.ox + (x - z) * this.s, this.oy + (x + z) * this.s * 0.5];
  }

  /** The map point under client position (cx, cy) on the minimap, or null if it's off the map. */
  toMap(cx, cy) {
    if (!this.world) return null;
    const r = this.el.getBoundingClientRect();
    const u = (cx - r.left - this.ox) / this.s;
    const v = (cy - r.top - this.oy) / (this.s * 0.5);
    const x = (u + v) / 2;
    const z = (v - u) / 2;
    const { width: W, height: H } = this.world.grid;
    return x >= 0 && z >= 0 && x <= W && z <= H ? { x, z } : null;
  }

  /** The terrain, drawn once per map onto a canvas of its own. */
  _paintGround() {
    const { grid } = this.world;
    const c = document.createElement('canvas');
    c.width = this.el.width;
    c.height = this.el.height;
    const g = c.getContext('2d');
    g.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    for (let z = 0; z < grid.height; z++) {
      for (let x = 0; x < grid.width; x++) {
        g.fillStyle = GROUND[grid.terrainAt(x, z)] ?? GROUND[T.open];
        g.beginPath();
        g.moveTo(...this.project(x, z));
        g.lineTo(...this.project(x + 1.05, z));
        g.lineTo(...this.project(x + 1.05, z + 1.05));
        g.lineTo(...this.project(x, z + 1.05));
        g.fill();
      }
    }
    this._ground = c;
  }

  update() {
    if (!this.world || this.el.hidden || this._frame++ % REDRAW_EVERY) return;
    const { ctx: g, world } = this;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.el.width, this.el.height);
    g.drawImage(this._ground, 0, 0);
    g.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    // Buildings: footprints in their side's colour (walls thinner and paler).
    for (const b of world.buildings.values()) {
      g.fillStyle = TEAM[b.team] ?? TEAM.red;
      g.globalAlpha = b.type === 'wall' ? 0.6 : 1;
      const k = b.type === 'townHall' ? 0.6 : 0;
      g.beginPath();
      g.moveTo(...this.project(b.x - k, b.z - k));
      g.lineTo(...this.project(b.x + b.size + k, b.z - k));
      g.lineTo(...this.project(b.x + b.size + k, b.z + b.size + k));
      g.lineTo(...this.project(b.x - k, b.z + b.size + k));
      g.fill();
    }
    g.globalAlpha = 1;
    // Soldiers: a dot each.
    const r = Math.max(1, this.s * 0.9);
    for (const t of world.troops) {
      if (!t.alive || t.delay > 0) continue;
      g.fillStyle = TEAM[t.team] ?? TEAM.red;
      const [px, py] = this.project(t.x, t.z);
      g.fillRect(px - r / 2, py - r / 2, r, r);
    }
    // What the camera sees.
    const view = this._viewCorners();
    if (view) {
      g.strokeStyle = 'rgba(255, 246, 220, 0.95)';
      g.lineWidth = 1.5;
      g.beginPath();
      view.forEach(([x, z], i) => (i ? g.lineTo(...this.project(x, z)) : g.moveTo(...this.project(x, z))));
      g.closePath();
      g.stroke();
    }
  }

  /** The four corners of the screen, on the ground. */
  _viewCorners() {
    const r = this.game.renderer;
    const rect = r.canvas.getBoundingClientRect();
    const pts = [
      [rect.left, rect.top],
      [rect.right, rect.top],
      [rect.right, rect.bottom],
      [rect.left, rect.bottom],
    ].map(([x, y]) => r.pickGround(x, y));
    return pts.every(Boolean) ? pts.map((p) => [p.x, p.z]) : null;
  }
}
