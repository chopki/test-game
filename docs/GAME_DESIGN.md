# Game Design

## Pitch

You are the lord of a small town in hostile lands. Each night (wave) raiders come for the **Town Hall**. You
protect it the way medieval towns did: with **walls** that shape where the enemy can go, and **towers** that punish
them for coming. In the long run the town grows an **economy**, trains **troops**, and is led by **heroes** (see the
[roadmap](ROADMAP.md)).

## Design pillars

1. **Walls are a real decision.** Enemies are never fully blocked. They weigh "walk around" against "break through",
   so wall layout is about shaping the cost of each route, not building a maze the AI can't solve.
2. **Readable at a glance.** The next wave's size, type and direction is shown during the build phase. Ranges,
   valid and invalid placement, and damage are always visible.
3. **Survival, not levels.** One map, endless escalating waves, score = waves survived.
4. **Systems that stack.** Every new feature (troops, heroes, economy) should create a new decision that interacts
   with walls and towers, not sit beside them.

## Core loop

```
 Build phase ──► Wave ──► Wave cleared (+gold bonus) ──► Build phase ...
  (countdown,     (enemies spawn from         │
   Space to        1–4 sides, path to Hall,   └─► Town Hall destroyed ──► Game over
   skip)           attack what blocks them)
```

- The map is a 40×40 tile grid. The outer 2 tiles are the **spawn zone**: enemies appear there and you can't build on it.
- The Town Hall (3×3) sits in the centre.
- A partly built fort stands round it at the start (`START_FORT` in config.js): a palisade ring 4–5 tiles out with a
  log gatehouse (twin open-topped towers over a wide gateway) in the south wall and an archer tower in the west wall, open at the north-east corner and beside
  the south-west corner. Enemies come in through the gaps until the player closes them. Starter buildings are free
  and sell for nothing; on maps where terrain is in the way, those pieces are left out.
- You can build and sell during waves too, except on tiles an enemy is standing on or stepping into.

## Enemy pathing: the "breach cost" rule

All enemies share one flow field (Dijkstra from the Town Hall outward). Free tiles cost their step length (1 or √2).
A tile with a building costs an extra `1 + hp × breachCostPerHp`, where `breachCostPerHp = 1/40`. A full-HP wall
(400 HP) therefore counts as roughly an 11-tile detour.

When an enemy's cheapest next step is into a building, it stops and attacks that building. Consequences:

- Short walls get walked around. Long walls, or a full enclosure, get attacked.
- Damaged walls get cheaper, so attackers converge on the breach.
- Enemies re-check their route after every hit: if another breach opens nearby, they switch to it.
- Diagonal movement only works through fully open corners, so diagonal wall lines are solid.
- Terrain (water, rock, forest) can never be entered or broken. Fords cost extra and slow enemies down.

The flow field is recomputed whenever buildings change and every 0.5s during waves, to pick up HP changes.

## Terrain

There are no roads: the map's terrain shapes the routes. Every game generates a new map from its seed (shown in
the Battle Chronicle; `?seed=N` in the URL replays it). Values live in `TERRAIN` in `config.js`.

| Terrain | Enemies | Building | Notes |
| ------- | ------- | -------- | ----- |
| Open ground | walk | yes | |
| Water (stream or lake) | blocked | no | |
| Ford | wade at 60% speed (+1.5 path cost) | no | shallow crossings of a stream |
| Rock | blocked | no | outcrops and ridges; walls join onto them |
| Forest | blocked | no | denser towards the map edge |

Enemies can't break terrain, so a full enclosure always includes some wall. Every generated map guarantees:

- an open area of 6 tiles around the Town Hall;
- every walkable tile can reach the hall;
- each spawn side keeps at least 8 reachable edge tiles (enemies only spawn on those);
- passages are at least 2 tiles wide, so one wall piece can't seal a gap;
- at least 65% of the buildable area is open.

## Buildings

Towers can be built **into a wall line**: the wall tiles under the tower are replaced, and their sell value
(50% of cost × HP fraction) counts towards the tower's price. The rest of the wall joins onto the tower, tied in
with an anchor post. Anything other than walls (another tower, the Town Hall) still blocks placement.
Hovering a wall tile with a tower selected snaps it into the wall: across the middle of a straight run (the wall
carries on from both sides), or onto a corner so both arms join it, preferring the side facing the Town Hall.
A tower in a straight run, on a corner or on a T-junction is drawn with its **in-wall model**: the palisade widens into a log
bastion around it (the watchtower rises out of it; the cannon and catapult stand on a planked rampart; the crystal
mound sits in a low ring), drawn on the wall line or on the corner or T junction (towers are 2 tiles wide and walls 1, so
it's drawn half a tile off its footprint; the footprint for the rules doesn't change). Other arrangements (a wall
alongside, a crossroads) keep the normal tower with anchor posts where the walls meet it.

