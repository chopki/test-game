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
| `Grid.js`        | Tile occupancy (building id per cell), terrain per cell (`isBlocked`, `isBuildable`), footprints, spawn zone |
| `terrain.js`     | Terrain types and the seeded map generator (`generateTerrain`): features, then repair passes; `analyzeTerrain` checks the map rules |
| `noise.js`       | Seeded value noise and fBm for the generator (and the ground painter) |
| `FlowField.js`   | Dijkstra distance-to-Town-Hall map with building "breach cost"; terrain can't be entered, fords cost extra; `nextStep()` for enemies |
| `WaveManager.js` | Procedural wave generation (`generateWave`) and the spawn queue |
| `Economy.js`     | Gold: `canAfford`, `spend`, `earn` |
| `wallPlanner.js` | Wall-line planning for the drag tool: straight/L path, snapping onto towers, per-tile validity, cost (`world.planWall` / `world.buildWall`) |
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

The battlefield is drawn like a classic isometric game: a **fixed iso camera** (`iso.js`) and **pre-rendered
sprites**. Every building, wall shape, turret direction, enemy direction and scenery piece is a 3D model
(`models.js`) rendered once, with soft shadows and studio lighting, into a sprite atlas (`spriteBaker.js`,
list of sprites in `spriteCatalog.js`). In game, `SpriteLayer` draws them all as instanced camera-facing quads,
so the whole battlefield is ~15 draw calls and a few hundred triangles however detailed the models are.

- **Baking is done ahead of time**: `npm run bake` (scripts/bake-sprites.mjs) renders the atlases in headless
  Chromium and writes `atlas.json` + WebP pages (lossless alpha) for each set in `SPRITE_SETS`: `public/sprites/`
  (standard, 72 px per tile) and `public/sprites-hd/` (144 px per tile for buildings, walls, towers, scenery and
  icons). Production builds load one (`spriteAssets.js`): desktops get HD, touch screens standard (a phone shows
  fewer pixels per tile than the standard set has, even zoomed in); `?sprites=standard|hd` overrides it.
  The dev server bakes live, so model edits show immediately. `test/sprites.test.js` fails when the atlas is
  stale (hash of the model/texture sources), so a deploy can't ship out-of-date sprites. A missing sprite at
  runtime falls back to a live bake.
- Sprite depth: each quad faces the camera, so it shares the depth of its ground anchor, which gives correct
  back-to-front occlusion without sorting. The ground doesn't write depth (so sprite bases aren't clipped);
  baked shadows, blob shadows, the grid and selection marks are drawn as underlays (`underlay()` in
  Renderer.js: blended in the opaque pass, renderOrder 1); sprites are renderOrder 2; live 3D projectiles,
  effects and the build ghost renderOrder 3.
- Moving parts get their own sprites: 16 turret aim directions (cannon, catapult × 4 arm reload frames), the
  spire crystal (bobbed by offset).
- Wall variants: each of the 16 wall shapes is baked in `WALL_VARIANTS` versions (`wall:<key>:<variant>`: stake
  heights, lean and shades, props and grass differ; logs and rails stay on the shared grid so they still join), and
  each tile picks one by a hash of its position (`wallVariant()` in Renderer.js), so long runs don't repeat.
