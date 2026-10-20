# Buildings across the games

What each game builds, what the buildings cost and do, the patterns worth stealing, and a proposed building list
for our game. Majesty 1's full catalogue is in [01-majesty.md](01-majesty.md#4-the-palace-and-building-tiers) and
Majesty 2's in [02-majesty-2.md](02-majesty-2.md). Data files: [Thronefall](data/thronefall.json),
[Majesty 1](data/majesty1-buildings.json). † marks general knowledge rather than a pulled source.

## 1. What buildings are for

| Role | What it does | Examples |
| ---- | ------------ | -------- |
| **Seat** | Lose when it falls; sets the tier; houses the workers | Majesty Palace, Kingdom town centre, Thronefall Castle Center, DK Dungeon Heart, Stronghold Keep, our Town Hall |
| **Attractor / home** | Brings in a kind of unit and houses it | Majesty guilds and temples, DK rooms (a Library brings Warlocks), Crown of Greed HQs, Kingdom vagrant camps, Dungeon Village houses |
| **Service** | Agents visit it to get stronger or recover; usually income too | Majesty Blacksmith, Marketplace, Inn, Library; DK Hatchery, Lair, Training Room; Dungeon Village shops; Darkest Dungeon hamlet |
| **Economy** | Makes gold directly | Majesty Marketplace and Trading Post; Kingdom farms; Thronefall houses, mills, harbours, mines; Stronghold farms and chains |
| **Defence** | Shoots, blocks or slows | Towers, walls, gates, barricades, traps; DK Guard Post; our towers and walls |
| **Military production** | Makes the player's soldiers | Thronefall Barracks and Archery Range; Kingdom Rush barracks; Stronghold Barracks; our Barracks |
| **Research / buff** | Permanent or timed upgrades | Thronefall Royal Forge; Majesty Library; DK Library and Workshop |
| **Identity** | A pick that excludes others | Majesty temples and racial homes; Majesty 2 temples on Holy Ground |
| **Mood / loyalty** | Changes how agents behave | Majesty Statues and Royal Gardens (loyalty); Stronghold "good things" and "bad things" (fear factor); DK Temple, Casino |
| **Consequence** | Appears by itself because of what you did | Majesty Houses, Fountains, Sewers, Graveyards, Elven Lounge; DK Graveyard (vampires) |
| **Logistics** | Moves or stores value | Majesty tax drop-offs (Guardhouse, Outpost); DK Treasure Room capacity; Kingdom banker; caravans |

## 2. Per game

### Crown of Greed (2026)

- **The castle** (lose when it falls) and a tax collector who carries gold to it or to guard towers.
- **Hero headquarters** such as Barracks (warriors) and a Hunter's Camp. **Each HQ has its own hero limit, and an
  upgrade raises it by one**, so a second Barracks means two more warriors.
- **Economic**: marketplace, tavern, trading post (trade with other regions), inn (rest and a buff), forge
  (blacksmith), alchemist.
- **Defensive**: guard towers. **Duplicates cost much more** than the first copy (a fan guide).
- Some buildings unlock automatically as the settlement grows. A fan wiki of uncertain origin also lists arenas and
  libraries.

### Kingdom series

Everything sits on a 2D line: the town centre in the middle, walls spreading outwards on dirt mounds, towers on
fixed spots.

| Structure | Cost (coins) | Notes |
| --------- | ------------ | ----- |
| **Town centre** | campfire → 6–7 tiers | Each tier unlocks vendors: bows and hammers at the campfire, scythes at wooden fortifications, pikes or dojo at stone fortifications, shields and the bomb at the keep |
| **Wall tier 1 → 5** | 1, 3, 5, 8, 12 (rebuild a stump: 1, 2, 3, 5, 6) | HP 25 / 50 / 100 / 150 / 200; +30% with the building statue's blessing; resists decay 2 / 4 / 8 / 12 / 20 days. Norse birch and pine walls have half the HP |
| **Archer tower** | 3 to build, "expensive to upgrade" | 1–4 archers; greedlings can't reach them, but **floaters pluck archers off unroofed towers**, so roofs matter later |
| Hermit conversions of a tier-3+ tower | 15–18 (6 in New Lands) | **Ballista** (one builder, ~5 s reload, heavy damage), **Fire tower** (flasks plus fire arrows leave burning ground), **Knight tower** (one extra squad leader), **Bakery** (bread lures vagrants out of their camps), **Stable** (from a mill house, 8: houses mounts) |
| **Catapult** | 6 | From the siege workshop; one per side, pushed to the outer wall, 1–2 builders crew it; fire barrels later |
| **Farm** | small | On a stream; a well waters 4 plots, a mill house 6; nothing grows in winter |
| **Statues** | gems to unlock, coins to bless | Archery, building, farming… blessings |
| **Bomb** | 18 at the iron keep | Three builders push it into the Greed's cave: the end-game assault |

