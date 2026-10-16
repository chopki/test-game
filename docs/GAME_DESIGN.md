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

## Buildings (v0.1)

| Building     | Size | Cost | HP   | Attack                                   | Notes |
| ------------ | ---- | ---- | ---- | ---------------------------------------- | ----- |
| Town Hall    | 3×3  | n/a  | 2500 | 8 dmg, range 5, 1 shot/s                 | Lose when destroyed |
| Castle Wall  | 1×1  | 10   | 400  | none                                     | Drag to plan a line (straight or L); snaps onto towers |
| Archer Tower | 2×2  | 75   | 300  | 14 dmg, range 7, 1.25 shots/s            | Homing arrows |
| Cannon Tower | 2×2  | 150  | 500  | 40 dmg splash r1.6, range 6, 0.45 shots/s | Fires at the ground where the target stood, so it can miss fast enemies |

Towers target the enemy in range that is **closest to the Town Hall** by path distance.
Selling refunds 50% of the cost × remaining HP fraction.

## Enemies (v0.1)

| Enemy  | HP  | Speed (tiles/s) | Damage / hit | Hit every | Gold | Appears from |
| ------ | --- | --------------- | ------------ | --------- | ---- | ------------ |
| Raider | 60  | 1.6             | 8            | 1.0s      | 4    | wave 1 |
| Scout  | 35  | 3.0             | 6            | 0.7s      | 3    | wave 2 |
| Ogre   | 320 | 0.9             | 45           | 1.6s      | 15   | wave 4 |

**Elite Ogres** (gold crown, 1.3× size) join every 5th wave: ×1.5 HP, ×1.5 damage, ×3 gold.

## Waves

- Each wave has a threat budget: `round(4 + 4n + 0.4n²)`. Raiders and Scouts cost 1, Ogres cost 5.
- Enemy HP scales by `+10%` per wave.
- Attack sides: 1 side for waves 1–2, 2 for waves 3–5, 3 for waves 6–9, and all 4 from wave 10.
- Spawns get closer together over time (gap ≈ `max(0.2, 1 − 0.04n)` seconds, ±40% jitter).
- Wave clear bonus: `30 + 10n` gold.

## Economy (v0.1)

Deliberately minimal for now: one currency (gold), 300 to start, income from kills and wave bonuses.
This is the system planned to grow most. See the [roadmap](ROADMAP.md).

## Balance notes

All numbers live in [`src/sim/config.js`](../src/sim/config.js). Rough sanity checks from headless simulation:
an undefended town survives about 1 wave, and a naive bot that only spams towers (no walls) reaches about wave 26.
Balance hasn't been tuned against human play yet.
