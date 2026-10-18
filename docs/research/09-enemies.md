# Enemies, monsters and lairs

What each game throws at the player: stats, where enemies come from, **what they go for**, and how damage types
work, plus a proposed bestiary for our game. Data files: [Majesty 1 monsters](data/majesty1-monsters.json),
[Thronefall](data/thronefall.json), [Dungeon Keeper heroes](data/dungeon-keeper-creatures.json) (`side: "hero"`).

## 1. Where enemies come from

| Source | Examples | Design job |
| ------ | -------- | ---------- |
| **Lairs** (spawn until destroyed) | Majesty dens and keeps; M2 Wolves' Den (1500 HP), Snake's Nest (800), Portal to Hell (1000), Dragon's Lair (5000); Crown of Greed nests (waves grow the longer they stand); Kingdom portals and the cave; our bandit camps (`camps.js`) | Targets for bounties; pressure that grows if ignored |
| **Map edges** | Majesty wandering monsters; minotaurs from the edge | Background threat |
| **Timed waves** | Kingdom nightly Greed (timed to hit at midnight), Blood Moons; Thronefall nights; our waves | Rhythm |
| **Growth spawns** | Majesty sewers (rats, ratmen), graveyards (undead), trolls (spending), minotaurs (smithing); DK Graveyard → Vampires | Success creates danger |
| **Retaliation** | Kingdom counter-attack after a portal falls; Crown of Greed "enraged" enemies after you've been passive too long; Majesty's *Legendary Heroes* (waves scale with heroes) | Punish both rushing and turtling |
| **Bosses and scripted events** | Majesty quest bosses (Rhoden the Rat King on day 25); Crown of Greed's Baba Yaga hut attacking on day 5, a pack leader that can't be hurt until a caravan arrives; Thronefall's final-night statues; Dungeon Village bosses that **cost popularity while alive** | Set pieces and objectives |
| **Invaders who are heroes** | Dungeon Keeper heroes through Hero Gates (Knight, Avatar…); Majesty rival heroes | Turn the genre around |

## 2. What enemies go for (the most useful axis for a wall game)

| Target preference | Examples | What it tests |
| ----------------- | -------- | ------------- |
| **The seat** | Thronefall Racer (×2 damage to the castle, never chases the king); Majesty ratmen often hit the Palace; our whole army | Walls and the flow field (what Hold the Hall does today) |
| **Gold and loot** | Majesty ratmen (rob coffers; most is returned if killed), trolls (markets, trading posts); Kingdom greedlings (coins, tools, then the crown) | Protecting the economy, not just the seat |
| **Economy buildings** | Thronefall Wasp (flying, goes for economy) | Spread-out towns |
| **Defences** | Thronefall Ogre (defensive buildings; half damage to units), Fury (flying, defences); catapults and rams (buildings) | Tower placement, repair |
| **Units** | Thronefall Elite Crossbow Man and Flying Mage (prefer units); Majesty zombies (heroes and peasants) | Keeping troops safe |
| **The ruler** | Thronefall Hunterling; Kingdom **crown stealer** (leaps walls, ends the reign) | A direct-control ruler under threat |
| **People** | Kingdom **floater** (kidnaps two subjects back through a portal) | Population as a resource |
| **Heroes** | Majesty Rrongol the Hunter ("relentlessly hunts heroes") | Hero survival |
| **Nothing until disturbed** | Majesty Daemonwood (guards lairs, regenerates), Strangleweed (stationary, poisons) | Hazards on the map |

## 3. Damage and defence systems