Lessons: **conversion instead of new builds** (a hermit turns an existing tower into something new), **walls that
decay while you're away**, and **costs in single digits**, so every coin counts.

### Dungeon Keeper 1 / 2

Rooms are painted tile by tile. **Size and shape matter**: a room's **efficiency** rises with neighbouring
same-room tiles and walls, which raises its capacity and speed.

| Room | Cost | Does | Attracts (DK1) |
| ---- | ---- | ---- | -------------- |
| Treasure Room | 50 a tile | Stores gold (more per tile when efficient) | Demon Spawn (+ Training), Dragon (25 tiles + Lair 15) |
| Lair | 300 / 150 (DK2) | Sleep, heal, calm down; needs space for every creature | Beetle (1), Spider (+ Hatchery 9), Bile Demon (25), Tentacle (+ Temple) |
| Hatchery | 300 / 150 (DK2) | Chickens to eat | Spider |
| Training Room | per tile | XP, costing gold per 64 turns per creature | Orc (9 + Barracks), Demon Spawn |
| Library | per tile | Research spells and rooms | Warlock (9) |
| Workshop | per tile | Traps and doors | Troll (1) |
| Prison / Torture | 750 / 375 (DK2) | Keep, convert or break enemies; deaths make Skeletons or Ghosts | Mistress (Torture 9), Ghost |
| Temple | per tile | Prayer calms; sacrifices | Tentacle, Horned Reaper |
| Graveyard | per tile | Corpses rot → Vampires (every 10) | Vampire (30 + Lair 9) |
| Scavenger Room | per tile | Lures other keepers' creatures | Hellhound (9) |
| Guard Post, Barracks, Bridge | per tile | Posts, squads, lava and water crossings | Orc (Barracks) |
| DK2: Casino, Combat Pit, Guard Room… | | Casino payout lever: win back wages or buy happiness | Rogue, Black Knight, Dark Elf |

Lessons: **room size as a recruitment threshold** ("build a 25-tile Lair to get Bile Demons") is a tidy, readable
rule; efficiency rewards tight layouts.

### Thronefall

Fixed build spots; gold paid each morning by buildings that survived; **a pick of one in four at most build or
upgrade steps**.

| Building | Cost (L1 / L2 / L3) | HP | Gives |
| -------- | ------------------- | -- | ----- |
| Castle Center | 3 / 7 / 20 | 100 / 300 / 700 | Shoots (0.25 → 1 per s); L2 and L3 each a pick from 4 king or economy upgrades |
| House | 2 / 2 | 20 / 30 | 1 / 2 gold a night |
| Mill (+ fields) | 3 / 4 / 6 | 30 / 50 / 80 | 1 / 2 / 6 a night; pick: Improved Plow, **Explosive Trap** (explodes when destroyed), **Scarecrows** (anti-air), **Wind Spirits** (block arrows) |
| Fishing Harbour | 3 / 7 | 60 / 120 | +1 boat a night up to 5; 1 gold a boat (2 at L2): **grows over time** |
| Gold Mine | 5 | 20 | 6 gold, then 1 less each night: **front-loaded** |
| Tower | 3 / 5 / 15 | 100 / 250 | 8 damage, range 36; L2 pick: Castle / **Sniper** (biggest and siege) / **Armoured** (lowest HP and flying) / Bunker (random); L3 pick: extra arrow / ballistic / fire and oil / **healing** |
| Wall | 3–5 (15) / 5–7 (20) | 240 / 640 | Blocks |
| Barricade | – | indestructible | Slows, doesn't block |
| Barracks / Archery Range | 4 / 8 / 16 | 30 / 40 / 50 | 4 / 8 / 12 units of **one type you choose for good** |
| Royal Forge | 4 / 9 / 16 | 80 | 1 / 2 / 3 picks of melee or ranged attack or resistance research, taking 2–3 days |
| Shrine | 3 | 777 | **Must be activated by 350 HP of enemies dying nearby**, then shoots and pays 2 a night |
| Hero's Quarters | – | – | One hero unit that grows with upgrades |

