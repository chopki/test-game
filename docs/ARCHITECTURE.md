# Architecture

## Overview

```
          ┌────────────── Game (src/game/Game.js) ───────────────┐
          │   main loop · keyboard · speed/pause · new game       │
          └──┬─────────────┬──────────────────┬──────────────────┘
             │ update(dt)  │ read state       │ read state
             ▼             ▼                  ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ World (sim)  │  │  Renderer    │  │     HUD      │
   │ pure JS, no  │  │  three.js    │  │  DOM overlay │
   │ three / DOM  │  └──────────────┘  └──────────────┘
   └──────▲───────┘          ▲  events          ▲ events
          │ commands         └──────────────────┴──── world.events
   ┌──────┴────────────┐
   │ BuildController   │  mouse → place / sell / select
   └───────────────────┘
```

**The single most important rule: `src/sim/` never imports three.js or touches the DOM.** The simulation is a
plain object you can `update(dt)` in Node. That's what makes it unit-testable (`test/`), and it leaves the door open
to a fixed-timestep server, replays or AI opponents later.

- **Sim → view** is pull-based: each frame the renderer walks `world.buildings`, `world.enemies` and
  `world.projectiles`, keeps one view per entity `id`, and creates or removes views as entities appear and disappear.
- **One-off happenings** (impacts, deaths, wave start) go through `world.events` (a tiny `EventBus`) and drive
  effects and toasts.
- **View → sim** goes only through `World` command methods: `place`, `sell`, `startWave`. Input code never mutates
  entity state directly.

## Modules

### `src/sim/`, the simulation

| File             | Responsibility |
| ---------------- | -------------- |
| `config.js`      | **All balance data**: grid, economy, timings, building and enemy tables, wave tuning |
| `World.js`       | Game state and rules: phases, placement, combat, enemy AI, projectiles, events |
| `Grid.js`        | Tile occupancy (building id per cell), footprints, spawn zone |
| `FlowField.js`   | Dijkstra distance-to-Town-Hall map with building "breach cost"; `nextStep()` for enemies |
| `WaveManager.js` | Procedural wave generation (`generateWave`) and the spawn queue |
| `Economy.js`     | Gold: `canAfford`, `spend`, `earn` |
| `EventBus.js`, `MinHeap.js`, `rng.js` | Utilities (`rng` is seeded, so tests are deterministic) |

Coordinates are in **tile units**. Tile `(x, z)` covers `[x, x+1) × [z, z+1)`. `x` runs west→east, `z` runs north→south.
Building centres are `(x + size/2, z + size/2)`.

Entities are plain objects (no classes) so they're easy to inspect and, later, serialise:

- **Building**: `{ id, type, def, x, z, size, cx, cz, hp, maxHp, cooldown, aim }`
- **Enemy**: `{ id, type, def, elite, x, z, tx, tz, target, hp, maxHp, attackTargetId, attackTimer, heading, moving, alive }`
  (`tx, tz` is the tile the enemy is committed to, `target` the tile it's walking into)
- **Projectile**: `{ id, kind, x, y, z, target?, damage, splash, t, flightTime, alive }`

`def` points at the entry in `config.js`, so behaviour is data-driven: anything with `def.attack` acts as a tower,
including the Town Hall.

**World events:** `goldChanged`, `buildingPlaced`, `buildingSold`, `buildingDestroyed`, `enemySpawned`,
`enemyKilled`, `projectileFired`, `projectileImpact`, `waveStarted`, `waveCleared`, `gameOver`.

### `src/render/`, presentation

- `Renderer.js`: scene, lights, terrain, `MapControls` camera, entity view sync, health bars, burst effects,
  ground picking (`pickGround` → sim coords).
- `LOW_POWER` (in `Renderer.js`): true on touch devices. It lowers pixel ratio, shadow-map size, scenery
  count and turns off anti-aliasing, because overloading a phone GPU makes the browser drop the WebGL context.
- `models.js`: procedural low-poly models. Scenery uses `InstancedMesh` (a few draw calls for every tree and rock). Geometries and materials are cached and shared.

The scene is centred on the grid: `scene = sim − (width/2, height/2)`. Use `renderer.toScene()` rather than doing
the maths by hand.

### `src/game/` and `src/ui/`

- `Game.js`: owns the World, Renderer, HUD and BuildController. Runs the `requestAnimationFrame` loop (dt clamped to
  0.1s; game speed runs extra sim steps rather than bigger ones) and handles keyboard shortcuts.
- `BuildController.js`: build mode, ghost preview, range ring, drag-to-paint walls, sell mode, selection.
- `HUD.js`: top bar, next-wave preview, build buttons (generated from `BUILDINGS`), info panel, toasts, overlays.

`window.game` is exposed in the browser for debugging, e.g. `game.world.economy.earn(1000)`.

## How to extend

### Add a building

1. Add an entry to `BUILDINGS` in `config.js` (`buildable: true`, a `hotkey`, and optionally `attack`).
2. Add a model function to `BUILDING_MODELS` in `render/models.js`. Put a `userData.turret` group on it if it should aim.

The build bar button, hotkey, placement, targeting and health bar all follow automatically.

### Add an enemy

1. Add an entry to `ENEMIES` (`threat`, `weight` and `minWave` control how it enters waves).
2. Add a model to `ENEMY_MODELS`. It needs a `userData.body` group for the walk and attack animation.

### Add a new kind of attack

Extend `_fire` / `_updateProjectile` in `World.js`, plus `createProjectileModel` and the impact effect in `Renderer.attach`.

## Planned extensions and where they plug in

- **Troops** (player units) will need a second entity list in `World`, a target-selection pass that can pick enemies,
  and enemies that can target troops. Plan: generalise "enemy attacks the building blocking its path" into a
  `faction`-aware combat module (`sim/combat.js`), and move movement into `sim/movement.js` so troops and enemies share it.
  Troops will use per-target A* (or a second flow field towards a rally point) rather than the shared Town Hall field.
- **Heroes** are troops with a level, XP and abilities. Abilities should be data in `config.js` with handlers in
  `sim/abilities.js`, triggered by World commands (`world.castAbility(heroId, abilityId, target)`).
- **Economy**: `Economy` grows into multiple resources (`{ gold, wood, stone, food }`) with `cost` objects in place of
  numbers. Production buildings tick in `World.update`. `canAfford` / `spend` already centralise every purchase.
- **Saving**: entities are plain data plus `type`, so a save is `{ buildings, wave, economy, rng state }`; re-attach `def`s
  from `config.js` on load.

See [ROADMAP.md](ROADMAP.md) for ordering.

## Testing

`npm test` runs Vitest against the simulation only:

- `flowfield.test.js`: routing around walls, breaching enclosures, corner-cutting
- `waves.test.js`: wave growth, boss waves, the spawn queue
- `world.test.js`: placement rules, selling, the auto-start timer, end-to-end "undefended falls" / "defended
  survives wave 1" / "enemies breach a full enclosure"

Rendering and input are checked by running the game. Keep new gameplay logic in `sim/` so it can be tested the same way.