| System | Game | How it works |
| ------ | ---- | ------------ |
| **Roll to hit, roll to avoid** | Majesty | Melee: hit chance against Parry; ranged against Dodge; magic always hits unless Resist; buildings take half; armour stops ⌊A/2⌋ + random |
| **Armour vs magic resistance** | Kingdom Rush | Physical damage is cut by armour, magic by magic resistance, in bands: low 1–30%, medium 31–60%, high 61–90%, great 91–99%, immune. **Physical towers against magic-armoured foes and the reverse** is the whole tower choice |
| **Tag multipliers** | Thronefall | Damage × every matching tag: towers ×1.15 against flying, ×0.6 against ranged-resistant, ×2 against "tower-vulnerable"; spearmen ×1.75 against fast; hunters ×2 against monsters; catapults ×0.2 against the castle |
| **Skill, defence, luck** | Dungeon Keeper | Dexterity against Skill to land a melee hit; Defence reduces damage; Luck (a fraction of 255) gives double attacks or extra dodges |
| **Equipment stripping** | Kingdom | No HP for people: a hit takes coins, then the tool, then the last coin |
| **Ours today** | Hold the Hall | Flat damage; splash; slow (Magic Spire); minimum range (catapult) |

Kingdom Rush armour examples: Orc 30% armour; Shaman 85% magic resistance; Brigand 50%; Marauder 60%; Giant Spider
65% MR; Dark Knight 80% armour; Dark Slayer 95%; Demon Spawn 60% MR; Orc Champion 80%; Worg Rider 80% MR; Raider 95%
(and its own attack ignores armour); Pillager 90% MR; Spectral Knight immune to physical; Fallen Knight 90% MR.

**For us**: Thronefall's tag multipliers are the lightest system that still produces counters, and it fits our
config (a `tags` list per enemy and a `vs` table per tower).

## 4. Bestiaries

### Majesty 1 (level-1 values; resist / dodge / defence in %)

| Monster | HP | Resist | Dodge | Defence | Notes |
| ------- | -: | -----: | ----: | ------: | ----- |
| Giant Rat | 19 | 0 | 35 | 25 | Sewers |
| Goblin / Archer / Priest | 20 | 3–7 | 30–40 | 25 | Warbands; priests summon insect swarms |
| Goblin Champion | 35 | 4 | 40 | 30 | Two weapons |
| Goblin Overlord | 60 | 20 | 50 | 60 | Guards lairs, leads attacks |
| Roc | 25 | 0 | 50 | 25 | Weak; Fervus temples spawn them for cultists to charm |
| Rust Spitter | 30 | 0 | 25 | 20 | Ranged acid that melts armour; guards lairs |
| Skeleton | 32 | 0 | **88** | 25 | Resistant to arrows; graveyards |
| Giant Spider | 35 | 0 | 30 | 30 | Surrounds its targets |
| Dryad | 35 | 30 | 35 | **85** | Woodland lairs |
| Ratman | 45 | 2 | 30 | 40 | **Steals coffer gold**; often goes for the Palace |
| Zombie | 45 | 0 | 35 | 30 | Goes for heroes and peasants, rarely the Palace |
| Hellbear | 45 | 0 | 25 | 35 | Very strong melee; avoids settlements |
| Harpy | 45 | 5 | 45 | 25 | |
| Vampire | 50 | 15 | 60 | 40 | Life drain heals it; anti-magic shield |
| Medusa | 60 | 90 | 35 | 35 | Petrifies |
| Werewolf | 60 | 5 | 40 | 55 | |
| Ratman Champion / Shaman | 60 / 40 | 35 | 45 / 30 | 60 / 35 | Elites; the shaman casts plague and damage shields |
| Troll | 68 | 5 | 30 | 40 | **Spawns per 1000 gold spent**; attacks markets; regenerates |
| Minotaur | 75 | 0 | 25 | 45 | **Spawns per 25 smith visits**; raider; carries 85 gold, gives 300 XP |
| Evil Oculus | 90 | **95** | 25 | 30 | Paralyses with its first hit |
| Daemonwood | 110 | – | – | – | Regenerates; guards treasure; invisible on the minimap |
| Ratapult | 150 | 5 | 15 | 10 | Ratman siege engine |
| Rock Golem | 290 | 25 | 5 | 5 | Wrecks buildings |
| Dragon | very strong | | | | Fast, ranged fire |
| Bosses | 175–4000 | 35–100 | | | Black Phantom (175 HP, carries 800 gold), Liche Queen (275, 95% resist), Rrongol (240, poison), Rhoden the Rat King (200, summons rats), Styx and Stones (250 each, revive each other unless both die), Vendral (500, unkillable until a quest sword is found), Avatar of Krolm (4000, when an altar falls) |

