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

Maps come in three sizes (Settings → Map size, for new maps): **Small** 40 × 40 tiles, **Medium** 52 × 52 (the
default) and **Large** 64 × 64. Bigger maps give more room to build and longer marches for the enemy.

There are no roads: the map's terrain shapes the routes. Every game generates a new map from its seed (shown in
the Battle Chronicle; `?seed=N` in the URL replays it). Values live in `TERRAIN` in `config.js`.

| Terrain | Enemies | Building | Notes |
| ------- | ------- | -------- | ----- |
| Open ground | walk | yes | |
| Water (stream or lake) | blocked | no | |
| Ford | wade at 60% speed (+1.5 path cost) | no | shallow crossings of a stream |
| Rock | blocked | no | outcrops and ridges; walls join onto them |
| Forest | blocked | no | denser towards the map edge |
| Sea | blocked | no | along one edge on coastal maps; no enemies come from it |
| Beach (sand) | walk | yes | 1–2 tiles between the sea and the land |
| Cliff | blocked | no | the rim of a plateau, standing one level above the ground below |
| Ramp | walk at 75% speed (+0.5 path cost) | no | 2 tiles wide; the only way up or down a level |

About 62% of maps have a stream (crossed at 1–2 fords, each with a way on cleared through any woods or rock on both banks, at least 3 tiles); the rest may have a lake. Settings → Rivers → Always gives
every new map a stream.

About 35% of maps have a **coast**: the sea along one edge (5–7.5 tiles deep, with coves and headlands) behind a
sandy beach. No attacks come from the sea, so there's one side less to defend; a stream that reaches the coast runs
out to sea. Settings → Coast → Never / Sometimes / Always.

About 60% of maps have **hills**: raised plateaus (level 1, sometimes with a level-2 top) ringed by cliffs and
climbed by 1–2 ramps each, kept 2+ tiles from the Town Hall's open area and 3 from the map edge. Walkable ground of
different levels only meets at a ramp. A tower reaches **+1 range per level** it stands on; a building's footprint
must sit on one level ("Uneven ground" otherwise). Arrows shot **up** at higher ground (by towers or enemy archers) reload 50% slower per level up (two-thirds the rate of fire); shooting down is unaffected. Each level is 0.85 units high. Settings → Hills → Never /
Sometimes / Always.

Enemies can't break terrain, so a full enclosure always includes some wall. Every generated map guarantees:

