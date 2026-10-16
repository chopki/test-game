import * as THREE from 'three';
import { BUILDINGS } from '../sim/config.js';
import { createBuildingModel } from '../render/models.js';

const OK_COLOR = 0x5fe36a;
const BAD_COLOR = 0xe35f5f;
const EDGE_MARGIN = 60; // px from the play-area edge where dragging a building scrolls the map
const EDGE_SPEED = 18; // scene units per second at the very edge
const TAP_SLOP = 12; // px a finger may move and still count as a tap

const isTouch = (ev) => ev.pointerType === 'touch' || ev.pointerType === 'pen';
const near = (a, b, dist) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= dist;

/**
 * Translates pointer input into world commands: placing buildings (with a ghost preview),
 * planning wall lines, selling, and selecting.
 *
 * mode: null (select), a building type (build), or 'sell'.
 *
 * Towers and other single buildings: a mouse click places immediately. On touch the finger moves a
 * pending placement, and the HUD shows ✓/✕ for it once the finger lifts.
 *
 * Walls: press and drag to plan a line (straight, or an L) from the start tile to the cursor,
 * snapping onto towers (see sim/wallPlanner.js). With a mouse it's built on release. On touch it waits
 * for ✓/✕, and either end of the line can be dragged again first.
 *
 * Dragging a pending placement or wall end to the screen edge scrolls the map.
 */