| Building     | Size | Cost | HP   | Attack                                   | Notes |
| ------------ | ---- | ---- | ---- | ---------------------------------------- | ----- |
| Town Hall    | 3×3  | n/a  | 2500 | 8 dmg, range 5, 1 shot/s                 | Lose when destroyed |
| Castle Wall  | 1×1  | 10   | 400  | none                                     | Drag to plan a line (straight or L); snaps onto towers |
| Archer Tower | 2×2  | 75   | 300  | 14 dmg, range 7, 1.25 shots/s            | Homing arrows |
| Cannon Tower | 2×2  | 150  | 500  | 40 dmg splash r1.6, range 6, 0.45 shots/s | Fires at the ground where the target stood, so it can miss fast enemies |
| Magic Spire  | 2×2  | 125  | 350  | 12 dmg pulse to **all** enemies within 3.5, every 1.4s | Hit enemies are slowed to 60% speed for 1.5s. Best at chokepoints and wall breaches |
| Catapult     | 2×2  | 180  | 300  | 55 dmg splash r1.8, range 10, min range 3, every 3.5s | Long-range siege; can't hit anything closer than 3 tiles, so protect it |
| Gatehouse    | 2×2  | n/a  | 1200 | none                                     | Starting fort only (not buildable or sellable); blocks enemies while it stands, so they smash it or go round |

Towers target the enemy in range that is **closest to the Town Hall** by path distance.
Walls join visually with neighbouring walls and buildings (straight runs, corners and buttressed
junctions), so a line of walls ending at a tower reads as one fortification.
Selling refunds 50% of the cost × remaining HP fraction.

## Enemies

| Enemy        | HP  | Speed (tiles/s) | Damage / hit | Hit every | Gold | Threat | Appears from |
| ------------ | --- | --------------- | ------------ | --------- | ---- | ------ | ------------ |
| Goblin       | 60  | 1.6             | 8            | 1.0s      | 4    | 1      | wave 1 |
| Goblin Scout | 35  | 3.0             | 6            | 0.7s      | 3    | 1      | wave 2 |
| Orc Warrior  | 140 | 1.2             | 18           | 1.2s      | 8    | 2      | wave 3 |
| Troll        | 320 | 0.9             | 45           | 1.6s      | 15   | 5      | wave 4 |

**Elite Trolls** (gold crown, 1.3× size) join every 5th wave: ×1.5 HP, ×1.5 damage, ×3 gold.
(Internal ids: `grunt`, `runner`, `orc`, `brute`.)

## Waves

- Each wave has a threat budget: `round(4 + 4n + 0.4n²)`. See the Threat column above.
- Enemy HP scales by `+10%` per wave.
- Attack sides: 1 side for waves 1–2, 2 for waves 3–5, 3 for waves 6–9, and all 4 from wave 10.
- Spawns get closer together over time (gap ≈ `max(0.2, 1 − 0.04n)` seconds, ±40% jitter).
- Wave clear bonus: `30 + 10n` gold.

## Art direction

![Art style reference](reference/art-style.jpg)

The reference sheet above ([`docs/reference/art-style.jpg`](reference/art-style.jpg)) is the target look, including
the five-stage upgrade art for the Town Hall, towers and walls planned on the roadmap. Buildings are currently drawn
at **Stage 1**: the Town Hall is a small stone keep in a fenced yard, the Archer Tower a wooden watchtower, the Cannon
Tower a cannon on a low stone plinth, the Magic Spire a crystal-studded mound, the Catapult a plain wooden one, and
walls a log palisade. Later stages (stone walls and towers, the citadel) arrive with upgrades.

![UI style reference](reference/ui-style.jpg)

The UI follows [`docs/reference/ui-style.jpg`](reference/ui-style.jpg): bronze-framed plaques for Town Hall health
and gold, a wooden wave sign, arch-topped parchment tower cards with portraits and cost tags, bronze cog buttons,
a "Battle Chronicle" event scroll (desktop; toasts on small screens) and an "Engineer's Codex" panel for the
selected building. (The reference's Upgrade button and spells arrive with those features.)

Warm, storybook medieval: sandstone blocks, red clay roofs, half-timbered plaster, chunky crenellations,
green goblins and orcs, grey trolls. Terrain follows the reference's environment sheet: blocky olive oaks and
stepped pines, big flat-faced pale sandstone boulders, light straw-olive grass that's nearly flat colour with a fine painted grain, a faint tile grid over the
map, ink lines where kinds of ground meet, sparse dark grass clumps gathered by woods, rocks and water, bright turquoise water sunk below the grass with a brown earth bank on the far side, and strong dark
ground shadows. Sprites get a hand-drawn finish when baked: warm dark-brown ink outlines and inner lines, shading
pulled into soft bands, and light hatching in the shadows. Cloud shadows drift across the battlefield, and streams flow, with foam streaks running downstream round their
bends (lakes glint but stay still), and trees sway in gusts of wind. Battles kick up inked smoke and dust: arrow trails, cannon smoke, impact clouds,
splinters where enemies strike, and debris when a building falls. Damaged buildings and walls show it: soot and cracks below 2/3 health,
then holed roofs, broken stakes, smoke and flames below 1/3. Woods mix oaks, broad beeches, birch groves, pines
and tall spruces, with the odd dead tree.
Enemies are animated: they walk with a stride matched to their speed, wind up and swing their weapons in time
with their hits, and topple over when killed. Everything is built from code (procedural
textures in `render/textures.js`, models in `render/models.js`), so there are no asset files to manage.

## Economy (v0.1)

Deliberately minimal for now: one currency (gold), 300 to start, income from kills and wave bonuses.
This is the system planned to grow most. See the [roadmap](ROADMAP.md).

## Balance notes

All numbers live in [`src/sim/config.js`](../src/sim/config.js). Rough sanity checks from headless simulation:
an undefended town survives about 1 wave, and a naive bot that only spams towers (no walls) reaches about wave 26.
Balance hasn't been tuned against human play yet.
