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
- [x] In-wall tower models for T-junctions (three-armed); in-wall towers now bake one bastion per type plus shared
      arm sprites, which halved the HD atlas (19 → 10 pages)
- [x] Combat effects: arrow trails, cannon smoke and flash, impact clouds with earth or rock thrown up, dust and
      splinters where enemies strike, a dust cloud and debris when a building falls (`particles.js`)
- [x] **Damage states**: three stages by health (`damage.js`: above 2/3, 1/3–2/3, below 1/3) drawn by the sprite
      shader, so no extra atlas space: soot and scorching and inked cracks, then pieces knocked out (more towards
      the top: broken stakes, holed roofs) with inked edges; badly damaged buildings smoke and burn, walls smoke.
      Repairs (see Repair) will put them back
- [x] Tree sway: tree tops sway in gusts of wind (a vertex shear on the sprite; slim birches most, dead trees barely)
- [x] Mixed woods: birch, spruce, beech and dead trees join the oaks and pines; pine woods and broadleaf woods by
      region, birch groves, a ragged mix where they meet; stumps and birches among the scenery outside the map
- [x] WebP atlas pages (6.1 MB of PNG → 1.5 MB) and an HD sprite set for desktops (2.5 MB), sharp when zoomed in
- [x] ~~AVIF atlas pages~~: tried and dropped. Re-encoding the pages saved 21–26% only at quality 75, which loses
      colour accuracy (~38 dB against today's pages) and, with lossy alpha, flips ~0.1% of edge pixels across the
      sprites' alpha cut-off; at a quality that matches today's look it's no smaller than WebP. It would also need a
      WebP fallback (iOS before 16.4) and a separate encoder in the bake (Chromium's canvas can't write AVIF)
- [x] Ground marks: worn earth round towers, scorch marks and craters where cannonballs and boulders land (fading
      after 45 s), plank footbridges across the fords (`groundMarks.js`, `bridges.js`; decoration only)
- [x] Footbridges only where a path leads on from both banks (the generator clears one through the woods)
- [x] Rivers more often (about 62% of maps, from 42%) and Settings → Rivers → Always for a stream on every new map
- [x] **Coast**: on about 35% of maps the sea lies along one edge behind a sandy beach, deepening out to an ocean
      on the horizon, with surf rolling in; no enemies come from the sea (Settings → Coast). Later: raiders
      landing from ships
- [x] **Bigger maps**: Settings → Map size: Small 40, Medium 52 (now the default), Large 64 tiles across; the camera
      zooms out further on bigger maps
- [x] **Hills**: on about 60% of maps, raised plateaus behind cliffs, climbed by ramps (slower going); towers on
      high ground reach further, and arrows shot uphill come slower (Settings → Hills). Cliff faces are baked
      sprites: rocky earth banks with boulders under a grass lip, and sloping sides beside the ramps
- [x] Warm colour grade and a soft glow on crystals, torches, braziers, lanterns and fires: Settings → Glow and
      colour, on with High (the grade is a CSS filter on the canvas, the halos one additive instanced draw)
- [x] **Varied wall tiles**: previously every wall tile of the same shape was the identical sprite, so long straight runs
      repeat every tile. Bake 3–4 variants per wall shape (different stake heights, lean and shades, grass tufts
      present or not and in different places) and pick one per tile from its position, so runs look hand-built
- [x] **Wall decorations**: about 1 in 6 straight wall tiles carries a prop, picked from its position: pennant pole,
      hanging banner, torch, brazier, shields, spears, ladder, supplies, firewood, alarm bell, lantern, bow and
      quiver, a crow, water buckets (`wallDecor.js`, baked for both wall directions)
- [x] **Living buildings**: pennants wave (the cloth is a 6-frame sprite of its own on the Town Hall, the gatehouse
      and pennant poles), the watchtower's lookouts turn to face their targets and scan the horizon when idle, the
      Town Hall has a smoking chimney, and crystals give off sparks. (Hanging banners still hang still.)
- [x] **Weather and seasons**: each map has a season (summer, autumn, winter) and weather that can change as each
      wave starts (clear or rain; clear or snowfall in winter). Autumn turns broadleaf woods orange, rust and gold
      and scatters leaves; winter lays patchy snow and settles it on every roof and treetop; rain falls in streaks,
      rings the water and darkens the ground and light. Looks only (`weather.js`, `weatherLayers.js`, sprite
      shader); Settings → Weather turns it off; `?season=` / `?weather=` force it. Ideas left: bare trees in winter,
      frozen lakes, puddles
- [x] **Wildlife**: inked flocks of birds cross the map (with shadows) and scatter when cannons fire or shots land
      near them; fish leap from streams and lakes with a splash; deer and rabbits graze at the woods' edge, away
      from the hall, and bolt into the trees when enemies come near, shots land close or something is built on
      their spot, coming back in quiet times (`wildlife.js`, `animals.js`; decoration only)
- [x] **Main menu and loading screen** (after `docs/reference/ui-menu.jpg`): parchment menu over the live map,
      the Royal Codex, an iron-framed loading screen with an ink sketch of the battleground and tactics tips; the
      HUD restyled in parchment and iron (phone title band, after `docs/reference/ui-hud-phone.jpg`). Later: the
      campaign, sound (and its mute button)
- [ ] **Models from our drawings (image-to-3D trial)**: send crops of `docs/reference/art-style.jpg` (Town Hall,
      catapult, watchtower, trees) to an image-to-3D service (open models such as Hunyuan3D-2 or TRELLIS, or Tripo /
      Meshy with an API key), restyle the returned `.glb` with our materials and bake it with our ink style, and add
      it as a column in the import-vs-procedural comparison. Needs the go-ahead to upload the art to a third party.
      (So far: Kenney CC0 imports, restyled, matched our palette on trees but lost to procedural on buildings and rocks)
      Tried: Hunyuan3D-2 from single crops (good outlines, guessed hidden sides, no texture from the free demo; the
      drawing projected on worked from the game's angle but not in walls, seasons or fixed-facing pieces), and an
      uploaded textured tower model (the closest; needs model-file support in the baker). A procedural stone tower
      built to its measured proportions got close (`createStoneTower`), and its ideas went into the model kit
- [x] **Worn detail on every model**: bevelled edges on all boxes, worn and uneven stone courses, rounded merlons,
      doors in arches of voussoirs; a worn-stone kit (painted rough stonework, quoins, deep windows, sloped doors,
      buttresses) and a procedural stone archer tower ready for the upgrade stages; on the wooden models, painted log grain, knots and bark,
      pale cut tips, rope-lashed palisades, knotted weathered planks and an iron-strapped, rope-lashed watchtower

## v0.2: Defence depth

- [x] Build towers into wall lines (replacing the wall tiles they cover), with joint pieces tying the wall in
- [x] **Upgrades, 5 stages each** (per the art reference): Town Hall, walls and every tower, capped at one stage
      above the Town Hall; the Engineer's Codex shows the next stage's gains, with Upgrade (U), Repair (between
      waves) and Upgrade the whole line for walls (`sim/upgrades.js`, `UPGRADES` in config.js)
- [ ] A model for each stage: wall stages wooden palisade → reinforced wood → dry stone → stone battlements →
      heavy citadel wall; towers and the hall growing in stone
- [x] **Starting fort**: the game opens with a partly built palisade round the Town Hall, a log gatehouse (twin
      open-topped towers and a walkway over a wide gateway) and an archer tower built into the wall
- [ ] Gatehouse as a buildable wall piece (today only the starting fort has one), and gates troops can use
- [x] **Repair**: pay to restore HP between waves
- [ ] **Gates**: walls your future troops can pass through but enemies can't
- [ ] More towers: ballista (pierce)
- [x] **Enemy redo**: a human army in squads (swordsmen, pikemen, archers, knights), battering rams and siege
      catapults with escorts. Archers and catapults stop and shoot from range (archers at towers, catapults at
      the wall in their way); siege engines hit buildings far harder than men. Everyone marches slower
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
