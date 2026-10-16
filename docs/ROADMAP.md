# Roadmap

Rough order, with each milestone playable on its own. Checkboxes track progress.

## v0.1: Foundations (done)

- [x] 3D scene, camera controls, procedural models
- [x] Tile grid with placement validation and ghost preview
- [x] Town Hall, Castle Walls (drag to paint), Archer Tower, Cannon Tower
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

## v0.2: Defence depth

- [ ] **Upgrades**: tower levels (damage/range/rate), wall tiers (wood → stone → reinforced) with distinct models
- [ ] **Repair**: pay to restore HP between waves (or a slow auto-repair upgrade)
- [ ] **Gates**: walls your future troops can pass through but enemies can't
- [ ] More towers: mage (slow / damage over time), ballista (pierce)
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
- Map variety: terrain (rivers, cliffs, chokepoints), seeded maps
- Day/night cycle tied to the build/wave phases
- Sound and music
- Performance: instanced meshes for walls and enemies once counts get large
- Meta-progression between runs (unlocks)
