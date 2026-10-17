# Roadmap

Rough order, with each milestone playable on its own. Checkboxes track progress.

## v0.1: Foundations (done)

- [x] 3D scene, camera controls, procedural models
- [x] Tile grid with placement validation and ghost preview
- [x] Town Hall, Castle Walls (drag to plan a line, snaps to towers), Archer Tower, Cannon Tower
- [x] Flow-field pathing with breach cost: enemies walk around or smash through walls
- [x] Three enemy types plus elite boss waves, procedurally generated escalating waves from multiple sides
- [x] Gold from kills and wave bonuses, selling
- [x] HUD: resources, next-wave preview, build bar, selection info, toasts, game over, best-wave record
- [x] Headless, deterministic simulation with unit tests
- [x] Playable on phones: touch controls, responsive HUD, lighter graphics on touch devices
- [x] Published to GitHub Pages; errors and GPU resets are shown on screen
- [x] Graphics settings: Low/Medium/High presets with per-setting overrides, FPS cap and counter, auto step-down
      after a GPU crash
- [x] Touch placement with drag-to-position and ✓/✕ confirm; Playwright browser regression suite (manual in CI)
- [x] Art pass: procedural sandstone/clay/timber textures, new Town Hall and tower models, connecting walls,
      goblin/orc/troll enemies, varied scenery, merged meshes for performance
- [x] Magic Spire (area pulse + slow) and Catapult (long-range siege with minimum range); Orc Warrior enemy
- [x] Mobile art/performance pass 1: static shadow map + blob shadows (shadows on Low), automatic render scale,
      instanced walls/enemies/health bars

## Mobile look, pass 2 (done)

- [x] "Simple" lighting (Lambert materials) on Low and Medium, switchable live
- [x] Baked depth: vertex-colour shading darkening towards the ground, contact shading under buildings
- [x] Steeper, near top-down default camera like the reference (less sky and distant scenery to draw)
- [x] UI redesign after `docs/reference/ui-style.jpg`: framed health/gold plaques, wave sign, tower cards with
      rendered portraits, cog buttons, Battle Chronicle log, Engineer's Codex selection panel

## Painted look, phone-first (in progress)

Pre-rendered sprites on a fixed isometric camera (see ARCHITECTURE.md), working towards
`docs/reference/art-style.jpg` at phone-friendly frame rates.

- [x] Step 1: fixed iso camera, sprite baker + atlas, instanced sprite renderer, build-time `npm run bake`
- [x] Step 2: detailed models built from the reference drawings (Town Hall, towers, walls, scenery, enemies), assembled from the shared kit in `src/render/modelKit.js`
- [x] Step 3a: terrain rules in the sim: water, rock and forest block enemies and building, fords slow them,
      spawns only on reachable edge tiles, walls butt up against rock
- [x] Step 3b: seeded map generator (woods, outcrops and ridges, a stream with fords or a lake) with repair passes
      that guarantee connectivity, 2-tile-wide passages, a clear hall area and enough open land
- [x] Step 3c: painted ground per map (grass, forest floor, gravel, water and banks, no roads), terrain sprites,
      build-mode tint on unbuildable tiles, decorative woods outside the map
- [x] Step 3d: stamped ground detail (tufts, flowers, pebbles, leaves) and a water shimmer
- [x] Buildings remodelled as their Stage 1 designs from the reference (keep in a fenced yard, wooden
      watchtower, cannon on a low plinth, crystal mound, plain catapult, log palisade)
- [x] Hand-drawn look baked into every sprite (ink outlines and inner lines, banded warm shading, hatching)
      and drifting cloud shadows
- [x] Step 4: animated units (8 directions × 6 walk, 4 attack and 4 death frames, baked from posable rigs)
- [x] Towers built into walls: snapping (mid-run or corner) and dedicated in-wall models (log bastion + stubs)
- [x] Flowing water (streams flow off the map round their bends; ripples, foam streaks, shore foam), faster
      cloud shadows
- [x] Grass after the reference: straw-olive, fine grain, faint tile grid, inked edges, sparse clumps
- [x] Stage 1 palisade touch-ups: light tan ragged logs, one rail on the far face, props, grassy foot
- [x] Settings: New map button (shows the map number)

### Visual backlog (ideas agreed for later)

- [ ] **Wall-walk from Stage 2 walls up**: walls stay one tile thick, with the palisade or parapet on the outer edge
      and a raised plank walkway on the side facing the Town Hall (somewhere for troops to stand in v0.4). Needs
      each wall tile to know its inside (from the Town Hall direction, including inside and outside corners),
      which roughly doubles the wall sprites
