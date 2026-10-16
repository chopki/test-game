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

The flow field is recomputed whenever buildings change and every 0.5s during waves, to pick up HP changes.

## Buildings

| Building     | Size | Cost | HP   | Attack                                   | Notes |
| ------------ | ---- | ---- | ---- | ---------------------------------------- | ----- |
| Town Hall    | 3×3  | n/a  | 2500 | 8 dmg, range 5, 1 shot/s                 | Lose when destroyed |
| Castle Wall  | 1×1  | 10   | 400  | none                                     | Drag to plan a line (straight or L); snaps onto towers |
| Archer Tower | 2×2  | 75   | 300  | 14 dmg, range 7, 1.25 shots/s            | Homing arrows |
| Cannon Tower | 2×2  | 150  | 500  | 40 dmg splash r1.6, range 6, 0.45 shots/s | Fires at the ground where the target stood, so it can miss fast enemies |
| Magic Spire  | 2×2  | 125  | 350  | 12 dmg pulse to **all** enemies within 3.5, every 1.4s | Hit enemies are slowed to 60% speed for 1.5s. Best at chokepoints and wall breaches |
| Catapult     | 2×2  | 180  | 300  | 55 dmg splash r1.8, range 10, min range 3, every 3.5s | Long-range siege; can't hit anything closer than 3 tiles, so protect it |

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
the five-stage upgrade art for the Town Hall, towers and walls planned on the roadmap.

![UI style reference](reference/ui-style.jpg)

The UI follows [`docs/reference/ui-style.jpg`](reference/ui-style.jpg): bronze-framed plaques for Town Hall health
and gold, a wooden wave sign, arch-topped parchment tower cards with portraits and cost tags, bronze cog buttons,
a "Battle Chronicle" event scroll (desktop; toasts on small screens) and an "Engineer's Codex" panel for the
selected building. (The reference's Upgrade button and spells arrive with those features.)

Warm, storybook medieval: sandstone blocks, red clay roofs, half-timbered plaster, chunky crenellations,
round leafy trees and pines, green goblins and orcs, grey trolls. Everything is built from code (procedural
textures in `render/textures.js`, models in `render/models.js`), so there are no asset files to manage.

## Economy (v0.1)

Deliberately minimal for now: one currency (gold), 300 to start, income from kills and wave bonuses.
This is the system planned to grow most. See the [roadmap](ROADMAP.md).

## Balance notes

All numbers live in [`src/sim/config.js`](../src/sim/config.js). Rough sanity checks from headless simulation:
an undefended town survives about 1 wave, and a naive bot that only spams towers (no walls) reaches about wave 26.
Balance hasn't been tuned against human play yet.