### Majesty 2 (level, HP, loot gold; protection against melee / ranged / magic)

| Monster | Level | HP | Loot | Attack | Protection | From |
| ------- | ----: | -: | ---: | -----: | ---------- | ---- |
| Wolf | 5 | 60 | 25 | 5 | 10 / 0 / 10 | Wolves' Den (1500 HP) |
| Imp | 5 | 120 | 12 | 14 (magic + melee) | 0 / 0 / 10 | Portal to Hell (1000) |
| Flying Serpent | 5 | 120 | 25 | 14 (magic) | 0 / 5 / 10 | Snake's Nest (800); a swarm when the nest is destroyed |
| Old Wolf | 10 | 160 | 25 | 12 | 20 / 0 / 20 | Wolves' Den |
| Demon | 10 | 240 | ? | 24 + 24 | 0 / 10 / 25 | Portal to Hell |
| Dragon | 20 | 2500 | 100 | 80 | 50 / 50 / 100 | Dragon's Lair (5000) |
| King Rat (boss) | 30 | 35000 | 500 | 100 + 100 | 20 / 50 / 100 | Sewers |

Also goblins (level 5, "can destroy a small town in large numbers"), skeletons and zombies from ancient and
plague-stricken graveyards.

### Kingdom series: the Greed

| Greed | HP | What it does |
| ----- | -: | ------------ |
| Greedling | 1 (masked 2–5) | Charges for 1 damage; **steals coins and tools**; most numerous; masked ones from later nights |
| Archer greed + Knight greed | small / very large | Four archers lob pellets over a shielded knight; they retreat if it dies |
| Floater | 12 | Flies; **kidnaps two subjects** back to a portal; plucks archers off unroofed towers; from the third Blood Moon on |
| Breeder | large | Tank; punches knock people down and strip coins; **throws your own catapult boulders back**; vomits greedlings |
| Crusher (Norse) | heavy | Arrow-proof shell; charges and breaks weak walls until stopped by a strong wall or a shield wall, then becomes vulnerable |
| Crown stealer | 8 | Leaps over walls, ignores coins, **knocks off the crown**; from year 3 Blood Moons and year 4 nights |
| Portals | – | Small portals in the woods, a cliff portal (rebuilds in 3 days), and the cave (destroyed with the bomb to free the island) |

### Thronefall

| Enemy | Group | HP | Speed | Damage | Goes for | Notes |
| ----- | ----- | -: | ----: | -----: | -------- | ----- |
| Swordsman | human | 25 | 5 | 2.5 | anything | |
| Archer | human | 20 | 5 | 4 (range 40) | anything | Tower-vulnerable |
| Elite Crossbow Man | human | 40 | 4 | 15 (range 15) | units | ×0.15 against walls |
| Pikes | human | – | – | – | – | Slow and hurt the king's horse |
| Flying Mage | human | – | – | splash | units | Flies |
| Ogre | human (tank) | 200 | 4 | 20 | defensive buildings | ×0.5 against units |
| Racer | monster | 35 | 10 | 2.5 | **castle centre** | ×2 against the castle; never chases the king |
| Wasp | monster | 25 | 8 | 2.5 | **economy buildings** | Flies |
| Hunterling | monster | – | – | – | **the king** | |
| Exploder | monster | – | – | – | buildings | Explodes on contact |
| Slime / Spiky Slime | monster | – | – | – | – | Spiky ≈ 3× |
| Fury | monster | – | – | slow, heavy shots | defences | Flies |
| Catapult | siege | 45 | 2 | 150 (range 26) | buildings | ×0.2 against the castle |
| Ram | siege | 250 | 2.25 | 15 | buildings | Resists arrows |
| Barrel Knight, Quicksling | siege | – | – | – | buildings | |
| Shadow in the Water, Strange Statues | boss | | | | | Final nights |

### Dungeon Keeper heroes (invaders), level 1