Lessons: **picks at every level** keep a small catalogue fresh, **time-shaped income** (mines fall off, harbours
grow) creates investment timing, and **destruction effects** (Explosive Trap) make losing a building interesting.

### Kingdom Rush

Four tower types on fixed plots; three levels, then **a fork into two specialisations**.

| Tower | Cost | Damage | Rate | Notes |
| ----- | ---: | ------ | ---- | ----- |
| Archer Tower L1 | 70 | 4–6 | 0.8 s | Physical (armour reduces it) |
| Militia Barracks L1 | 70 | 1–3 | 1.0 s | 3 soldiers, 50 HP, respawn 10 s, **rally point** |
| Mage Tower L1 | 100 | 9–17 | 1.5 s | Magic (magic resistance reduces it) |
| Dwarven Artillery L2 | 220 | 20–40 | 3.0 s | Splash |
| → Rangers Hideout / Musketeer Garrison | 230 / 230 | 13–19 (0.4 s) / 35–65 (1.5 s, extreme range) | | Archer branches |
| → Holy Order / Barbarian Mead Hall | 230 / 230 | 12–18 / 16–24 | | Paladins 200 HP 50% armour, heal; barbarians 250 HP |
| → Arcane Wizard / Sorcerer Mage | 300 / 300 | 76–140 / 42–78 | 2.0 s / 1.5 s | Death ray, or summons an elemental and strips armour |
| → Big Bertha / Tesla x104 | 400 / 375 | 50–100 / 30–55 | 3.5 s / 2.25 s | Missiles, or chain lightning |

Upgrades sell back for part of their cost. Stars buy permanent upgrades per tower line.

### Stronghold †

The Keep (the lord lives there, stores gold, spawns peasants at its campfire). Walls, towers and gatehouses (troops
climb walls for height). Military: Armoury, Barracks, Siege Camp, Engineer's Guild. Defences: ballista, mangonel,
braziers, oil, pitch ditches, killing pits, moats, war dogs. Civil: Granary (rations), farms, bakery chains, weapon
workshops, stockpile, mines, quarries, hovels (housing), apothecary, market, inn (ale coverage), **Chapel 250 /
Church 500 / Cathedral 1000** (each 25% blessed gives +2 popularity, up to +8). **Fear-factor buildings**: each
"good thing" per 16 people gives +1 popularity but −10% production and −5% troop damage; each "bad thing" the
reverse (from ±1 up to ±5).

### Dungeon Village

Shops, eateries, inns, houses, trees, flowers and paths on a grid. Each building has **price, quality and appeal**.
Buildings **level up after enough adventurer visits** (then you remodel), and items raise their stats. **Area
boost**: plants raise neighbours' price and quality, buildings raise appeal, within one tile. **Every building has
upkeep**, so building too much loses money. New buildings unlock with town stars.

## 3. Patterns worth stealing

| Pattern | Where | Use for us |
| ------- | ----- | ---------- |
| **Buildings recruit agents** | Majesty, DK, Crown of Greed | Guilds bring heroes; the Hall brings henchmen |
| **Size as a threshold** | DK rooms | e.g. a larger Chapel yard brings a knight order (or a simpler "level 2 guild") |
| **A pick at each build or upgrade** | Thronefall (1 of 4), Kingdom Rush (level-4 fork), Kingdom hermits | Our 5-stage upgrades could fork at stage 3 or 4 |
| **Conversion** | Kingdom hermits | A found "specialist" (engineer, priest, master smith) converts a tower or shop |
| **Pays only if it survives** | Thronefall | Dawn income only from standing shops: defends the economy, not just the Hall |
| **Time-shaped income** | Thronefall mine (falls off) and harbour (grows) | A mine near a lair (high, falling) against a farm (slow, steady) |
| **Destruction effects** | Majesty Mausoleum (horde), Thronefall Explosive Trap | Make a fallen building matter: a burning granary, a smashed shrine angers the gods |
| **Activation by fighting nearby** | Thronefall Shrine | Bait defences: an old watchtower that wakes after blood is spilt |
| **Target-type towers** | Thronefall Sniper and Armoured towers | Tower stage picks that change targeting (biggest, flyers, siege) |
| **Placement rules** | Majesty market spacing, M2 Holy Ground, Kingdom mounds, fixed slots | Spacing rules for shops, special sites for temples |
| **Adjacency** | Dungeon Village area boost, DK efficiency | Market squares (shops near a well earn more) |
| **Repeat cost growth** | Majesty (×1.1 … ×4), Crown of Greed | Keep for guilds; not for walls |
| **Mood buildings** | Stronghold fear factor, Majesty statues | Taverns against stocks: hero loyalty against speed |
| **Consequence buildings** | Majesty sewers, houses, fountains | Growth that stirs danger, and growth that rewards |

