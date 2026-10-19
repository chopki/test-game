import { T } from '../sim/terrain.js';
import { territoryOf } from '../sim/flags.js';
import { REALM } from '../sim/config.js';
import { seenAt } from '../sim/realm/fog.js';

/**
 * The minimap (Conquest and Realm): the whole map in the battlefield's own isometric view, so the lanes run the same way
 * on both, with each side's buildings and soldiers in their colours and a frame round what the camera sees. Press
 * or drag on it to move the camera there; while giving your hero orders, press it to send them there. It only
 * reads the world (orders go through World, as from the battlefield). In a Realm, the fog lies over land no one has
 * seen (and hides the outlaws in it), and found camps and bounty flags are marked.
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
const TEAM = { red: '#b3352a', blue: '#2f4f93', neutral: '#6e6656' };
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
      // Giving your hero orders: a press on the minimap sends them there, however far.
      if (this.game.build.mode === 'hero') {
        const at = this.toMap(e.clientX, e.clientY);
        if (at) this.game.build.orderHeroAt({ x: Math.floor(at.x), z: Math.floor(at.z) });
        return;
      }
      this.el.setPointerCapture(e.pointerId);
      this._dragging = true;
      move(e);
    });
    this.el.addEventListener('pointermove', (e) => this._dragging && move(e));
    for (const end of ['pointerup', 'pointercancel']) this.el.addEventListener(end, () => (this._dragging = false));
  }

  /** Shown for Conquest and Realm maps. */
  attach(world) {
    this.world = world;
    this.el.hidden = world.mode !== 'conquest' && world.mode !== 'realm';
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
    // Territory (faint, each side's colour) and the flags (a diamond in the holder's colour, pale if no one's).
    for (const team of world.mode === 'conquest' ? ['red', 'blue'] : []) {
      g.strokeStyle = TEAM[team];
      g.globalAlpha = 0.45;
      g.lineWidth = 1;
      for (const t of territoryOf(world, team)) {
        g.beginPath();
        for (let a = 0; a <= 24; a++) {
          const [px, py] = this.project(t.x + Math.cos((a / 24) * Math.PI * 2) * t.r, t.z + Math.sin((a / 24) * Math.PI * 2) * t.r);
          if (a) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    for (const f of world.flags ?? []) {
      const [px, py] = this.project(f.x, f.z);
      const k = Math.max(2.5, this.s * 1.6);
      g.fillStyle = f.owner ? TEAM[f.owner] : '#f3ecd8';
      g.strokeStyle = '#3a2a18';
      g.beginPath();
      g.moveTo(px, py - k);
      g.lineTo(px + k, py);
      g.lineTo(px, py + k);
      g.lineTo(px - k, py);
      g.closePath();
      g.fill();
      g.stroke();
    }
    const realm = world.realm;
    if (realm) this._drawRealm(g, realm);
    // Soldiers: a dot each (heroes a bigger one).
    const r = Math.max(1, this.s * 0.9);
    for (const t of world.troops) {
      if (!t.alive || t.delay > 0) continue;
      if (realm && (t.inside > 0 || (t.team === 'neutral' && !seenAt(world, t.x, t.z)))) continue;
      if (t.realm === 'hero') {
        g.fillStyle = '#f2d27a';
        const [hx, hy] = this.project(t.x, t.z);
        g.fillRect(hx - r, hy - r, r * 2, r * 2);
        continue;
      }
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

  /** Realm: the fog over unseen chunks, found camps (a dark square) and bounty flags (a gold dot). */
  _drawRealm(g, realm) {
    const c = REALM.chunk;
    const { cols, rows, seen } = realm.fog;
    g.fillStyle = 'rgba(38, 35, 42, 0.82)';
    for (let cz = 0; cz < rows; cz++) {
      for (let cx = 0; cx < cols; cx++) {
        if (seen[cz * cols + cx]) continue;
        const [x0, z0, x1, z1] = [cx * c, cz * c, Math.min(this.world.grid.width, (cx + 1) * c), Math.min(this.world.grid.height, (cz + 1) * c)];
        g.beginPath();
        g.moveTo(...this.project(x0, z0));
        g.lineTo(...this.project(x1, z0));
        g.lineTo(...this.project(x1, z1));
        g.lineTo(...this.project(x0, z1));
        g.fill();
      }
    }
    for (const lair of realm.lairs) {
      if (!lair.discovered || lair.razed) continue;
      g.fillStyle = TEAM.neutral;
      g.strokeStyle = '#2a2018';
      g.beginPath();
      g.moveTo(...this.project(lair.x, lair.z));
      g.lineTo(...this.project(lair.x + lair.size, lair.z));
      g.lineTo(...this.project(lair.x + lair.size, lair.z + lair.size));
      g.lineTo(...this.project(lair.x, lair.z + lair.size));
      g.closePath();
      g.fill();
      g.stroke();
    }
    const k = Math.max(2, this.s * 1.2);
    for (const f of realm.bounties) {
      const at = f.lair !== undefined ? { x: realm.lairs[f.lair].cx, z: realm.lairs[f.lair].cz } : f.unit ?? f;
      const [px, py] = this.project(at.x, at.z);
      g.fillStyle = f.kind === 'explore' ? '#f3ecd8' : '#e2b347';
      g.strokeStyle = '#3a2a18';
      g.beginPath();
      g.arc(px, py, k, 0, Math.PI * 2);
      g.fill();
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