| Hero | HP | Strength | Dexterity | Skill | Defence | Speed | Notes † |
| ---- | -: | -------: | --------: | ----: | ------: | ----: | ----- |
| Fairy | 150 | 10 | 70 | 30 | 10 | 64 | Fast caster |
| Thief | 250 | 30 | 120 | 80 | 20 | 48 | Steals gold |
| Archer | 300 | 20 | 100 | 60 | 20 | 48 | |
| Priestess | 300 | 20 | 80 | 30 | 20 | 48 | Healer |
| Monk | 325 | 40 | 80 | 80 | 20 | 32 | |
| Wizard | 350 | 20 | 100 | 30 | 15 | 32 | |
| Tunneller | 350 | 40 | 40 | 40 | 30 | 48 | **Digs towards your dungeon** |
| Mountain Dwarf | 500 | 50 | 55 | 30 | 40 | 80 | Digs |
| Giant | 650 | 100 | 60 | 30 | 60 | 32 | |
| Barbarian | 700 | 60 | 70 | 60 | 50 | 48 | |
| Samurai | 700 | 80 | 90 | 70 | 60 | 64 | |
| Knight | 950 | 80 | 150 | 30 | 100 | 40 | Leads parties |
| Avatar | 3000 | 150 | 180 | 110 | 120 | 48 | Final boss; revives |

### Crown of Greed

Slavic and European folklore: wolves (with a pack leader), giant spiders, drowners, devils, basilisks, Baba Yaga
(her hut walks in and attacks on day 5 of the first scenario), spectral guards at a cursed tower (respawn daily
until it falls), an undead mage boss, bandit camps, ghostly wolves and bears at night. Nests send bigger waves the
longer they stand, and **enemies become "enraged" if you stay passive**.

### Kingdom Rush (archetypes) †

Fast weak swarms (goblins, wulves), armoured melee (orcs, Dark Knights), magic-resistant casters (shamans),
**flyers** that skip soldiers (gargoyles), **healers and summoners** (necromancers, shamans heal allies), **regenerators**
(trolls), units that **spawn more on death** (spiders, wererats), **burrowers** that skip ahead, and bosses with phases.

### Hold the Hall today

| Enemy | HP | Speed | Damage | Gold | Notes |
| ----- | -: | ----: | -----: | ---: | ----- |
| Swordsman | 70 | 0.88 | 6 | 4 | Squads of 3–5 |
| Pikeman | 100 | 0.76 | 5 | 5 | |
| Archer | 45 | 0.84 | 3 (range 5) | 4 | |
| Battering Ram | 450 | 0.44 | 90 | 18 | With escorts; breaks walls |
| Knight | 240 | 0.72 | 12 | 12 | |
| Siege Catapult | 220 | 0.4 | 70 (range 8) | 20 | |

All of them go for the Hall through the breach-cost flow field. That makes walls central, but it's also the gap:
**nothing goes for anything else.**

## 5. Patterns worth stealing

1. **Give every enemy a target preference** (Thronefall). A few of our raiders going for coffers, granaries or
   towers makes defence a spatial puzzle beyond "wall in the Hall".
2. **Thieves whose loot can be recovered** (Majesty ratmen, Kingdom greedlings with stolen gems): chasing them is a
   mini-game, and it's a bounty target.