- [ ] Plank-style "Wooden Wall" from the reference's asset sheet (flat boards, square posts, mossy base) as an
      alternative or a Stage 2 look
- [ ] In-wall tower models for T-junctions (today they keep the free-standing model with joint posts)
- [ ] Combat effects: arrow trails, cannon smoke, dust bursts when walls are hit, debris when a building falls
- [ ] **Damage states**: buildings and walls look more damaged the lower their health, in 3 baked stages per
      sprite (e.g. above 66%, 33–66%, under 33%): cracks and missing stones, broken or leaning stakes and gaps in
      palisades, holed roofs, scorch marks, then smoke and small fires at the lowest stage. Repairs (see Repair)
      put them back
- [ ] Tree sway (a small vertex wobble on tree sprites)
- [x] WebP atlas pages (6.1 MB of PNG → 1.5 MB) and an HD sprite set for desktops (2.5 MB), sharp when zoomed in
- [ ] Ground marks: worn earth round buildings, scorch marks where boulders land, bridges at fords
- [ ] Rivers more often (about half of maps have one today), or a map option to ask for one
- [ ] Warm colour grade and a soft glow on crystals and fire (High only)
- [x] **Varied wall tiles**: previously every wall tile of the same shape was the identical sprite, so long straight runs
      repeat every tile. Bake 3–4 variants per wall shape (different stake heights, lean and shades, grass tufts
      present or not and in different places) and pick one per tile from its position, so runs look hand-built
- [ ] **Living buildings**: flags and banners that wave in the wind, plus small idle animations on static
      buildings (smoke from the Town Hall chimney, a lookout turning in the watchtower, crystal sparkle), baked
      as a few looping frames
- [ ] **Weather and seasons**: rain (streaks, puddle ripples on water, darker grass), snow (white-dusted
      sprites and ground, snowfall), maybe autumn leaves; per map or changing between waves
- [ ] **Wildlife**: birds flying over (and scattering when cannons fire), fish jumping in streams and lakes, deer
      or rabbits at the woods' edge; decoration only, never in the way

## v0.2: Defence depth

- [x] Build towers into wall lines (replacing the wall tiles they cover), with joint pieces tying the wall in
- [ ] **Upgrades, 5 stages each** (per the art reference): Town Hall levels; Archer/Cannon/Spire/Catapult stages
      that improve stats and change the model; wall stages wooden palisade → reinforced wood → dry stone →
      stone battlements → heavy citadel wall
- [ ] Gatehouse wall piece (wall-to-gatehouse connection from the art reference)
- [ ] **Repair**: pay to restore HP between waves (or a slow auto-repair upgrade)
- [ ] **Gates**: walls your future troops can pass through but enemies can't
- [ ] More towers: ballista (pierce)
- [ ] Ranged enemies that out-range walls, and siege enemies that prioritise towers
- [ ] Balance pass against human play

## v0.3: Economy

- [ ] Multiple resources: gold, wood, stone (`cost` becomes an object)
- [ ] Production buildings: farm/mine/lumber camp generating resources per wave or over time, and themselves targets
      to protect
- [ ] Houses → population cap, which troops will consume
- [ ] Upkeep, so a bigger town costs more to run
- [ ] Town Hall upgrades unlocking new building tiers

## v0.4: Troops

- [ ] Barracks building that trains troops (swordsmen, archers)
- [ ] Rally points: click to set where troops gather
- [ ] Shared `combat` and `movement` modules for both factions (see [ARCHITECTURE.md](ARCHITECTURE.md#planned-extensions-and-where-they-plug-in))
- [ ] Enemies that fight troops they meet
- [ ] Simple formation / spacing so groups don't stack

## v0.5: Heroes

- [ ] One hero you control directly (click to move/attack)
- [ ] XP and levels from kills, stat growth
- [ ] 2–3 active abilities per hero (e.g. Rally Cry, Shield Bash, Arrow Volley) with cooldowns and a hotbar
- [ ] Hero respawns at the Town Hall after a delay when killed
- [ ] Multiple heroes to choose from at game start

## Later / ideas

- Save/load and continue run
- Map variety: more terrain (cliffs and raised ground, bridges), map size options, typing in a seed in the menu
- Day/night cycle tied to the build/wave phases
- Sound and music
- Performance: instanced meshes for walls and enemies once counts get large
- Meta-progression between runs (unlocks)