- an open area of 6 tiles around the Town Hall;
- every walkable tile can reach the hall;
- each land side keeps at least 8 reachable edge tiles (enemies only spawn on those; the coast side has none);
- passages are at least 2 tiles wide, so one wall piece can't seal a gap;
- at least 65% of the buildable land is open (the sea doesn't count).

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
| Barracks     | 2×2  | 120  | 450  | none (trains troops)                     | Trains a man every 8s (2 Men-at-arms, 1 Bowman) up to 3; see Troops |
| Gatehouse    | 2×2  | n/a  | 1200 | none                                     | Starting fort only (not buildable or sellable); blocks enemies while it stands, so they smash it or go round |

Towers target the enemy in range that is **closest to the Town Hall** by path distance.
Walls join visually with neighbouring walls and buildings (straight runs, corners and buttressed
junctions), so a line of walls ending at a tower reads as one fortification.
Selling refunds 50% of everything spent on the building (build plus upgrades) × remaining HP fraction (the
starting fort was free, so only its upgrades count).

### Upgrades

Select a building and press **Upgrade** (or <kbd>U</kbd>): towers, walls and the Town Hall have **five stages**.
Each costs gold and improves the stats below (unlisted stats carry on); a building keeps the damage it has taken
and gains the extra health. **Nothing may stand more than one stage above the Town Hall**, so the hall's upgrades
open the way. A selected wall offers **Upgrade the whole line**: every joined wall at the same stage, as far as the
gold goes. **Repair** (between waves only) restores full health for 40% of all the building cost × the damage
taken (the Town Hall is reckoned at 400).

| Building | Stage 2 | Stage 3 | Stage 4 | Stage 5 |
| -------- | ------- | ------- | ------- | ------- |
| Town Hall | Stone Keep · 200 · 3200 HP, 11 dmg | Fortified Keep · 350 · 4000 HP, 14 dmg, range 5.5 | Castle · 550 · 5000 HP, 18 dmg | Citadel · 800 · 6200 HP, 24 dmg, range 6 |
| Castle Wall | Reinforced Palisade · 8 · 600 HP | Dry Stone Wall · 14 · 900 HP | Stone Battlements · 22 · 1300 HP | Citadel Wall · 34 · 1800 HP |
| Archer Tower | Guard Tower · 60 · 380 HP, 18 dmg | Stone Tower · 100 · 480 HP, 22 dmg, range 7.5 | Arrow Keep · 150 · 600 HP, 28 dmg, 1.4 shots/s | Royal Tower · 220 · 760 HP, 36 dmg, range 8 |
| Cannon Tower | Gun Platform · 110 · 620 HP, 52 dmg | Stone Battery · 170 · 760 HP, 64 dmg, range 6.5, splash 1.8 | Bombard Tower · 240 · 920 HP, 80 dmg, every 2.0s | Great Bastion · 320 · 1100 HP, 100 dmg, range 7, splash 2.1 |
| Magic Spire | Rune Circle · 90 · 430 HP, 15 dmg | Mage Spire · 140 · 520 HP, 19 dmg, range 4 | Arcane Tower · 200 · 620 HP, 24 dmg, slows to 50% for 1.8s | Starfall Spire · 280 · 740 HP, 30 dmg, range 4.5 |
| Catapult | Reinforced Catapult · 130 · 370 HP, 70 dmg | Mangonel · 200 · 450 HP, 88 dmg, range 11 | Trebuchet · 280 · 540 HP, 110 dmg, splash 2.1 | Great Trebuchet · 380 · 650 HP, 140 dmg, range 12, every 3.1s |

Stage 1 names: Timber Hall, Wooden Palisade, Watchtower, Cannon Emplacement, Crystal Cairn, Catapult.

## Troops

The player's soldiers wear **red** (with straw-gold trim); the enemy army wears **blue** (with cream). The colours
are hints, not whole uniforms: a tabard, a cape and stripe, a shield's face, a plume. Troops are the same men as the
enemy's, so later both castles can field the same army.

A **Barracks** trains one man every 8 s, in roster order (Man-at-arms, Man-at-arms, Bowman), until 3 of its men are
alive; a fallen man is replaced the same way. Its men stand at its **post**, 2 tiles out from its door on the side
away from the Town Hall, and run themselves (no orders yet): they go out to fight any enemy within **5 tiles of the
post**, give up a chase more than 7 tiles from it, and walk back when none are left, healing 4 HP/s at the post.
They walk their own way (A* round walls; they can pass the gatehouse, not other buildings). A Barracks walled in
with no way out trains no one. Selling or losing a Barracks dismisses its men.

| Troop       | HP  | Speed | Damage | Hit every | Reach |
| ----------- | --- | ----- | ------ | --------- | ----- |
| Man-at-arms | 110 | 1.3   | 9      | 1.0s      | melee |
| Bowman      | 60  | 1.25  | 8      | 1.3s      | 4.5   |

Enemy men stop to fight a soldier who comes within 0.9 tiles (or strikes them), holding them up while the towers
work; enemy archers with no building to shoot shoot soldiers in range. Siege engines ignore soldiers, but soldiers
hack at them. Towers never target soldiers.

## Conquest (castle against castle)

Picked on the main menu (or `?mode=conquest`). A big map, 72 × 112 tiles, mirrored end to end (tile (x, z) matches
(71 − x, 111 − z)), so neither side has the easier ground: open meadows broken up by groves (45% of the map, from a
noise field), a castle clearing at each end, and three **lanes** between them (west, middle, east), crossed halfway
by a stream with fords where the lanes meet it, and rocks and camp clearings in the woods. The lanes aren't roads:
they're only carved as narrow gaps through the groves (out in the open there's no telling where one runs, and there
are other ways round); they're the routes the squads march by. Each map has one of three **layouts**: *The Three Roads* (the side lanes run
up the map's edges), *The Crossing* (the side lanes swing in to meet the middle one at a crossroads by the stream)
and *The Winding Way* (the middle lane zigzags; the stream bends more). Each side's half has two low, square-cut
**plateaus** (a cliff round the rim, cleared ground round the cliff), one on the west lane and one on the middle
(mirrored onto the east and middle of the other half), which the lanes climb by ramps: towers up there reach
further, and arrows shot up at them reload slower (see Terrain). **Red** (you) holds the
south end, **blue** (the AI) the north.