3. **Abductors and crown stealers** (Kingdom): rare enemies that bypass walls make walls strategic, not absolute.
4. **Flyers that skip walls** (Kingdom floaters, Thronefall wasps and furies, Kingdom Rush flyers) need anti-air
   answers (Thronefall's scarecrows, armoured towers).
5. **Regenerators and revivers** (trolls, Styx and Stones): forces focus fire or special answers.
6. **Lairs that grow** (Crown of Greed nests, our camps' `growth`), with **retaliation** when destroyed (Kingdom).
7. **Spawn triggers tied to player behaviour** (Majesty trolls, minotaurs, sewers, graveyards).
8. **Bosses that hurt the economy while alive** (Dungeon Village's popularity loss), so you're pushed to deal with
   them now.
9. **Tag-based counters** rather than hidden roll tables: readable on a phone.

## 6. Proposed bestiary for Realm mode

Hold the Hall scale. By **day**, lair creatures and growth spawns (heroes' business); by **night**, the existing
raids against the walls, with a few new roles. Pathing: flow field (to the Hall) for raiders, per-squad A* for
anything with another target (as Conquest soldiers already do), and a straight line for flyers.

| Enemy | When / from | HP | Speed | Goes for | Tags | Notes |
| ----- | ----------- | -: | ----: | -------- | ---- | ----- |
| Wolf | Day, wolf den | 40 | 1.3 | Nearest hero or henchman | beast, fast | Packs of 3–5; den refills |
| Outlaw / outlaw archer | Day, outlaw camp (today's camps) | 70 / 45 | 0.9 | Collectors, caravans, coffers outside the walls | human | Carries loot back to camp; kill to recover |
| Cutpurse (rat-man in a fantasy setting) | Night, Sewer Mouth | 35 | 1.1 | **Fullest coffer** | thief | Runs home with the gold; killing it returns 70% to nearby heroes |
| Rat swarm | Night, Sewer Mouth | 15 | 1.0 | Builders, collectors | beast, swarm | Watchmen handle them |
| Barrow-dead (skeleton, wight) | Moonless nights, Barrow | 50 / 160 | 0.7 | Heroes and peasants | undead, arrow-resistant | Priests and knights ×2 |
| Troll | When 100 gold has been spent in shops | 220 | 0.8 | Market, then shops | monster, regenerates | Must be focused down |
| **Raid looter** (new role in the night waves) | Night waves | 60 | 0.95 | Coffers and shops, else the Hall | human | Gives value to walls round the economy |
| **Sapper** (new role) | Night waves, later | 80 | 0.8 | Walls (an extra breach cost for that squad) | human, siege | Sets a timed charge |
| Existing army (swordsman … siege catapult) | Night waves | as now | as now | The Hall | human (+ siege) | Unchanged |
| Wyvern (late) | Night, mid-game | 300 | 1.4 | Economy buildings | monster, flying | Ignores walls; needs ranged towers set to target flyers |
| Boss: the Wolf King, the Barrow King, the Outlaw Baron | Scripted or per map | 2000+ | – | Varies | – | Lowers town income while alive (after Dungeon Village) |

The tags plug into a Thronefall-style `vs` table in `config.js` (e.g. ranger ×1.5 against `beast`, priest ×2 against
`undead`, archer tower ×1.15 against `flying`). Wave size can scale with wealth as in
[05](05-economy-and-progression.md#6-self-balancing-threats-success-creates-danger).

## Sources

- Majesty wiki via API: all monster and boss pages (see the data file)
- Majesty 2 wiki via API: Wolf, Old Wolf, Imp, Demon, Serpent, Dragon, King Rat, Goblin, Monsters and lairs, Graveyard,
  Dragon's Lair, Wolves' Den, Snake's Nest, Portal to Hell
- Kingdom wiki via API: Greedling, Archer greed, Knight greed, Floater, Breeder, Crusher, Crown stealer, Greed golem,
  Queen greed, Portal, Small portal, Cliff portal, Cave, Counterattack wave, Final wave, Waves, Blood Moon
- Thronefall wiki: <https://throne-fall.github.io/game-content/enemies/> and the Archer, Elite Crossbow Men, Ogre,
  Racer, Wasp, Catapults, Ram and Swordsman pages
- Kingdom Rush wiki via API: Armor and Magic resistance, Shared Enemy Characteristics, Enemies/Kingdom Rush
- Dungeon Keeper wiki via API: Template:CreatureQueryStats, Heroes, Hero Gate
- Crown of Greed: [Into Indie Games walkthrough part 2](https://intoindiegames.com/walkthroughs/crown-of-greed-walkthrough-part-2/) and [part 3](https://intoindiegames.com/walkthroughs/crown-of-greed-walkthrough-part-3/), [fan wiki](https://crownofgreed.wiki/) (unverified)
- Kairosoft wiki via API: Enemies (Dungeon Village), Dungeon Village
- Hold the Hall: `src/sim/config.js` (`ENEMIES`)
