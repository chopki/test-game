import * as THREE from 'three';
import { BUILDINGS } from '../sim/config.js';
import { createBuildingModel } from '../render/models.js';

const OK_COLOR = 0x5fe36a;
const BAD_COLOR = 0xe35f5f;
const EDGE_MARGIN = 60; // px from the play-area edge where dragging a building scrolls the map
const EDGE_SPEED = 18; // scene units per second at the very edge
const TAP_SLOP = 12; // px a finger may move and still count as a tap

const isTouch = (ev) => ev.pointerType === 'touch' || ev.pointerType === 'pen';

/**
 * Translates pointer input into world commands: placing buildings (with a
 * ghost preview and drag-to-build walls), selling, and selecting.
 *
 * mode: null (select), a building type (build), or 'sell'.
 *
 * Mouse: click places immediately. Touch: for buildings other than walls, the finger
 * moves a pending placement; the HUD shows ✓/✕ buttons for it once the finger lifts,
 * and dragging it to the screen edge scrolls the map.
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
    this._touch = null; // active single-finger touch: { id, x, y, tile, cancelled, grab }
    this._touchIds = new Set();
    this._usingTouch = false;
    this.pending = null; // touch placement awaiting ✓/✕: hovered tile { x, z }
    this._finger = null; // screen position of the finger while it's dragging the pending building

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
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e));
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
    this.pending = null;
    // On touch screens one finger pans the camera, except while building or selling, when it places.
    this.game.renderer.controls.touches.ONE = mode ? null : THREE.TOUCH.PAN;
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

  /** True while a finger is moving the pending building (the ✓/✕ buttons are hidden then). */
  get draggingPending() {
    return !!this._touch?.grab && !this._touch.cancelled;
  }

  /** Placement check for the pending touch placement: { ok, reason, cx, cz, height }. */
  pendingInfo() {
    if (!this.pending || !this._placesWithConfirm()) return null;
    const def = BUILDINGS[this.mode];
    const a = this.world.anchorFor(this.mode, this.pending.x, this.pending.z);
    return { ...this.world.canPlace(this.mode, a.x, a.z), cx: a.x + def.size / 2, cz: a.z + def.size / 2, height: def.height };
  }

  confirmPending() {
    if (!this.pending || !this._placesWithConfirm()) return;
    const a = this.world.anchorFor(this.mode, this.pending.x, this.pending.z);
    const result = this.world.place(this.mode, a.x, a.z);
    if (result.ok) this.pending = null;
    else this.game.hud?.toast(result.reason, 'warn');
  }

  cancelPending() {
    this.pending = null;
  }

  // Touch placement of towers etc. goes through ✓/✕; walls are painted directly.
  _placesWithConfirm() {
    return !!(this.mode && BUILDINGS[this.mode] && this.mode !== 'wall');
  }

  // ---------------------------------------------------------------- input

  _tileFromEvent(ev) {
    const p = this.game.renderer.pickGround(ev.clientX, ev.clientY);
    return p ? { x: Math.floor(p.x), z: Math.floor(p.z) } : null;
  }

  _onPointerMove(ev) {
    this._usingTouch = isTouch(ev);
    this.hover = this._tileFromEvent(ev);
    if (isTouch(ev)) {
      const t = this._touch;
      if (!t || t.id !== ev.pointerId || t.cancelled) return;
      if (t.grab) {
        this._finger = { x: ev.clientX, y: ev.clientY };
        this._movePendingToFinger();
        return;
      }
      if (!this.hover) return;
      // Dragging a finger in wall mode paints walls, starting from where the finger went down.
      if (this.mode === 'wall' && !this.dragging) {
        this.dragging = true;
        this.lastDragTile = t.tile;
      }
    }
    if (this.dragging && this.mode === 'wall' && this.hover) {
      // Fill every tile between the last placed wall and the cursor so fast drags leave no gaps.
      for (const t of lineTiles(this.lastDragTile ?? this.hover, this.hover)) this.world.place('wall', t.x, t.z);
      this.lastDragTile = this.hover;
    }
  }

  _onPointerDown(ev) {
    this._usingTouch = isTouch(ev);
    if (isTouch(ev)) {
      this._touchIds.add(ev.pointerId);
      if (this._touchIds.size > 1) {
        // Second finger: it's a pinch/rotate gesture, not a tap or a drag.
        if (this._touch) this._touch.cancelled = true;
        this.dragging = false;
        this._finger = null;
        return;
      }
      const tile = this._tileFromEvent(ev);
      this.hover = tile;
      const t = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, tile, cancelled: false, grab: null };
      if (this._placesWithConfirm() && tile) {
        const size = BUILDINGS[this.mode].size;
        const near = this.pending && Math.max(Math.abs(this.pending.x - tile.x), Math.abs(this.pending.z - tile.z)) <= size;
        // Grabbing the pending building moves it relative to the finger (so the finger doesn't hide it);
        // touching elsewhere moves it straight there.
        if (!near) this.pending = { ...tile };
        t.grab = { dx: this.pending.x - tile.x, dz: this.pending.z - tile.z };
        this._finger = { x: ev.clientX, y: ev.clientY };
      }
      this._touch = t;
      return; // acted on at pointerup (tap) or pointermove (drag)
    }
    if (ev.button === 2) {
      this._rightDown = { x: ev.clientX, y: ev.clientY };
      return;
    }
    if (ev.button !== 0) return;
    this.hover = this._tileFromEvent(ev);
    this._activate(this.hover);
    if (this.mode === 'wall' && this.hover) {
      this.dragging = true;
      this.lastDragTile = this.hover;
    }
  }

  _onPointerUp(ev) {
    if (isTouch(ev)) {
      if (!this._touchIds.delete(ev.pointerId)) return;
      const t = this._touch;
      if (t && t.id === ev.pointerId) {
        const moved = Math.hypot(ev.clientX - t.x, ev.clientY - t.y);
        const tap = !t.cancelled && !t.grab && !this.dragging && moved < TAP_SLOP && ev.type === 'pointerup';
        if (tap) this._activate(t.tile);
        this._touch = null;
        this._finger = null;
        this.dragging = false;
        this.lastDragTile = null;
      }
      return;
    }
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

  _movePendingToFinger() {
    const t = this._touch;
    if (!t?.grab || !this._finger) return;
    const p = this.game.renderer.pickGround(this._finger.x, this._finger.y);
    if (!p) return;
    const { width, height } = this.world.grid;
    this.pending = {
      x: THREE.MathUtils.clamp(Math.floor(p.x) + t.grab.dx, 0, width - 1),
      z: THREE.MathUtils.clamp(Math.floor(p.z) + t.grab.dz, 0, height - 1),
    };
  }

  // While dragging a building near the edge of the visible play area, scroll the map that way.
  _edgeScroll(dt) {
    if (!this.draggingPending || !this._finger) return;
    const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
    const bottom = document.getElementById('buildbar')?.getBoundingClientRect().top ?? window.innerHeight;
    const { x, y } = this._finger;
    const push = (dist) => Math.max(0, 1 - dist / EDGE_MARGIN);
    const right = push(window.innerWidth - x) - push(x);
    const forward = push(y - top) - push(bottom - y);
    if (right === 0 && forward === 0) return;
    this.game.renderer.pan(forward * EDGE_SPEED * dt, right * EDGE_SPEED * dt);
    this._movePendingToFinger();
  }

  /** A click or tap on a tile: build, sell or select depending on the mode. */
  _activate(tile) {
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
      return;
    }
    const b = this.world.buildingAt(tile.x, tile.z);
    this.select(b ? b.id : null);
  }

  // ---------------------------------------------------------------- per-frame

  update(dt = 0) {
    const r = this.game.renderer;
    const world = this.world;
    this._edgeScroll(dt);
    this.footprint.visible = false;
    this.rangeRing.visible = false;
    if (this.ghost) this.ghost.visible = false;

    if (this.selectedId !== null && !this.selected) this.select(null);

    // With touch, towers preview at the pending spot; with a mouse, wherever the cursor is.
    const previewTile = this._usingTouch && this._placesWithConfirm() ? this.pending : this.hover;
    if (this.mode && BUILDINGS[this.mode] && previewTile) {
      const def = BUILDINGS[this.mode];
      const a = world.anchorFor(this.mode, previewTile.x, previewTile.z);
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
