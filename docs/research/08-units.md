# Units: heroes, troops, workers

Who fights and works for the player in each game, how they are produced, what they cost to keep, and a proposed
roster for our game. Majesty 1's 16 hero classes (stats, hidden attributes, decision lists) are in
[01-majesty.md](01-majesty.md#8-heroes) and [data/majesty1-heroes.json](data/majesty1-heroes.json). Data files:
[Dungeon Keeper creatures](data/dungeon-keeper-creatures.json), [Thronefall](data/thronefall.json).

## 1. Kinds of unit

| Kind | Controlled by | Examples |
| ---- | ------------- | -------- |
| **Free-willed heroes** | Their own decision AI plus your incentives | Majesty heroes, Crown of Greed heroes, Dungeon Village adventurers, DK creatures |
| **Scripted workers (henchmen)** | Fixed jobs; replaced automatically | Majesty peasants, tax collectors, guards, caravans; DK imps; Kingdom builders and farmers |
| **Garrison troops** | Bound to a building; fight near it or follow simple orders | Thronefall barracks units, Kingdom Rush barracks soldiers, Kingdom archers and knights, **our Barracks men** |
| **Summons and followers** | Their summoner | Majesty priestess skeletons, cultist pets; M2 Sister of Krypta skeletons; Thronefall heroes |
| **The ruler** | You, directly | Thronefall's king, Kingdom's monarch (can't fight), Kingdom Rush heroes, our Conquest heroes |

## 2. How units are produced

| Model | Game | How it works | Feel |
| ----- | ---- | ------------ | ---- |
| **Guild slots** | Majesty (4 a guild), M2 (3, temples 2), Crown of Greed (per HQ, +1 per upgrade) | Pay to recruit up to the cap; more guilds cost more | Roster as a set of named people |
| **Recruit-time gates** | Majesty (Paladin needs a Dauros temple), M2 (promotion at a temple) | Unlock classes by building | Build order matters |
| **Tool pickup** | Kingdom | Buy a tool; any idle villager takes it and becomes that job | Jobs are cheap and swappable |
| **Attraction by rooms** | Dungeon Keeper | Species come through the Portal when the right rooms (and sizes) exist and there's lair space | The build decides the roster |
| **Pick a type, get a squad** | Thronefall (barracks 4 / 8 / 12, one type for good) | Respawn during the night, all at dawn | Fast and simple; the choice is permanent |
| **Garrison with respawn** | Kingdom Rush (3 soldiers, respawn ~10 s), **our Barracks** (trains to a garrison) | Free replacement | Troops as a tower |
| **Volunteers** | Dungeon Village quests | Up to 9 volunteer at random; pay to fill the gaps | Who turns up is part of the story |
| **Auto-replacement** | Majesty henchmen, DK imps (spell) | Lost ones come back free | Workers are scenery, not stakes |

## 3. Rosters per game

### Majesty 1 (summary; full data in 01)

| Role | Classes |
| ---- | ------- |
| Tank / frontline | Warrior, Paladin, Barbarian, Warrior of Discord, Dwarf, Monk |
| Ranged | Ranger, Rogue, Elf, Cultist (throws daggers) |
| Caster | Wizard, Priestess (with skeletons), Solarus (fire) |
| Support | Healer (follows and heals), Monk (guards healers and caravans) |
| Scout / explorer | Ranger (95% explore), Solarus (finds hidden lairs), Adept (patrols) |
| Builder | Gnome, Dwarf (help peasants build) |
| Money | Rogue (steals, loots graves, cheap), Elf (performs, untaxed) |

Henchmen: peasant (builds, repairs), tax collector, palace guard (20 HP), city guard → veteran (guardhouse), caravan
(40 HP).

### Majesty 2

Five tier-1 classes (Rogue 100, Ranger 150, Warrior 200, Cleric 350, Mage 500), Dwarf and Elf (700), and eight temple
classes (1000) reached **by promotion**: Warrior → Paladin (defends, tough against melee) or Blademaster (strongest
melee hit, loves attack flags); Ranger → Beastmaster (pets) or Archer of Helia; Rogue → Assassin; Cleric → Sister
of Krypta (summons skeletons, drains) or Priestess of Agrela; Mage → Ice Mage (slows, freezes, sturdier).
Personality notes from the wiki: warriors are "brash" and engage anything; rogues "won't engage in fights they can't
win" and respond to anything paid; rangers love explore flags. Henchmen: peasants (live in pairs in auto-built
houses), tax collectors (4 / 5 / 6), **Royal Guards 2 / 4 / 8** by Palace level, one guard per guardhouse, caravans
(carry multiples of 100).

### Crown of Greed

About ten classes. Confirmed by the walkthrough: warriors from Barracks and hunters from the Hunter's Camp. A fan wiki
(unverified) lists Knight (patrols borders), Rogue (profit, scouting, may steal), Ranger or Hunter (explores, clears
nests), Mage, Cleric or Paladin (strong against undead), Berserker (charges). **Random positive and negative
traits** per hero, e.g. *Devout* (bonus against undead, penalty against the living), *Glutton* (wastes gold at the
market), kleptomania, hidden debts. You see the traits before paying to recruit. Mercenary camps can join you if
you defend them (a defend contract).

### Kingdom series

| Subject | Tool and cost (coins) | Coins carried | Day | Night |
| ------- | --------------------- | ------------: | --- | ----- |
| Vagrant | – (a coin recruits) | – | Wanders near a camp; ignored by the Greed | Cowers |
| Villager | – | 2 | Waits for a tool | Shelters |
| Archer | Bow, 2 | 11 | Hunts rabbits and deer for coins | Mans walls and towers |
| Builder | Hammer, 3 | 2 | Builds, repairs, chops trees, crews siege weapons | Keeps working on tasks it was given |
| Farmer | Scythe, 4–5 | 14 | Farms (forages berries in winter) | In the farm shelter |
| Knight (squad leader) | Shield, 6 | – | Leads a company of archers; assaults portals | Guards the outer wall |
| Pikeman / Ninja | Pike / ninjato, 2 | 2 | Fishes | Defends the walls / ambushes in the bamboo |
| Hermits | 1 coin to carry home | – | Convert a building (ballista, fire tower, bakery, stable, knight tower) | – |
| Merchant | 1 coin → 8 coins of goods | – | Trades; ignored by the Greed | – |
| Banker | deposit ≥ 10 | – | Stores coins with interest; out by day only | Inside |

**Damage strips equipment**: a hit takes extra coins, then the tool, then the last coin (back to vagrant). Floaters
kidnap people outright. There are no HP bars to manage, only what people are carrying.

### Dungeon Keeper 1: the keeper's creatures

| Creature | Wage L1 → L10 | HP L1 | Speed | Training cost | Slap anger | Hunger | Attracted by | Role |
| --- | --- | --: | --: | --: | --: | --- | --- | --- |
| Imp | 0 | 75 | 96 | 10 | 0 | none | Never; made with the Create Imp spell | Worker: digs, claims, hauls |
| Fly | 5 → 20 | 150 | 128 | 5 | 0 | 1 / 9000 turns | Nothing (comes by default) | Scout |
| Beetle | 18 → 74 | 250 | 48 | 8 | 100 | 1 / 5000 | Lair (1 tile) | Cheap fodder |
| Spider | 25 → 103 | 400 | 48 | 18 | 200 | 2 / 7000 | Lair 9 + Hatchery 9 | Fighter; slows and freezes |
| Troll | 50 → 207 | 450 | 48 | 12 | 200 | 3 / 6000 | Workshop (1) | Artisan: traps and doors |
| Demon Spawn | 70 → 290 | 325 | 48 | 15 | 200 | 2 / 6000 | Treasure Room 1 + Training Room 1 | Fighter; grows into a Dragon |
| Orc | 95 → 394 | 700 | 48 | 15 | 200 | 2 / 7000 | Training Room 9 + Barracks 1 | Fighter; leads groups |
| Bile Demon | 98 → 406 | 1200 | 48 | 38 | 400 | 6 / 4500 | Lair 25 (the Hatchery page says a 25-tile Hatchery + a Workshop) | Tank; eats the most |
| Hellhound | 67 → 278 | 600 | 96 | 14 | 250 | 3 / 6000 | Scavenger Room 9 | Seeker; guards other creatures |
| Warlock | 120 → 498 | 350 | 32 | 30 | 750 | 3 / 8000 | Library 9 | Thinker: research |
| Mistress | 175 → 726 | 700 | 64 | 24 | **−400** | 3 / 8000 | Torture Chamber 9 | Fast caster; **likes being slapped** |
| Tentacle | 45 → 186 | 700 | 32 | 14 | 200 | 1 / 8000 | Temple 9 + Lair 9, by water | Water guard; levels while sleeping |
| Ghost | 20 → 83 | 200 | 64 | 20 | 500 | none | Torture Chamber 1; also made when a victim dies under torture | Scout |
| Skeleton | 70 → 290 | 500 | 64 | 20 | 100 | none | Made when a humanoid dies in a Prison | Guard; never eats |
| Vampire | 750 → 3112 | 800 | 56 | 50 | 1000 | 2 / 6000 | Graveyard 30 + Lair 9; or rises from every 10 corpses | Caster; the Temple upsets it |
| Dragon | 350 → 1452 | 900 | 32 | 40 | 600 | 4 / 8000 | Treasure Room 25 + Lair 15 | Tank-caster; researcher |
| Horned Reaper | 950 → 3942 | 2000 | 96 | 150 | 3750 | 4 / 3505 | Temple 9 (no stock level allows it) | Berserker; goes on a killing rage if idle or unhappy |

Wage and stats grow linearly to **415% at level 10**, so veterans cost four times as much. Training costs gold per
creature per 64 turns. Every creature has an anger job (vandalism, fighting, leaving) when contentment falls below 20%.

### Thronefall

| Unit | From | HP | Speed | Damage | Notes |
| ---- | ---- | -: | ----: | -----: | ----- |
| Knight | Barracks | 100 | 4 | 2.5 / s | Resists arrows |
| Spearman | Barracks | 60 | 8 | 1.75 × 2 / s | ×1.75 against fast enemies, slows them 67% for 2 s; weak to arrows |
| Flail | Barracks | 70 | 5 | 1.5 / s | Hits everything around it |
| Berserk | Barracks | – | – | – | Goes for siege and high-HP targets, sacrificial |
| Longbow Archer | Range | – | – | – | Very long range, fragile |
| Crossbowman | Range | – | – | – | Short range, high damage, resists arrows, bonus against ranged |
| Hunter | Range | 45 | 6 | 3.5 | ×2 against monsters, longer range against them, has a melee attack |
| Fire Archer | Range | – | – | – | Splash; bonus against siege |
| Golem / Firewing / Lizard Rider / Support Mage | Hero's Quarters | 30 (Firewing) | 10 | – | One unit that grows with upgrades; the mage heals |
| The King | you | 50 (regenerates 10%/s) | 14 / 23 sprint | weapon | The only builder; picks a weapon per map |

**Units can be told to hold or to follow the king** (followers can't attack unless upgraded). Each production
building is **locked to one type**, so the type pick is the decision.

### Kingdom Rush

Barracks soldiers: Militia (50 HP, 1–3 damage, respawn 10 s) → Footmen → Knights → **Holy Order** (paladins, 200 HP,
50% armour, heal themselves) or **Barbarian Mead Hall** (250 HP, axes thrown). Three soldiers per barracks,
**rally point** set by dragging. Heroes: one per stage, moved directly, with XP and levels within the stage and
respawn on death.

### Stronghold †

Barracks: Archer, Spearman, Maceman, Crossbowman, Pikeman, Swordsman, Knight. Engineer's Guild: Engineer, Tunneller,
Ladderman. Siege Camp: Mantlet, Fire Ballista, Catapult, Cat, Battering Ram, Siege Tower, Trebuchet. Units cost
gold **and weapons** made in workshops (bows, spears, maces, armour), so the economy feeds the army. The Fear Factor
gives troops ±5–25% damage.

### Dungeon Village

Adventurers have HP, Attack, Defence, Magic and base stats (health, strength, dexterity, toughness, spirit, luck).
**Jobs** set growth and attack style. Mastering a job (level 10) gives permanent stats and unlocks it for everyone,
and carries to a new game. Higher jobs pay a higher **salary**. **Satisfaction** and **Work** (how long they hunt
before coming home) rise with gifts and medals. Up to 25 adventurers, who move into houses you build.

### Hold the Hall today

| Unit | HP | Damage | Role |
| ---- | -: | -----: | ---- |
| Man-at-arms (`swordsman`) | 110 | 9 | Barracks garrison, melee |
| Bowman (`archer`) | 60 | 8 | Barracks garrison, ranged 4.5 |
| Knight | 260 | 16 | Garrison Hall (barracks stage 3) |
| Conquest heroes: Knight / Ranger / Warden | 650 / 430 / 820 | 26 / 22 / 20 | Orders, XP, levels, two abilities each, respawn |

## 4. Patterns worth stealing

1. **Roles through temperament, not just stats** (Majesty): the same sword is a defender in a warrior and loot in a
   rogue.
2. **Followers for cooperation**: healers follow fighters, monks guard healers, rangers trail barbarians.
3. **Upkeep that grows with level** (DK): 1 + 0.35 × (level − 1). Veterans become a budget decision.
4. **Equipment as the HP of the economy** (Kingdom): attacks strip coins and tools first.
5. **Counters by tag** (Thronefall: spearmen against fast, hunters against monsters, crossbows against ranged; Kingdom
   Rush: armour against magic). This gives a reason to recruit a mix.
6. **Permanent type picks** (Thronefall barracks) and **promotion** (Majesty 2) are cheap specialisation.
7. **The roster attracted by buildings** (DK, Majesty): building a Library is a way of saying "I want casters".
8. **Visible traits with trade-offs** (Crown of Greed, Darkest Dungeon, RimWorld), shown before recruiting.

## 5. Proposed roster for Realm mode

Hold the Hall scale (our troops: 60–260 HP, 8–16 damage; enemy swordsman 70 HP). Starting values to tune.
**Sprites**: reuse existing unit sprites at first (red livery); new classes need rigs in `src/render/models.js` and
a bake.

### Heroes (free-willed)

| Class | Home | Cost | HP L1 | Dmg | Speed | Range | Greed | Courage (self / enemy) | Flee at | Temperament | Counters |
| ----- | ---- | ---: | ----: | --: | ----: | ----: | ----: | ---------------------- | ------: | ----------- | -------- |
| Man-at-arms | Men-at-arms Hall | 45 | 150 | 10 | 0.95 | melee | 12 | 1.0 / 1.0 | 35% | Defends home, the Hall and the chapel; raids lairs with company; buys armour | Raiders at the walls |
| Ranger | Rangers' Lodge | 35 | 90 | 9 | 1.15 | 6 | 3 | 1.0 / 1.1 | 35% | Explores first; hunts beasts; follows brave allies | Beasts (×1.5), scouting the fog |
| Rogue | Rogues' Den | 28 | 70 | 8 | 1.2 | 5 | 26 | 0.8 / 1.2 | 45% | Takes any bounty; loots graves; steals from rivals; pays 30% guild tax | Thieves (catches cutpurses) |
| Hedge priest | Chapel of the Order | 40 | 70 | 4 | 1.0 | 4 | 1 | 0.6 / 1.4 | 50% | Follows and heals the most hurt ally; follows collectors | Undead (×2) |
| Knight of the Order | Chapel L2 | 100 | 300 | 18 | 1.0 | melee | 3 | 1.4 / 0.8 | 15% | Raids lairs alone; never visits vices | Big monsters, undead |
| Druid | Standing Stones | 40 | 80 | 6 | 1.0 | 5 | 2 | 0.8 / 1.2 | 45% | Charms beasts as followers; plants healing herbs | Beasts |
| Barbarian | Standing Stones L2 | 70 | 260 | 22 | 0.9 | melee | 9 | 1.6 / 0.7 | 15% | Raids buildings and lairs; never shops | Raider camps |

Each recruit rolls 1–2 traits (brave, craven, greedy, frugal, devout, drunkard, curious, homebody, loyal, fickle).

### Henchmen (scripted, free, replaced at the Hall)

| Henchman | Count | Job |
| -------- | ----- | --- |
| Builder | 2 per Hall stage | Builds and repairs (today's building is instant; Realm could make it walked) |
| Tax collector | 1 per Hall stage, +1 per Well | Walks coffers to the Hall or a Watch House; carried gold lost on death |
| Watchman | 2 per Watch House | Patrols near it; handles rats and cutpurses |
| Caravan (later) | per Trading Post | Carries gold to the market; worth more the further it goes |

### Garrison troops (existing)

The Barracks stays as today (Men-at-arms and Bowmen guarding its post, Knights at stage 3). In Realm it's the
**player's only directly reliable defence**, and the only place where incentives aren't needed.

## Sources

- Majesty 2 wiki (majesty2.fandom.com) via API: Heroes, Warrior, Ranger, Rogue, Cleric, Mage, Paladin, Blademaster,
  Beastmaster, Archer of Helia, Assassin, Ice Mage, Sister of Krypta, Elf, Dwarf, Guard, Peasant, Royal Guard, Caravan
- Kingdom wiki via API: Subjects, Vagrant, Vagrant camp, Archer, Builder, Farmer, Knight, Pikeman, Ninja, Hermits,
  Merchant, Banker, Tools and weapons
- Dungeon Keeper wiki via API: Template:CreatureQueryStats, Template:CreatureJobStats, Creatures, Payday and the
  creature pages
- Thronefall wiki: <https://throne-fall.github.io/game-content/units/>, unit and building pages, The King
- Kingdom Rush wiki via API: Militia Barracks, Holy Order, Barbarian Mead Hall, Heroes/Kingdom Rush
- Stronghold wiki via API: Stronghold - Units, Fear Factor
- Kairosoft wiki via API: Adventurers (Dungeon Village), Jobs (Dungeon Village)
- Crown of Greed: [Into Indie Games walkthrough](https://intoindiegames.com/walkthroughs/crown-of-greed-walkthrough-part-1/), [Gamestic review](https://www.gamestic.nl/2026/04/05/review-crown-of-greed/), [fan wiki heroes guide](https://crownofgreed.wiki/guide/heroes/) (unverified)
- Hold the Hall: `src/sim/config.js` (`TROOPS`, `HEROES`)