- **Forts**: both start the same, mirror images: the Town Hall, and on each lane a Barracks (10% of the way along it)
  and two Archer Towers (17% and 33%). Blue's buildings fly blue banners and pennants and their lookouts wear blue.
- **Waves**, in real time: the dial counts down 25 s to the first, then 40 s between them (two taps on the dial send
  the next at once, for both sides). Each wave, **every Barracks on both sides sends a squad** down its lane (a
  Barracks you build joins the nearest lane): 2 Men-at-arms and 1 Bowman, +1 Man-at-arms every 3 waves and +1
  Bowman every 4, and from wave 5 a Knight (+1 every 4 waves), up to 8 men, with +4% health a wave. Siege engines
  come on top: a **Battering Ram** in wave 4 and every 3rd wave after, a **Siege Catapult** in wave 7 and every 3rd
  after. Siege engines only attack buildings (the catapult from 8 tiles); soldiers attack them.

  | Soldier        | HP  | Speed | Damage | Hit every | Reach | Gold to the other side |
  | -------------- | --- | ----- | ------ | --------- | ----- | ---------------------- |
  | Man-at-arms    | 110 | 1.3   | 9      | 1.0s      | melee | 6  |
  | Bowman         | 60  | 1.25  | 8      | 1.3s      | 4.5   | 5  |
  | Knight         | 260 | 1.0   | 16     | 1.3s      | melee | 14 |
  | Battering Ram  | 480 | 0.6   | 80     | 2.2s      | melee, buildings only | 20 |
  | Siege Catapult | 220 | 0.55  | 65     | 5s        | 8, buildings only     | 20 |
- **Squads** march their lane to the enemy's Town Hall. They fight enemy soldiers within 4.5 tiles (chasing up to
  7), then enemy buildings beside the lane (not walls), and break through any enemy wall in their way. A man struck
  by a sword turns to fight back. Towers shoot the nearest enemy soldier in range; your towers never hit your men.
- **Building**: anywhere within 7 tiles of one of your own buildings (walls don't count), so your ground grows as
  you build out along the lanes. You can't sell, upgrade or repair the enemy's buildings.
- **Gold**: both sides start with 250 and earn 1.5 a second, plus 6 for each enemy Man-at-arms, 5 per Bowman and 40
  per building (not walls) that falls. Repairs can be made at any time, but not within 5 s of a hit.
- **The AI** (blue) thinks every 2.5 s and spends its gold through the same commands as you, one thing a turn, in
  this order: more Barracks (one more allowed every 2½ minutes) on the lane with fewest; its Town Hall's next stage
  (due every 2 minutes a stage, and saved up for unless red soldiers are deep in its half); once red soldiers come
  within half the map of its hall on a lane, a wall across that lane, a fifth of the way out, with a 3-tile gap in
  the middle (its own squads use the gap; attackers are funnelled through it or must break the wall); Archer Towers
  on the lane where red soldiers have come nearest its hall (or the lane with fewest towers); and the weakest tower
  on that lane up a stage (towers can go one stage above its hall, as yours can).
- **Heroes**: a champion each side, the crowned elite of its kind of soldier in its side's colours. You choose
  yours when you start a Conquest (the AI picks its own at random). Health and damage +12% a level.

  | Hero | Yours / theirs | HP | Damage | Hit every | Reach | Speed | Q | E |
  | ---- | -------------- | -- | ------ | --------- | ----- | ----- | - | - |
  | Knight | Sir Aldric / Lord Vane | 650 | 26 | 1.0s | melee | 1.45 | War Cry | Charge |
  | Ranger | Mira / Sable | 430 | 22 | 1.1s | 6 | 1.6 | Volley | Fleet Foot |
  | Warden | Captain Bram / Captain Hask | 820 | 20 | 1.1s | 1.1 | 1.3 | Shield Wall | Rally |

  - **War Cry** (30 s): the hero and every ally within 4.5 tiles heal 25% and move and strike 1.35× as fast for 6 s.
  - **Charge** (18 s): at a foe within 6 tiles: rushes it 3× as fast (1.5 s) and its next blow does 3× damage.
  - **Volley** (16 s): arrows on the foe it's fighting (or the nearest within 7): 70 damage to every foe within 2.2.
  - **Fleet Foot** (20 s): the hero moves 1.8× as fast for 4 s.
  - **Shield Wall** (28 s): the hero and every ally within 4.5 take half damage for 6 s.
  - **Rally** (35 s): the hero heals 40%.
  - **Orders**: tap the hero cog (or press <kbd>G</kbd>), then tap the map: on the ground to send them there (they
    hold that spot, fighting anything that comes within 5 tiles and chasing it up to 6 from the spot; a tap in the
    woods sends them to the nearest open ground), on an enemy soldier or building to attack it. With no orders they
    wait by their hall's door. Abilities on the two buttons beside the cog, or <kbd>Q</kbd> and <kbd>E</kbd>. They
    heal 6% a second within 7 tiles of their own hall.
  - **XP**: when a foe falls within 7 tiles, the hero earns its gold worth as XP (a soldier's reward, 40 for a
    building, 120 for the other hero). Levels at 60, 150, 280, 450, 670, 950, 1300, 1720 and 2200 XP (level 10).
  - **Falling**: the other side gets 120 gold; the hero is back at its hall after 20 s + 4 s a level, with its
    level and XP.
  - Blue's hero (the AI) goes with its most advanced soldier on the lane where it has most men, falls back to its
    hall below 30% health, and uses its abilities when they'd help (a war cry or shield wall in a fight among
    friends, a charge at a foe a little way off, a volley on three or more foes, fleet foot or rally when hurt).