## 4. Proposed buildings for Realm mode

Costs on Hold the Hall's scale (start 300; archer tower 75). Starting values to tune in `config.js`. **Keep** all of
today's buildings and add:

| Building | Role | Cost (copies) | HP | Levels | Notes |
| -------- | ---- | ------------- | -- | ------ | ----- |
| Town Hall (existing) | Seat | – | 2500 → | 5 stages | Stages also need heroes recruited (2 / 5 / 9 / 14); spawns builders and collectors (1 per stage) |
| Walls, towers, gatehouse (existing) | Defence | as now | as now | as now | Night raids still come through the flow field |
| **Men-at-arms Hall** | Guild | 80 (×2) | 600 | 2 | 4 Men-at-arms (45 each); L2: 5, unlocks Muster (recall) |
| **Rangers' Lodge** | Guild | 70 (×2) | 300 | 2 | 4 Rangers (35); L2: Move Lodge |
| **Rogues' Den** | Guild | 60 (×2) | 300 | 2 | 4 Rogues (28); L2: Extort; makes gambling dens appear with a tavern |
| **Smithy** | Service | 50 | 300 | 3 | Research gear tiers (20 / 30 / 40), heroes buy (10–90); −5% building costs |
| **Market** | Service / economy | 150 (×1.3, spaced) | 250 | 3 | 12–25 per tick; potions (L1), charms (L2), ward-amulets (L3); Market Day |
| **Inn** | Service | 40 (×1.1) | 150 | 1 | Rest and heal away from guilds; small income; forward base near lairs |
| **Watch House** | Defence / logistics | 60 (×1.25) | 250 | 2 | Two watchmen; **tax drop-off**; peasant refuge |
| **Faith (pick one)**: Chapel of the Order / Standing Stones of the Old Faith | Identity | 100 | 350 | 3 | Hedge priests and knights, or druids and barbarians; one spell per level; exclusive |
| **Well** | Consequence | appears per 5 shops | 100 | – | +1 collector |
| **Sewer Mouth** | Consequence | appears per 9 buildings | indestructible | – | Rats and cutpurses by night |
| **Barrow** | Consequence | appears after ~10 dead heroes | indestructible | – | Undead on moonless nights |
| *Later*: Trading Post (caravans), Wizard's Tower (spells, enchanting), Garden or Statue (loyalty), Tourney Field (XP), Mausoleum | | | | | |

**Upgrade forks** (after Thronefall and Kingdom Rush): at Smithy L3, *Armourer* (armour line) or *Weaponsmith*;
at Market L3, *Guildhall* (bigger caravans) or *Fair* (hero XP); at tower stage 4, *Sniper* (targets the biggest) or
*Watchtower* (targets flyers, reveals fog).

New buildings need models in `src/render/stageModels.js` / `modelKit.js` and a `npm run bake` (see `CLAUDE.md`).

## Sources

- Kingdom wiki (kingdomthegame.fandom.com) via API: Wall, Archer tower, Ballista, Catapult, Fire tower, Knight tower,
  Bakery, Stable, Town center, Tools and weapons, Bomb, Cave, Statues, Farm
- Dungeon Keeper wiki (dungeonkeeper.fandom.com) via API: Rooms, Room Flags, Treasury, Lair, Hatchery, Prison,
  Torture Chamber, Casino and the creature pages
- Thronefall wiki: <https://throne-fall.github.io/game-content/buildings/>, and its House, Mill, Tower, Wall,
  Barracks, Archery Range, Blacksmith, Shrine, Fishing Harbour, Gold Mine and Castle Center pages
- Kingdom Rush wiki (kingdomrushtd.fandom.com) via API: Towers/Kingdom Rush and the individual tower pages
- Stronghold wiki (stronghold.fandom.com) via API: Stronghold - Buildings, Religion, Fear Factor, Popularity, Food, Tax, Keep
- Kairosoft wiki (kairosoft.fandom.com) via API: Structures (Dungeon Village), Tips (Dungeon Village)
- Crown of Greed: [Into Indie Games walkthrough](https://intoindiegames.com/walkthroughs/crown-of-greed-walkthrough-part-1/),
  [Gamestic review](https://www.gamestic.nl/2026/04/05/review-crown-of-greed/), [fan wiki](https://crownofgreed.wiki/guide/beginners-guide/) (unverified)
