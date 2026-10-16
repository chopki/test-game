import * as THREE from 'three';
import { BUILDINGS } from '../sim/config.js';
import { createBuildingModel } from '../render/models.js';

const OK_COLOR = 0x5fe36a;
const BAD_COLOR = 0xe35f5f;

/**
 * Translates mouse input into world commands: placing buildings (with a
 * ghost preview and drag-to-build walls), selling, and selecting.
 *
 * mode: null (select), a building type (build), or 'sell'.
 */
export class BuildController {
  constructor(game) {
    this.game = game;
    this.mode = null;
    this.selectedId = null;
    this.hover = null;
    this.dragging = false;
    this.lastDragTile = null;
    this._rightDown = null;

    const scene = game.renderer.scene;
    this.ghostMaterial = new THREE.MeshBasicMaterial({ color: OK_COLOR, transparent: true, opacity: 0.45, depthWrite: false });
    this.ghost = null;

    this.footprint = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: OK_COLOR, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.footprint.position.y = 0.03;
    this.footprint.visible = false;
    scene.add(this.footprint);

    this.rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    this.rangeRing.position.y = 0.04;
    this.rangeRing.visible = false;
    scene.add(this.rangeRing);

    const canvas = game.renderer.canvas;
    canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
    canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get world() {
    return this.game.world;
  }

  reset() {
    this.setMode(null);
    this.select(null);
  }

  setMode(mode) {
    if (this.ghost) {
      this.game.renderer.scene.remove(this.ghost);
      this.ghost = null;
    }
    this.mode = mode;
    if (mode && BUILDINGS[mode]) {
      this.select(null);
      this.ghost = createBuildingModel(mode);
      this.ghost.traverse((o) => {
        if (o.isMesh) {
          o.material = this.ghostMaterial;
          o.castShadow = false;
        }
      });
      this.game.renderer.scene.add(this.ghost);
    }
    this.game.hud?.onModeChanged(mode);
  }

  select(id) {
    this.selectedId = id;
    this.game.hud?.onSelectionChanged(id);
  }

  get selected() {
    return this.selectedId === null ? null : this.world.buildings.get(this.selectedId) ?? null;
  }

  // ---------------------------------------------------------------- input

  _tileFromEvent(ev) {
    const p = this.game.renderer.pickGround(ev.clientX, ev.clientY);
    return p ? { x: Math.floor(p.x), z: Math.floor(p.z) } : null;
  }

  _onPointerMove(ev) {
    this.hover = this._tileFromEvent(ev);
    if (this.dragging && this.mode === 'wall' && this.hover) {
      // Fill every tile between the last placed wall and the cursor so fast drags leave no gaps.
      for (const t of lineTiles(this.lastDragTile ?? this.hover, this.hover)) this.world.place('wall', t.x, t.z);
      this.lastDragTile = this.hover;
    }
  }

  _onPointerDown(ev) {
    if (ev.button === 2) {
      this._rightDown = { x: ev.clientX, y: ev.clientY };
      return;
    }
    if (ev.button !== 0) return;
    this.hover = this._tileFromEvent(ev);
    const tile = this.hover;
    if (!tile) return;

    if (this.mode === 'sell') {
      const b = this.world.buildingAt(tile.x, tile.z);
      if (b && b !== this.world.townHall) this.world.sell(b.id);
      return;
    }

    if (this.mode && BUILDINGS[this.mode]) {
      const a = this.world.anchorFor(this.mode, tile.x, tile.z);
      const result = this.world.place(this.mode, a.x, a.z);
      if (!result.ok) this.game.hud?.toast(result.reason, 'warn');
      if (this.mode === 'wall') {
        this.dragging = true;
        this.lastDragTile = tile;
      }
      return;
    }

    const b = this.world.buildingAt(tile.x, tile.z);
    this.select(b ? b.id : null);
  }

  _onPointerUp(ev) {
    if (ev.button === 0) {
      this.dragging = false;
      this.lastDragTile = null;
    }
    if (ev.button === 2 && this._rightDown) {
      // A right *click* (not a camera-rotate drag) cancels the current mode.
      const moved = Math.hypot(ev.clientX - this._rightDown.x, ev.clientY - this._rightDown.y);
      if (moved < 5) {
        this.setMode(null);
        this.select(null);
      }
      this._rightDown = null;
    }
  }

  // ---------------------------------------------------------------- per-frame

  update() {
    const r = this.game.renderer;
    const world = this.world;
    this.footprint.visible = false;
    this.rangeRing.visible = false;
    if (this.ghost) this.ghost.visible = false;

    if (this.selectedId !== null && !this.selected) this.select(null);

    if (this.mode && BUILDINGS[this.mode] && this.hover) {
      const def = BUILDINGS[this.mode];
      const a = world.anchorFor(this.mode, this.hover.x, this.hover.z);
      const { ok } = world.canPlace(this.mode, a.x, a.z);
      const color = ok ? OK_COLOR : BAD_COLOR;
      const cx = a.x + def.size / 2;
      const cz = a.z + def.size / 2;
      this.ghostMaterial.color.setHex(color);
      r.toScene(cx, 0, cz, this.ghost.position);
      this.ghost.visible = true;
      this._showFootprint(cx, cz, def.size, color);
      if (def.attack) this._showRange(cx, cz, def.attack.range);
    } else if (this.mode === 'sell' && this.hover) {
      const b = world.buildingAt(this.hover.x, this.hover.z);
      if (b && b !== world.townHall) this._showFootprint(b.cx, b.cz, b.size, BAD_COLOR);
    }

    const sel = this.selected;
    if (sel) {
      this._showFootprint(sel.cx, sel.cz, sel.size, 0xffe27a);
      if (sel.def.attack) this._showRange(sel.cx, sel.cz, sel.def.attack.range);
    }
  }

  _showFootprint(cx, cz, size, color) {
    this.game.renderer.toScene(cx, 0.03, cz, this.footprint.position);
    this.footprint.scale.set(size, 1, size);
    this.footprint.material.color.setHex(color);
    this.footprint.visible = true;
  }

  _showRange(cx, cz, range) {
    this.game.renderer.toScene(cx, 0.04, cz, this.rangeRing.position);
    this.rangeRing.scale.set(range, 1, range);
    this.rangeRing.visible = true;
  }
}

/** Tiles on a line from a to b (inclusive), stepping one tile at a time. */
export function lineTiles(a, b) {
  const tiles = [];
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.z - a.z));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    tiles.push({ x: Math.round(a.x + (b.x - a.x) * t), z: Math.round(a.z + (b.z - a.z) * t) });
  }
  return tiles;
}