- **Neutral camps**: two clearings in each half's woods, joined to a lane by a trail, each held by three bandits in
  grey (2 Men-at-arms, a Bowman). They keep to their camp (chasing no further than 6 tiles from it, healing 12 a
  second there) and fight anyone who comes within 3 or strikes one of them (the whole camp turns on whoever did);
  the lane squads march past them, so it's heroes who clear them. Each bandit is worth 2.5× his gold reward (and
  that in hero XP) to the side that fells him. A cleared camp fills again after 90 s, 5% stronger for each minute
  of the battle.
- **Winning**: bring down the blue Town Hall. Lose yours and it's over.
- **Minimap** (under the Town Hall): the whole map in the battlefield's angle, both sides' buildings and soldiers
  as red and blue, and a frame round what you're looking at. Press or drag on it to look there.

## Enemies

A human army in blue-and-cream livery, marching in **squads**. Men walk to the Town Hall and hack at whatever
blocks their way (walls, towers, the gatehouse); ranged enemies stop and shoot from range instead. Siege engines
hit buildings far harder than men. Damage is against buildings, and against the player's troops (see Troops).

| Enemy          | HP  | Speed (tiles/s) | Damage / hit | Hit every | Range | Gold | Threat | Squad | Appears from |
| -------------- | --- | --------------- | ------------ | --------- | ----- | ---- | ------ | ----- | ------------ |
| Swordsman      | 70  | 1.1             | 6            | 1.0s      | melee | 4    | 1      | 3–5   | wave 1 |
| Pikeman        | 100 | 0.95            | 5            | 1.1s      | melee | 5    | 1      | 3–4   | wave 2 |
| Archer         | 45  | 1.05            | 3            | 1.6s      | 5     | 4    | 1      | 3–4   | wave 3 |
| Battering Ram  | 450 | 0.55            | 90           | 2.2s      | melee | 18   | 6      | 1 + 2 Swordsmen | wave 4 |
| Knight         | 240 | 0.9             | 12           | 1.3s      | melee | 12   | 4      | 1–2   | wave 5 |
| Siege Catapult | 220 | 0.5             | 70           | 5s        | 8     | 20   | 7      | 1 + 2 Pikemen   | wave 6 |

- **Archers** shoot the nearest tower in range; if none, whatever blocks their route once it's in range. Towers
  out-range them (archer tower 7, archers 5).
- **Siege Catapults** batter the wall (or gatehouse, or tower) blocking their route from 8 tiles, else the
  nearest tower. Only the player's Catapult (range 10) out-ranges them.