- Wall joints: where a wall touches a tower or the Town Hall, `Renderer._drawWallJoints()` adds a `join:<dir>`
  sprite (the `wallJoint` model: a palisade arm into the building's edge tile, ending at an anchor post).
  `wallSeat.js` (pure, unit-tested) decides whether a tower sits in a wall: a straight run ('we'/'ns'), a
  corner ('wn', 'ws', 'en', 'es') or a T-junction ('wen', 'wes', 'nsw', 'nse'), plus the half-tile draw offset
  that puts it on the wall line or junction. Those towers use their in-wall model (`IN_WALL_MODELS` in models.js:
  a log bastion plus wall arms on the walls' log grid). For the atlas the two are baked apart: one bastion per type
  (`bw:<type>`, whatever the shape) and small shared arm sprites (`arm:<dir>:<bastion radius>:run|end`, centred on
  the arm so each sorts by its own depth), which `Renderer._drawWallArms()` lays out per shape. (Baking whole
  towers per shape filled ~6 of the HD set's pages.) In-wall turrets sit at their own heights (`turretHeight(type, shape)`).
  The renderer and the build preview both use it; other towers touching walls get joint pieces.
- **Animated enemies**: each enemy model is a rig (legs, body and arms as separate parts; see `models.js`) that
  `poseEnemy()` puts into baked frames: 6 walk, 4 attack and 4 death (`ENEMY_ANIMS`), for each of 8 headings.
  Sprite keys are `e:<type>[:elite]:<dir>:<anim>:<frame>`. The renderer advances walk frames by distance
  covered (`WALK_STRIDE`), takes attack frames from the sim's attack timer (the blow lands on the hit), and keeps
  killed enemies as corpses that play their death frames before vanishing.
- Atlas size: sprites can bake at their own resolution (`pxPerUnit` per spec: enemies 56, catapult frames 60,
  everything else 72), frames use tight bounds, and pages are packed tallest-first with the last page trimmed.
  ~680 sprites fit in about 2.5 pages of 2048².
- `Renderer.js`: scene, terrain, the iso `MapControls` camera (pan and zoom only), entity view sync into the
  sprite layers, health bars, burst effects, ground picking (`pickGround` → sim coords).
- `graphicsSettings.js`: graphics presets (Low/Medium/High), per-setting options, `startupSettings()` and
  `stepDown()` for after a GPU crash. Every launch starts on `STARTUP_PRESET` (High) and nothing is remembered between visits; the
  menu's "Reload now" carries the current settings through that one reload via `sessionStorage`. It has no
  three.js dependency and is unit-tested in `test/graphics.test.js`. `Renderer.applySettings()` applies everything
  live except anti-aliasing, which is fixed when the WebGL context is created. The frame-rate cap is enforced in
  `Game._frame`, and the menu is `ui/SettingsMenu.js`. When the context is lost, `Game` drops one preset
  automatically.
- `models.js`: the detailed models, built after `docs/reference/art-style.jpg`. They are only rendered when
  sprites are baked, so polygon count doesn't matter. Animated parts (`userData.turret`, `arm`/`ammo` on the
  catapult, `crystal` on the spire) stay separate and get their own sprites. Walls take
  `{ connections: { n, e, s, w } }`, and every shape is baked as `wall:<key>`.
- `modelKit.js`: the building blocks the models share. `Parts` merges primitives into one mesh per material and
  adds height-based ambient occlusion. The builders lay real masonry (`stoneBlocks`, `stoneRing`, with mortar gaps),
  `merlonsRect`/`merlonsRing`, shingled roofs (`shingleGable`, `shingleCone`), half-timbering (`timberFace`),
  windows, doors, wheels, barrels, banners and ground dressing. Stone, roof and other palettes are shared materials.
- `inkStyle.js`: the hand-drawn look, applied by the baker to every sprite (no runtime cost): ink outlines on the
  silhouette and on inner edges (found from extra normal and depth renders), shading flattened into soft bands,
  warmer shadows and light hatching. Pure pixel code, unit-tested in `test/inkStyle.test.js`; tune `INK_STYLE`.
- Flowing water: `waterFlow.js` (pure, unit-tested) gives each water tile a flow direction (streams run off the
  map from one edge to the other, round their bends; lakes are still). The water mesh carries it per corner, and
  its shader draws ripple bands and soft foam streaks carried downstream (`waterTextures.js`: streaks in R, noise
  in G), sun glints, and foam lapping at the shoreline (from the painted water mask). Its quads must stay wound
  to face up, or they're culled.
- Combat effects: `particles.js` draws soft inked puffs (smoke, dust, flashes, arrow trails) and tumbling debris
  chunks as two InstancedMeshes, refilled each frame. The renderer spawns them from world events
  (`projectileFired`, `projectileImpact`, `buildingHit` with the blow's origin, `buildingDestroyed`, `enemyKilled`);
  off with the Effects setting.
- Cloud shadows: `Renderer._createClouds()` draws one ground plane after the sprites that multiplies a drifting,
  tileable cloud mask (`cloudTexture()` in textures.js) into the frame. Shown with the Effects setting.
- Tree sway: `SpriteLayer.add(..., sway)` shears a sprite's top sideways in the vertex shader on a gusting wave
  (no extra frames or draw calls). Per-kind amounts are `SCENERY_SWAY` in models.js, scaled by `TREE_SWAY` in
  Renderer.js; woods mix kinds via `treeKind()`. Also off when Effects is off.
- `terrainPainter.js`: paints each map's ground into one canvas texture (`paintTerrain`). A low-res colour pass
  blends the terrain with noise for natural edges (forest floor, gravel, banks, water), then it's scaled up and
  small details are stamped in. Resolution and detail follow the Scenery setting (`GROUND_PX`, `GROUND_DETAIL`).
  The renderer adds a tree sprite per forest tile, an outcrop per rock tile, a water shimmer (one shader mesh
  over wet tiles) and the build-mode tint, all built in `Renderer._buildTerrain()` when a world is attached.
- `batches.js`: `HealthBarBatch` (all health bars in two draw calls) and `BlobShadowBatch` (unit shadows).
- `dynamicResolution.js`: the 'auto' render-scale controller (no three.js, unit-tested). `Game` feeds it the time
  between rendered frames and applies its result with `renderer.setRenderScale()`.
- `textures.js`: procedural canvas textures (sandstone, roof tiles, wood, half-timbering, grass, dirt). Each texture
  tiles once per world unit, and the geometry helpers in `modelKit.js` scale UVs to each primitive's real size. Geometries and materials are cached and shared.

The scene is centred on the grid: `scene = sim − (width/2, height/2)`. Use `renderer.toScene()` rather than doing
the maths by hand.

### `src/game/` and `src/ui/`

- `Game.js`: owns the World, Renderer, HUD and BuildController. Runs the `requestAnimationFrame` loop (dt clamped to
  0.1s; game speed runs extra sim steps rather than bigger ones) and handles keyboard shortcuts.
- `BuildController.js`: build mode, ghost preview, range ring, wall-line planning (mouse: built on release; touch:
  ✓/✕ with draggable ends), touch placement and edge scroll, sell mode, selection.
- `ui/press.js`: `onPress()` for HUD buttons. Touch presses fire on release instead of waiting for the browser's
  click, which Chrome can drop when a tap follows a canvas drag.
- `HUD.js`: the HUD (styled after `docs/reference/ui-style.jpg`): Town Hall health and gold plaques with a wave
  progress bar, the wave sign, tower cards generated from `BUILDINGS` with rendered portraits, cog buttons,
  the Battle Chronicle (event log; toasts on small screens), the Engineer's Codex (selection panel), overlays.

`window.game` is exposed in the browser for debugging, e.g. `game.world.economy.earn(1000)`.

## How to extend

### Add a building

1. Add an entry to `BUILDINGS` in `config.js` (`buildable: true`, a `hotkey`, and optionally `attack`). Attacks are
   data: `kind: 'pulse'` hits everything in range (Magic Spire), `minRange` makes a siege weapon, `splash` gives
   area damage, and `slow: { factor, duration }` slows what it hits.
2. Add a model function to `BUILDING_MODELS` in `render/models.js`, built with `Parts`. Put a `userData.turret`
   group on it if it should aim.

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

Keep new gameplay logic in `sim/` so it can be tested the same way.

`npm run test:e2e` runs the vital `@smoke`-tagged browser tests and `npm run test:e2e:full` the whole
Playwright suite, against the production build (`vite preview`), with WebGL on
SwiftShader so they work without a GPU (including on CI):

- `e2e/desktop.spec.js` (1280×800): HUD loads with no errors, hotkey + click placement, wall lines (cost tag, L-shape, snap to tower,
  right-click cancel),
  invalid-placement message, select + sell, right-click cancel, wave start, GPU context loss pause/recovery,
  on-screen error overlay
- `e2e/mobile.spec.js` (Pixel 7 profile): lighter graphics and HUD fit, touch placement (drag without moving the map,
  ✓ builds, re-drag keeps the finger offset, ✕ cancels, invalid ✓), edge-scroll while dragging, wall lines with ✓ and
  snapping a dragged end onto a tower,
  one-finger pan and tap-to-select

Tests drive the game through real input and read state through `window.game`, e.g. `game.renderer.toScreen()` to
find where a tile is on screen. Shared helpers, including CDP-based touch drags, are in `e2e/helpers.js`. On push,
CI runs only the unit tests. The browser tests are slow, so they run on demand: locally, or via the manual
"Browser tests (manual)" workflow, which uploads the Playwright report with screenshots and traces when a test fails.