export class BuildController {
  constructor(game) {
    this.game = game;
    this.mode = null;
    this.selectedId = null;
    this.hover = null;
    this.pointer = null; // last mouse position (client px), for the desktop wall-cost tag
    this._rightDown = null;
    this._touch = null; // active single-finger touch: { id, x, y, tile, cancelled, grab }
    this._touchIds = new Set();
    this._usingTouch = false;
    this.pending = null; // touch placement of a single building awaiting ✓/✕: hovered tile { x, z }
    this.wallPlan = null; // wall line being planned: { from, to } tiles
    this._mouseWallDrag = false;
    this._finger = null; // screen position of the finger while it's dragging something

    const scene = game.renderer.scene;
    this.ghostMaterial = new THREE.MeshBasicMaterial({ color: OK_COLOR, transparent: true, opacity: 0.45, depthWrite: false });
    this.ghost = null;

    // Pool of translucent blocks previewing a planned wall line.
    this.wallGhostGeometry = new THREE.BoxGeometry(0.96, 1.1, 0.96).translate(0, 0.55, 0);
    this.wallGhostOk = new THREE.MeshBasicMaterial({ color: OK_COLOR, transparent: true, opacity: 0.45, depthWrite: false });
    this.wallGhostBad = new THREE.MeshBasicMaterial({ color: BAD_COLOR, transparent: true, opacity: 0.45, depthWrite: false });
    this.wallGhosts = new THREE.Group();
    scene.add(this.wallGhosts);

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
    // Pressing the right button while the left is held (a "chorded" press) fires no pointerdown,
    // only a mousedown, so listen for that to let right-click cancel a wall drag.
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2 && this._mouseWallDrag) {
        this._mouseWallDrag = false;
        this.wallPlan = null;
      }
    });
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
    this.wallPlan = null;
    this._mouseWallDrag = false;
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

  get _buildMode() {
    return !!(this.mode && BUILDINGS[this.mode]);
  }

  /** True while a finger is moving a pending placement or wall end (the ✓/✕ buttons are hidden then). */
  get draggingPending() {
    return !!this._touch?.grab && !this._touch.cancelled;
  }

  /** The current wall plan from the world, or null. */
  currentWallPlan() {
    return this.mode === 'wall' && this.wallPlan ? this.world.planWall(this.wallPlan.from, this.wallPlan.to) : null;
  }

  /**
   * What the ✓/✕ buttons are about, for touch: { ok, reason, cx, cz, height, label }, or null when
   * nothing is pending.
   */
  pendingInfo() {
    if (!this._usingTouch || !this._buildMode) return null;
    if (this.mode === 'wall') {
      const plan = this.currentWallPlan();
      if (!plan) return null;
      return { ...wallPlanStatus(plan), cx: plan.to.x + 0.5, cz: plan.to.z + 0.5, height: BUILDINGS.wall.height };
    }
    if (!this.pending) return null;
    const def = BUILDINGS[this.mode];
    const a = this.world.anchorFor(this.mode, this.pending.x, this.pending.z);
    return {
      ...this.world.canPlace(this.mode, a.x, a.z),
      cx: a.x + def.size / 2,
      cz: a.z + def.size / 2,
      height: def.height,
      label: `${def.cost}g`,
    };
  }

  /** Floating cost tag while dragging a wall with the mouse: { text, ok, x, y }, or null. */
  dragTag() {
    if (!this._mouseWallDrag || !this.pointer) return null;
    const plan = this.currentWallPlan();
    if (!plan) return null;
    const status = wallPlanStatus(plan);
    return { text: status.ok ? status.label : status.reason, ok: status.ok, ...this.pointer };
  }

  confirmPending() {
    if (!this._buildMode) return;
    if (this.mode === 'wall') {
      if (this._buildWallPlan()) this.wallPlan = null;
      return;
    }
    if (!this.pending) return;
    const a = this.world.anchorFor(this.mode, this.pending.x, this.pending.z);
    const result = this.world.place(this.mode, a.x, a.z);
    if (result.ok) this.pending = null;
    else this.game.hud?.toast(result.reason, 'warn');
  }

  cancelPending() {
    this.pending = null;
    this.wallPlan = null;
  }

  /** Build the current wall plan; returns false (with a toast) if nothing could be built. */
  _buildWallPlan() {
    const plan = this.currentWallPlan();
    if (!plan) return false;
    const status = wallPlanStatus(plan);
    if (!status.ok) {
      this.game.hud?.toast(status.reason, 'warn');
      return false;
    }
    const { built } = this.world.buildWall(plan);
    if (!plan.affordable) this.game.hud?.toast(`Not enough gold for the whole wall: built ${built}`, 'warn');
    return true;
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
      if (!t || t.id !== ev.pointerId || t.cancelled || !t.grab) return;
      this._finger = { x: ev.clientX, y: ev.clientY };
      this._moveGrabbedToFinger();
      return;
    }
    this.pointer = { x: ev.clientX, y: ev.clientY };
    if (this._mouseWallDrag && this.hover) this.wallPlan.to = this.hover;
  }

  _onPointerDown(ev) {
    this._usingTouch = isTouch(ev);
    if (isTouch(ev)) {
      this._onTouchDown(ev);
      return;
    }
    if (ev.button === 2) {
      // Right button cancels a wall drag straight away; a right *click* also leaves build mode (on up).
      if (this._mouseWallDrag) {
        this._mouseWallDrag = false;
        this.wallPlan = null;
      }
      this._rightDown = { x: ev.clientX, y: ev.clientY };
      return;
    }
    if (ev.button !== 0) return;
    this.hover = this._tileFromEvent(ev);
    this.pointer = { x: ev.clientX, y: ev.clientY };
    if (this.mode === 'wall') {
      if (!this.hover) return;
      this.wallPlan = { from: this.hover, to: this.hover };
      this._mouseWallDrag = true;
      return;
    }
    this._activate(this.hover);
  }

  _onTouchDown(ev) {
    this._touchIds.add(ev.pointerId);
    if (this._touchIds.size > 1) {
      // Second finger: it's a pinch/rotate gesture, not a tap or a drag.
      if (this._touch) this._touch.cancelled = true;
      this._finger = null;
      return;
    }
    const tile = this._tileFromEvent(ev);
    this.hover = tile;
    const t = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, tile, cancelled: false, grab: null };
    if (this._buildMode && tile) {
      // Grab = which thing the finger moves, and its tile offset from the finger, so a nudge doesn't
      // jump it under the finger (where it would be hidden).
      if (this.mode === 'wall') {
        const plan = this.currentWallPlan();
        let end = null;
        if (plan && near(tile, plan.to, 1)) end = 'to';
        else if (plan && near(tile, plan.from, 1)) end = 'from';
        if (end) {
          // Continue from the planned (possibly snapped) ends.
          this.wallPlan = { from: plan.from, to: plan.to };
        } else {
          this.wallPlan = { from: tile, to: tile };
          end = 'to';
        }
        t.grab = { end, dx: this.wallPlan[end].x - tile.x, dz: this.wallPlan[end].z - tile.z };
      } else {
        const size = BUILDINGS[this.mode].size;
        if (!this.pending || !near(this.pending, tile, size)) this.pending = { ...tile };
        t.grab = { end: null, dx: this.pending.x - tile.x, dz: this.pending.z - tile.z };
      }
      this._finger = { x: ev.clientX, y: ev.clientY };
    }
    this._touch = t;
  }

  _onPointerUp(ev) {
    if (isTouch(ev)) {
      if (!this._touchIds.delete(ev.pointerId)) return;
      const t = this._touch;
      if (t && t.id === ev.pointerId) {
        const moved = Math.hypot(ev.clientX - t.x, ev.clientY - t.y);
        const tap = !t.cancelled && !t.grab && moved < TAP_SLOP && ev.type === 'pointerup';
        if (tap) this._activate(t.tile);
        this._touch = null;
        this._finger = null;
      }
      return;
    }
    if (ev.button === 0 && this._mouseWallDrag) {
      this._mouseWallDrag = false;
      this._buildWallPlan();
      this.wallPlan = null;
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

  /** A click or tap on a tile: build, sell or select depending on the mode. */
  _activate(tile) {
    if (!tile) return;
    if (this.mode === 'sell') {
      const b = this.world.buildingAt(tile.x, tile.z);
      if (b && b !== this.world.townHall) this.world.sell(b.id);
      return;
    }
    if (this._buildMode) {
      const a = this.world.anchorFor(this.mode, tile.x, tile.z);
      const result = this.world.place(this.mode, a.x, a.z);
      if (!result.ok) this.game.hud?.toast(result.reason, 'warn');
      return;
    }
    const b = this.world.buildingAt(tile.x, tile.z);
    this.select(b ? b.id : null);
  }

  _moveGrabbedToFinger() {
    const t = this._touch;
    if (!t?.grab || !this._finger) return;
    const p = this.game.renderer.pickGround(this._finger.x, this._finger.y);
    if (!p) return;
    const { width, height } = this.world.grid;
    const tile = {
      x: THREE.MathUtils.clamp(Math.floor(p.x) + t.grab.dx, 0, width - 1),
      z: THREE.MathUtils.clamp(Math.floor(p.z) + t.grab.dz, 0, height - 1),
    };
    if (t.grab.end && this.wallPlan) this.wallPlan[t.grab.end] = tile;
    else this.pending = tile;
  }

  // While dragging something near the edge of the visible play area, scroll the map that way.
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
    this._moveGrabbedToFinger();
  }

  // ---------------------------------------------------------------- per-frame

  update(dt = 0) {
    const world = this.world;
    this._edgeScroll(dt);
    this.footprint.visible = false;
    this.rangeRing.visible = false;
    if (this.ghost) this.ghost.visible = false;
    this.wallGhosts.visible = false;
    this.game.renderer.grid.visible = this._buildMode;

    if (this.selectedId !== null && !this.selected) this.select(null);

    const plan = this.currentWallPlan();
    if (plan) {
      this._showWallPlan(plan);
    } else if (this._buildMode) {
      // With touch, the preview sits at the pending spot; with a mouse, wherever the cursor is.
      const tile = this._usingTouch ? (this.mode === 'wall' ? null : this.pending) : this.hover;
      if (tile) this._showGhost(tile);
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

  _showGhost(tile) {
    const def = BUILDINGS[this.mode];
    const a = this.world.anchorFor(this.mode, tile.x, tile.z);
    const { ok } = this.world.canPlace(this.mode, a.x, a.z);
    const color = ok ? OK_COLOR : BAD_COLOR;
    const cx = a.x + def.size / 2;
    const cz = a.z + def.size / 2;
    this.ghostMaterial.color.setHex(color);
    this.game.renderer.toScene(cx, 0, cz, this.ghost.position);
    this.ghost.visible = true;
    this._showFootprint(cx, cz, def.size, color);
    if (def.attack) this._showRange(cx, cz, def.attack.range);
  }

  _showWallPlan(plan) {
    const tiles = plan.tiles.filter((t) => !t.existing);
    while (this.wallGhosts.children.length < tiles.length) {
      this.wallGhosts.add(new THREE.Mesh(this.wallGhostGeometry, this.wallGhostOk));
    }
    this.wallGhosts.children.forEach((m, i) => {
      const t = tiles[i];
      m.visible = !!t;
      if (!t) return;
      m.material = t.ok ? this.wallGhostOk : this.wallGhostBad;
      this.game.renderer.toScene(t.x + 0.5, 0, t.z + 0.5, m.position);
    });
    this.wallGhosts.visible = true;
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

/** Summarise a wall plan for the UI: { ok, reason, label }. */
function wallPlanStatus(plan) {
  const label = `${plan.count} wall${plan.count === 1 ? '' : 's'} · ${plan.cost}g`;
  if (plan.count > 0) return { ok: true, reason: null, label };
  const blocked = plan.tiles.find((t) => t.reason);
  return { ok: false, reason: blocked?.reason ?? 'Already walled', label };
}