- Enemy shots hit only the building they're aimed at.

**Elite Knights** (warlords: gold crown, 1.3× size) join every 5th wave as a squad of `n / 5`: ×1.5 HP,
×1.5 damage, ×3 gold.
(Internal ids: `swordsman`, `pikeman`, `archer`, `ram`, `knight`, `mangonel`.)

## Waves

- Each wave has a threat budget: `round(4 + 4n + 0.4n²)`, filled with squads (each squad one type, from one
  side; siege engines bring their escort). See the Threat and Squad columns above.
- Enemy HP scales by `+10%` per wave.
- Attack sides: 1 side for waves 1–2, 2 for waves 3–5, 3 for waves 6–9, and all 4 from wave 10.
- A squad's men step out side by side, 0.25 s apart. Squads follow each other every `max(1.5, 4 − 0.15(n − 1))`
  seconds (±30% jitter).
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

![Menu and loading screen reference](reference/ui-menu.jpg)

The menus and HUD dress follow [`docs/reference/ui-menu.jpg`](reference/ui-menu.jpg) and
[`docs/reference/ui-hud-phone.jpg`](reference/ui-hud-phone.jpg): hand-inked parchment with dark iron trim. The
**main menu** is a parchment page with the crest (shield, crossed swords, title ribbon) and plank buttons
(Campaign, coming later; Continue; Endless Mode, or New Battle once one is under way; the Royal Codex of every tower
and foe; Options), the live battlefield showing through it as its picture. The **loading screen** is an
iron-framed page: the coming wave and its approach, an ink sketch of the generated battleground with the first
wave's arrows, its name ("The River Crossing"…), a lore & tactics tip and a progress bar. The battle HUD keeps the middle of
the map clear (after the C and D concepts): the Town Hall's health as a ring round its portrait and the gold top left,
the wave dial (time to the next wave, then the wave's progress; tap it twice to send the next wave early) with what's coming top right, settings and help
under it, the time controls (send wave, pause, speed) bottom left, and the **build wheel** bottom right: a hammer
that fans the towers out on a quarter circle (open on wide screens, on demand on phones, folding away once a tower
is picked). A selected building's card (stage, stats now → next, Upgrade, Repair, Sell) takes the bottom of the
screen.
(There is no sound yet, so the reference's mute button waits for it.)

Warm, storybook medieval: sandstone blocks, red clay roofs, half-timbered plaster, chunky crenellations,
an enemy army of men in blue-and-cream livery (steel helms, round and kite shields, pikes, bows) with hide-roofed
battering rams and wheeled catapults. Terrain follows the reference's environment sheet: blocky olive oaks and
stepped pines, big flat-faced pale sandstone boulders, light straw-olive grass that's nearly flat colour with a fine painted grain, a faint tile grid over the
map, ink lines where kinds of ground meet, sparse dark grass clumps gathered by woods, rocks and water, bright turquoise water sunk below the grass with a brown earth bank on the far side, and strong dark
ground shadows. Sprites get a hand-drawn finish when baked: warm dark-brown ink outlines and inner lines, shading
pulled into soft bands, and light hatching in the shadows. Cloud shadows drift across the battlefield, and streams flow, with foam streaks running downstream round their
bends (lakes glint but stay still), and trees sway in gusts of wind. Battles kick up inked smoke and dust: arrow trails, cannon smoke, impact clouds,
splinters where enemies strike, and debris when a building falls. Damaged buildings and walls show it: soot and cracks below 2/3 health,
then holed roofs, broken stakes, smoke and flames below 1/3. Towers wear the ground bare round them, shots leave scorch marks and
craters that fade, and plank footbridges cross the fords (decoration: wading speed is unchanged). On High, a warm colour
grade and soft glows round crystals, torches and fires. Pennants wave, watchtower lookouts turn to
face their targets, the Town Hall's chimney smokes and crystals sparkle. Each map has a season (summer, autumn leaves, winter
snow) and weather that can change between waves (rain, snowfall); it's looks only and never changes the battle. Birds fly
over and scatter at cannon fire, fish leap in the streams, and deer and rabbits graze at the woods' edge until the
fighting comes near. Woods mix oaks, broad beeches, birch groves, pines
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
