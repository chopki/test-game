# Majesty: The Fantasy Kingdom Sim (2000) and The Northern Expansion (2001)

The reference design. Cyberlore Studios, published by MicroProse/Hasbro (PC, March 2000), Mac 2000, Linux 2003; Gold
HD re-release 2012. The numbers here come from the community wiki (pulled through its API in October 2026). It is
detailed but fan-maintained, so a few values conflict (noted where they do). Machine-readable versions:
[`data/majesty1-heroes.json`](data/majesty1-heroes.json), [`data/majesty1-buildings.json`](data/majesty1-buildings.json),
[`data/majesty1-spells.json`](data/majesty1-spells.json).

## 1. Shape of a game

- **Quests, not a campaign.** 19 standalone scenarios in the original, 12 in the expansion, plus 2 bonus ones (33
  total), rated Beginner / Advanced / Expert (and Master for the two hardest), with some locked behind others. Each has
  its own map, starting buildings, building restrictions and win condition (kill a boss, destroy N lairs, gather X
  gold, survive N days, rescue someone).
- **Freestyle**: a random map. Pick Beginner/Advanced/Expert random, or set everything by hand: starting buildings,
  enemy lairs, wandering monsters, two special events, victory condition (eliminate foes / gather gold / survive a
  time), landscape, starting gold and building restrictions. This is the mode that kept players coming back.
- **Time.** The game counts days; spell durations say "half a day (30 s)", so **a day is about 60 s** at normal
  speed. Timed quests count days.
- **Fog.** Only the area round the Palace starts revealed, and **you can't build on unexplored ground**. Exploration
  is itself a resource.
- **Lose** when the Palace falls (the expansion's Outpost is a backup seat).

## 2. What the player can actually do

There are **no unit orders at all**. The full list of verbs:

| Verb | Cost | Notes |
| ---- | ---- | ----- |
| Place a building | gold | Peasants walk out and build it; they ignore danger. Wizard buildings build themselves |
| Upgrade a building | gold | Some need prerequisites (Palace level, all research done) |
| Research at a building | gold | Unlocks an item/service; heroes then **pay again** to buy it |
| Recruit a hero | gold | At their guild/temple, up to its capacity (usually 4) |
| **Attack flag** on a unit or building | gold, paid up front, not refundable | Can target your own buildings too (to get rid of them) |
| **Explore flag** on a place | gold, up front, not refundable | Draws heroes to a spot or into the fog |
| Cast a sovereign spell | gold per cast | From temples and the Wizards' Guild ([spells](data/majesty1-spells.json)) |
| Use a guild power | gold | Call to Arms (500: teleport Warriors home), Move Camp (800: move the Rangers' Guild), Extort, Market Day, Rage of Krolm (1500) |
| Set tax collector thresholds | free | Min pickup per building and min return per trip, per collector |
| Set a building's tax rule | free | Collect / exempt / collect once |
| Toggle repair | free | Houses start excluded |
| Dismiss a hero | free | |

Everything else (fighting, shopping, resting, exploring, looting, fleeing) is the heroes' own choice.

## 3. Units

**Heroes** have free will. **Henchmen** have fixed scripts and are replaced automatically when they die:

| Henchman | From | Job |
| -------- | ---- | --- |
| Peasant | Palace (2/4/6 by Palace level), Outpost (2) | Build and repair. Walk straight to the job, ignoring enemies. Can shelter in guardhouses |
| Tax Collector | Palace (1 per Palace level), +1 per Fountain, +1 per Outpost | Walk a route emptying building coffers; drop off at Palace, Outpost or Guardhouse |
| Palace Guard | Palace L2 (1), L3 (2), Outpost (2) | Patrol and chase threats in town; weak (20 HP) |
| City Guard → Veteran | Guardhouse (L1 → L2) | Patrol near their guardhouse; free, respawn; enough for rats and skeletons |
| Caravan | Trading Post | Walk to the nearest Marketplace with gold; 40 HP, defenceless, never avoid danger |

## 4. The Palace and building tiers

| Palace | Cost | Henchmen | Upgrade needs | Unlocks |
| ------ | ---- | -------- | ------------- | ------- |
| Level 1 | start | 2 peasants, 1 collector | 4 heroes recruited | Warriors', Rangers', Rogues' guilds, Gnome Hovel, Blacksmith, Marketplace, Inn, Guardhouse, Trading Post |
| Level 2 | 3000 | 4 peasants, 2 collectors, 1 guard | 12 heroes recruited | Wizards' Guild, Statue, Library, Wizards Tower, the five level-2 temples, Elven Bungalow, Dwarven Settlement, Ballista Tower |
| Level 3 | 3750 | 6 peasants, 3 collectors, 2 guards (1000 HP) | – | Temples to Helia and Lunord, Royal Gardens, Fairgrounds |

The **"heroes recruited" gate** means you have to invest in heroes, and lose some, before the town can grow up. It's
a neat way to stop players turtling with towers.

### Buildings

Costs are initial / level 2 / level 3. "Repeat" is how the price of each further copy grows (2n = each one costs
twice the last).

| Building | Palace | Cost | HP | Repeat | Needs / excludes | What it does |
| -------- | -----: | ---- | -- | ------ | ---------------- | ------------ |
| Warriors' Guild | 1 | 800 | 700 | ×2 | – | 4 Warriors (or Paladins / Warriors of Discord with the right temple). Call to Arms. Tough: used as a shield |
| Rangers' Guild | 1 | 700 | 250 | ×2 | – | 4 Rangers. Move Camp (800) |
| Rogues' Guild | 1 | 600 / 850 | 250 / 350 | ×2 | – | 4 Rogues. Extort. L2: free weapon poison |
| Wizards' Guild | 2 | 1500 / 2500 (3 levels) | 350 | ×4 | – | 4 Wizards; 2 sovereign spells per level; enchant hero gear +1/+2/+3; self-builds |
| Temples (7) | 2 or 3 | 900–1600 / … / … | 235–800 | ×1.5–×2 | Rival temples exclude each other | Temple heroes; one sovereign spell per level (see §7) |
| Elven Bungalow | 2 | 750 | 300 | ×2 | Inn + Marketplace; no dwarves or gnomes | 2 Elves; **doubles Marketplace income**; spawns an Elven Lounge (+ a Gambling Hall per Rogues' Guild) |
| Dwarven Settlement | 2 | 1187 | 600 | ×4 | Blacksmith L3; no elves or gnomes | 3 Dwarves; shoots at enemies; unlocks Ballista Towers |
| Gnome Hovel | 1 only | ? | ? | auto | No elves or dwarves; can't build after Palace L1 | 3 Gnomes (fast builders); 2 more hovels appear by themselves (max 3); rebuilt while any gnome lives |
| Marketplace | 1 | 1500 / 1000 / 1000 | 200 / 250 / 300 | ×1.29 | Minimum distance from other markets and trading posts | **Main income** (§5); sells potions (L1), Rings of Protection (L2), Amulets of Teleportation (L3); Market Day |
| Blacksmith | 1 | 500 / 570 / 760 | 250 / 300 / 400 | – | All its research done before each upgrade | Weapons and armour +1/+2/+3; **new buildings cost 5% less** (doesn't stack) |
| Inn | 1 | 400 | 120 | ×1.1 | – | Rest and heal away from home (4 g a rest); 90–120 g a day passive; elves perform here |
| Trading Post | 1 | 600 | 150 | ×~1.75 | Marketplace; distance rule | Sends caravans to the nearest market; sells potions |
| Library | 1* | 600 / 800 | 100 / 200 | – | Wizards' Guild | Research −5%; +INT for new recruits; spells and training (§6) |
| Guardhouse | 1 | 600 / 500 | 200 / 275 | ×1.25 | – | City guards; peasant refuge; **tax drop-off point** |
| Wizards Tower | 2 | 500 | 250 | flat | Near the Wizards' Guild or another tower | Extends guild spell range; Enchant (400) gives it an attack |
| Ballista Tower | 2 | 950 | 350 | flat | Dwarven Settlement (keeps working if the settlement is later destroyed) | Strong bolt tower |
| Statue | 2 | 600 | 60 | flat | – | +5 loyalty to all heroes (stacks) |
| Royal Gardens | 3 | 1140 | ? | ? | – | +15 loyalty to all heroes (stacks); a free Gazebo for resting |
| Fairgrounds | 3 | ~3000 → 9000 → 27000 | 800 | ×3 | – | Tournaments (XP), +1 STR for later recruits, good tax |

*The wiki puts the Library at Palace 1, but it needs the Wizards' Guild, which needs Palace 2.

**Buildings that appear by themselves**, as consequences of how you play:

| Building | Appears when | Effect |
| -------- | ------------ | ------ |
| House | Every 4th hero recruited | Small taxes; feeds Marketplace and Inn income; heroes' families |
| Fountain | Every 5 of Blacksmith / Marketplace / Inn / Gazebo (/ Fairgrounds / Gardens) built | **+1 tax collector** |
| Sewer Entrance | Every 9 buildings (counting houses, fountains, ruins, starting ones) | **Indestructible**; spawns rats and ratmen |
| Graveyard | About 15 heroes dead | **Indestructible**; spawns skeletons and zombies |
| Elven Lounge / Gambling Hall | Elves arrive (+ Rogues' Guild for the hall) | Untaxed money and time sinks for heroes |
| Gazebo | Royal Gardens | Free rest stop |

## 5. Economy (the heart of it)

**Gold is the only resource.** The loop:

```
 Treasury ──recruit/build/research/flags/spells──► the world
    ▲                                                  │
    │                                       heroes kill, loot, claim bounties
    │                                                  ▼
 Tax collectors ◄── building coffers ◄── heroes go home (guild tax) and shop (sales tax)
   (can be killed;      (can be robbed
    gold carried is      by ratmen; a destroyed
    lost)                building's gold goes to the monsters)
```

### Hero money

- A hero carries **taxable** gold (from kills, bounties, chests, lairs) and **untaxable** gold (a random starting
  amount, plus what they keep after tax).
- **Going home**: 40% of taxable gold goes into the guild's coffer, and the rest becomes untaxable. Rogues pay 30%.
  **Non-humans (elves, dwarves, gnomes) pay nothing.**
- **Shopping** spends untaxable gold first. **60% of the price goes into the shop's coffer (sales tax); 40% is
  "vaporised"**. One tip says the Blacksmith keeps 50%, so the split may vary by shop.
- **Bounty recycling**: 1000 gold spent on flags typically comes back as **600–760** through these taxes. So a
  bounty is a subsidy: you pay for the kill or the exploration, and most of the money returns as hero gear.
- Example: a potion costs the hero 50 and puts about 20 in the coffer.

### Building income

- **Marketplace** revenue per tick = *base* + 3 × houses + 5 × other marketplaces + 5 × trading posts, and
  **doubled if you have an Elven Bungalow**. It ticks every 30 / 22.5 / 15 s at market level 1 / 2 / 3. Base by
  Palace level × market level:

  | | Market L1 | L2 | L3 |
  | - | -: | -: | -: |
  | Palace L1 | 125 | 150 | 175 |
  | Palace L2 | 150 | 175 | 200 |
  | Palace L3 | 200 | 225 | 250 |

- **Market Day** (researched): instant gold of about 2× a normal tick, then the market is shut for 45 s (no sales,
  no income). Players also use it to throw loitering heroes out of the shop when monsters attack.
- **Caravans** leave a Trading Post every few minutes for the nearest market (by route length). The further they
  travel, the more they carry, and the cargo is **multiplied by the destination market's level** (500 → 1500 at
  L3). They are a classic escort target: greedy monsters (trolls) go for them and for trading posts.
- **Inn**: 90–120 g a day plus 4 g per hero rest. Elves sing there for their own money.
- **Houses**: small taxes. Guild and temple coffers fill from heroes coming home.

### Collection

- Gold sits in **coffers** until a tax collector picks it up. **Ratmen steal from coffers**, especially Marketplaces and
  Inns. Killing them returns most of it via nearby heroes, but heroes are paid, so only 60–76% gets home.
- Each collector has a **minimum pickup** (skip buildings holding less) and a **minimum return** (keep walking until
  carrying this much; default 250). Low pickup wastes time on small sums. High return keeps a collector out
  longer, and a dead collector loses everything he carried. Wiki advice: one collector on 400 return / 200 pickup
  for the big earners, another on 250 / 25 for the rest. **Keep shops near the Palace or a Guardhouse.**
- **Extort** (Rogues' Guild): collect everything instantly, but the guild keeps about 35% (34.5% at L2), caravans lose
  their multiplier, and 80% of every hero's taxable gold is converted. It even taxes non-humans. An emergency
  button.
- **Gambling Hall** (with elves and rogues): heroes waste gold there, and you can bet yourself. Blue pays 2× (1 in
  2), red 5× (1 in 5), gold 20× (1 in 20), skulls (1 in 4) lose everything.

### Sinks

Construction, upgrades, research, recruitment, flags, spells, and guild powers. **There is no upkeep and no wages**.
Heroes cost nothing after recruitment (compare Dungeon Keeper's payday). Hero gold that's "vaporised" or
spent in untaxed elven buildings leaves the economy.

## 6. Upgrade paths

### Items: research, then sell

Each shop level unlocks research, which **you** pay for. After that, **heroes** can buy the item with their own
gold, and you tax the sale. So you invest twice: in the shop, and in the heroes who will shop there.

| Shop | Research | Your cost | Hero pays | Effect |
| ---- | -------- | --------: | --------: | ------ |
| Blacksmith L1 | Bronze weapon / armour | 200 / 200 | ~100 / 300 | +1 |
| Blacksmith L2 | Silver weapon / armour | 300 / 300 | ~200 / 600 | +2 |
| Blacksmith L3 | Gold weapon / armour | 400 / 400 | ~300 / 900 | +3 |
| (lairs only) | Legendary | – | – | +4 / +5, random drops when +3 heroes raid lairs |
| Marketplace L1 | Healing Potion | 300 | ~50 | Heal |
| Marketplace L2 | Ring of Protection | 750 | ? | Armour +2, parry +10, dodge +10 |
| Marketplace L3 | Amulet of Teleportation | 1000 | "very expensive" | Teleport a fair distance |
| Wizards' Guild L1–3 | Enchant gear | – | ? | Weapon/armour +1 / +2 / +3 magic |
| Rogues' Guild L2 | Poison | – | free | +1 damage a second for 10 s |

Each class has its own gear line (Warrior: short sword 10 → broadsword 11 → longsword 12 → fine steel 13; partial
plate 9 → … → mithril 12). Barbarians start with a 22-damage axe and club but no armour; wizards and priestesses
don't use the smith at all. So **which shops pay off depends on the roster**: warriors and blacksmiths "go together
like bread and butter".

### Library (needs the Wizards' Guild)

- Free: research −5%, and **+1 INT for every hero recruited after it's built** (the bonus doubles in cost: +2 with 2
  libraries, +3 with 4, +4 with 8).
- Magic Resistance (250 to research): any hero can pay 300 for +5 resist, up to 50. This is the only way to raise resist.
- Train Intelligence (250): wizards only, +1 INT, up to 28.
- Fire Blast (500): free for wizards of level 3+. Meteor Storm (1500): wizards of level 7.
- Power Shock / Flame Shield (500 each at L2): any other hero who passes an INT check and pays 300.
- Library visits are low-priority actions with harsh odds, so in practice only wizards and priestesses use it much.
  Keep that in mind: **content that the AI rarely chooses is content the player never sees**.

### Hero growth

- **1000 XP per level, and all XP gained is divided by the hero's level**, so levelling slows down naturally.
- On level-up: +1 to each relevant combat stat, +1 to the **key attribute** every other level (the only primary stat
  that grows), and HP + 25–50% of Vitality.
- Each recruit rolls −2 to +2 on every primary stat except Willpower, so no two heroes of a class are the same.
- **Recruit-time bonuses** from buildings, so build order matters: Fairgrounds +1 STR, Library +INT, Temple to Krolm
  (+0.1 self-confidence, −5% flee threshold), gnomes +luck, and Statues / Royal Gardens +loyalty (these also
  apply to existing heroes).
- **Fairgrounds tournaments** (melee, archery, magic, combo): heroes nearby pay 10 to enter. Each gets 1000 × entrants
  / rank XP (still divided by level), the winner takes the pot, and with 5+ entrants the winner also gets a free
  level.
- Rangers leave the map when there's nothing left to explore and may come back later, stronger.

## 7. Temples and races: the identity choice

Temples need Palace 2 (Helia and Lunord need Palace 3). **Rival gods can't share a kingdom**, which forces a build
identity every game:

| Group | Temple | Hero | Costs (temple, L2, L3) | Spells by level | Excludes |
| ----- | ------ | ---- | ---------------------- | --------------- | -------- |
| Order | Agrela (life) | Healer (300) | 1000 / 1500 / 2600 | Healing 200, Blessing 100, Resurrection 1500 | Fervus, Krypta, Krolm |
| Order | Dauros (law) | Monk (550); also unlocks Paladins | 1600 / 2200 / 3400 | Stone Skin 200, Vigilance 800, Petrify 1500 | Fervus, Krypta, Krolm |
| Chaos | Fervus (nature, chaos) | Cultist (400); also unlocks Warriors of Discord | 900 / 1300 / 2500 | Healing 400, Illusionary Hero 500, Vines 1000. Spawns rocs, then vargs, then hellbears for cultists to charm | Agrela, Dauros, Krolm |
| Chaos | Krypta (death) | Priestess (400) | 1400 / 1800 / 2200 | Wither 300, Animate Bones 800, Reanimate 2000 | Agrela, Dauros, Krolm |
| Loner | Krolm (rage) | Barbarian (350), 4–6 | 900 (one level) | Rage of Krolm 1500 | **Every other temple** |
| Palace 3 | Lunord (moon, wind) | Adept (500) | 1000 / 2000 | Winged Feet 400, Wind Storm 1000 | Helia, Krolm |
| Palace 3 | Helia (sun, fire) | Solarus (500) | 1000 / 2000 | Fire Strike 350, Sun Scorch 1200 | Lunord, Krolm |

**Races** are a second exclusive pick: one of elves (rich economy but untaxed vice buildings), dwarves (defence and
building help, Ballista Towers) or gnomes (cheap, fast builders, more luck; only at Palace 1).

Players reason about these picks constantly (wiki strategy pages are full of "get Agrela and Dauros for cheap heals
on this map"). The choice is **readable** (two camps plus a loner), **consequential** (unit roster, spells and
economy all change) and **made early**.

## 8. Heroes

All classes, level 1. Speed is on a 1–5 scale; sight and range are in game pixels. Combat stats are percentages. Greed
and loyalty are hidden attributes (in the game files, not shown in game).

| Class | Home | Cost | HP L1 | Style | Speed | Sight | Key stat | STR | INT | ART | VIT | WIL | Melee / Ranged / Parry / Dodge / Resist | Greed | Loyalty |
| ----- | ---- | ---: | ---: | ----- | ---: | ---: | ---- | --- | --- | --- | --- | --- | --- | ---: | ---: |
| Warrior | Warriors' Guild | 450 | 18 | melee | 1 | 185 | Strength | 16–20 | 6–10 | 5–9 | 16–20 | 14 | 70 / 0 / 45 / 35 / 0 | 12 | 30 |
| Ranger | Rangers' Guild | 350 | 17 | ranged | 3 | 260 | Strength | 13–17 | 14–18 | 16–20 | 11–15 | 18 | 0 / 75 / 25 / 50 / 0 | 3 | 10 |
| Rogue | Rogues' Guild | 275 | 11 | ranged | 3 | 200 | Artifice | 7–11 | 13–15 | 23–28 | 9–13 | 3 | 0 / 55 / 35 / 45 / 0 | 26 | 0 |
| Wizard | Wizards' Guild (Palace 2) | 500 | 4 | magic | 1 | 240 | Intelligence | 1–4 | 23–27 | 2–6 | 2–6 | 17 | 25 / 0 / 15 / 25 / 35 | 11 | 30 |
| Paladin | Warriors' Guild + Temple to Dauros | 1000 | 21 | melee | 2 | 200 | Intelligence | 19–23 | 12–16 | 8–12 | 18–22 | 23 | 85 / 0 / 75 / 55 / 5 | 3 | 90 |
| Warrior of Discord | Warriors' Guild + Temple to Fervus | 900 | 35 | melee | 1 | 200 | Vitality | 33–37 | 1–4 | 3 | 33–37 | 12 | 95 / 0 / 30 / 30 / 0 | 4 | 0 |
| Healer | Temple to Agrela | 300 | 7 | support | 2 | 220 | Intelligence | 1–3 | 20–24 | 3 | 5–9 | 25 | 15 / 0 / 25 / 40 / 0 | 1 | 50 |
| Monk | Temple to Dauros | 550 | 19 | melee | 1 | 200 | Willpower | 15–19 | 18–22 | 3–7 | 17–21 | 27 | 55 / 0 / 75 / 70 / 30 | 2 | 30 |
| Priestess | Temple to Krypta | 400 | 10 | magic | 1 | 220 | Intelligence | 1–4 | 22–26 | 3–7 | 4–8 | 18 | 20 / 0 / 10 / 20 / 35 | 3 | 30 |
| Cultist | Temple to Fervus | 400 | 11 | ranged/melee | 3 | 260 | Artifice | 9–13 | 19–23 | 13–17 | 6–10 | 4 | 35 / 55 / 30 / 30 / 0 | 5 | 5 |
| Barbarian | Temple to Krolm | 350 | 20 | melee | 1 | 180 | Vitality | 23–27 | 3–7 | 7–11 | 18–22 | 8 | 85 / 0 / 45 / 55 / 20 | 9 | 40 |
| Adept | Temple to Lunord | 500 | 17 | melee | 5 | 200 | Strength | 14–18 | 17–21 | 5–9 | 13–17 | 16 | 75 / 0 / 75 / 75 / 0 | 2 | 95 |
| Solarus | Temple to Helia | 500 | 25 | melee | 2 | 200 | Strength | 17–21 | 14–18 | 4–8 | 16–20 | 15 | 85 / 0 / 55 / 60 / 0 | 3 | 15 |
| Elf | Elven Bungalow | 500 | 11 | ranged | 3 | 280 | Artifice | 8–12 | 16 | 20 | 9–13 | 6 | 0 / 90 / 15 / 60 / 30 | 23 | 15 |
| Dwarf | Dwarven Settlement | 500 | 22 | melee | 1 | 150 | Strength | 17–21 | 7–11 | 21–25 | 20–24 | 16 | 70 / 0 / 40 / 25 / 70 | 20 | 15 |
| Gnome | Gnome Hovel | 100 | 3 | melee (builder) | 2 | 180 | Willpower | 1 | 10–14 | 12 | 1–5 | 18 | 20 / 0 / 75 / 75 / 0 | 1 | 45 |

### What the attributes do

| Attribute | Effect |
| --------- | ------ |
| Strength | +1 physical damage per 8; HP repaired per hit when building; resisting Vines |
| Intelligence | +1 spell damage per 4; **odds of buying gear and how far they'll walk to shop (sight × INT / 2)**; library checks; healer heal range and power |
| Vitality | HP gained per level |
| Artifice | Stealing success; poisoning odds and travel distance |
| Willpower | Resisting the Lounge and Gambling Hall (d30 checks, so each point is about +3%) |
| **Greed** (hidden, 1–26) | **A flag's reward is multiplied by ⌊greed / 4⌋ when the hero weighs it**; how far they'll go to steal; gambling |
| **Loyalty** (hidden) | Low: steals from you, shops at rivals, answers rival flags. High: waits at an Inn if made homeless |
| **Self-estimation** (hidden, 0.3–2) | Multiplier on their own strength when judging a fight (gnome 0.3 … Warrior of Discord 2) |
| **Enemy estimation** (hidden, 1.9–0.5) | Multiplier on the enemy's strength (gnome 1.9 … Warrior of Discord 0.5) |
| **HP threshold** (hidden, 15–65%) | Below this they drink a potion, cast a heal, or think about fleeing. Most heroes 35%, Paladins and Warriors of Discord 15%, gnomes 65% |
| Sight range | What they react to and how far they'll walk for services |

So **courage is two numbers** (how strong I think I am, how strong I think you are), **greed is a bounty
multiplier**, and **shopping depends on intelligence**. These few hidden numbers carry almost all the personality.

### How a hero decides: the "thought process"

The manual gives every class an ordered list. First come fixed checks:

1. Hostiles nearby? (fight or flee, using the estimates above)
2. Is any reward flag interesting? (reward × ⌊greed/4⌋ against risk and distance)
3. Is my home or the Palace (or a building this class cares about) under attack? Defend it.
4. Rest if hurt. Upgrade gear or stats if I can afford it. Entertainment check (willpower against Lounges and the Gambling Hall).

Then a list of class-specific activities, each with a percentage. The natural reading, which is how the data file
stores it, is that the list is walked in order and each item fires with its chance; the first one that fires is
done. **Wander** is the fallback. The percentages per class:

| Class | Raid lair | Raid enemy bldg | Fight monsters | Explore | Go home | Inn | Learn spell | Train resist | Pick up items | Gardens | Steal | Signature actions (chance) |
| ----- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---- |
| Warrior | 95% | 90% | 95% | 45% | 90% | 50% | 10% | 10% | 20% | 20% | – | defends the Temple to Agrela; fights enemy heroes (95%) |
| Ranger | 15% | 10% | 75% | 95% | 15% | 15% | 30% | 15% | – | 30% | – | defends the Trading Post; collects healing herbs (95%); follows and supports a Barbarian (90%); journeys to distant lands (30%) |
| Rogue | 35% | – | 65% | 20% | 95% | 35% | 25% | 15% | 90% | 30% | 95% | defends the Gambling Hall; **loots gravestones (100%)**; collects poison plants (90%) |
| Wizard | 45% | 30% | 65% | 50% | 85% | – | 90% | 15% | – | 5% | – | defends Library and Marketplace; trains INT (55%); follows a Barbarian (30%) or Monk (20%) |
| Paladin | 85% | 85% | 90% | – | 80% | – | – | 25% | – | 10% | – | defends the Temple to Dauros; fights enemy heroes (80%) |
| Warrior of Discord | 95% | 95% | 95% | – | 50% | – | 5% | 5% | – | 20% | – | defends the Temple to Fervus; fights enemy heroes (95%) |
| Healer | – | – | – | – | 90% | 20% | – | 35% | – | 50% | – | **heals others (95%)**; follows and heals a Warrior (75%), Tax Collector (50%), Wizard (35%); plants healing herbs (50%) |
| Monk | 50% | – | 75% | – | 60% | 50% | 55% | 45% | 70% | 40% | – | defends the Marketplace; **guards a Healer (95%)**; guards a Caravan (75%) |
| Priestess | 40% | 30% | 75% | 50% | 80% | – | 70% | 45% | – | 15% | – | **raises skeleton followers (95%, before everything)** |
| Cultist | 20% | 20% | 85% | – | 30% | – | 30% | 25% | 45% | 50% | 25% | **charms animals (95%, first)**; swarms with other Cultists (90%); patrols a creature den (60%); plants poison plants (55%) |
| Barbarian | 95% | 95% | 95% | 45% | 45% | – | 5% | 5% | 30% | – | – | defends the Rangers' Guild |
| Adept | – | – | 60% | – | 95% | – | 40% | 25% | – | 20% | – | **patrols the kingdom (95%)** |
| Solarus | 95% | – | – | 75% | 5% | – | 50% | 15% | – | 15% | – | defends the Marketplace; **finds hidden lairs and raids them (95%)**; garrison check (50%) |
| Elf | 15% | 15% | 80% | – | 90% | 50% | 55% | 25% | 80% | 45% | 50% | defends Gambling Hall and Lounge; performs at the Inn (50%), Trading Post (35%), Marketplace (20%) |
| Dwarf | 75% | 80% | 15% | – | 80% | 20% | 25% | 15% | 40% | – | – | defends the Blacksmith; **helps build (85%)** |
| Gnome | – | – | 20% | – | 90% | – | 15% | 10% | – | 50% | – | **helps build (75%)** |

What to take from this:

- **Cheap personality.** An ordered list plus a few percentages gives each class a clear temperament. The orders
  matter as much as the numbers: a ranger checks explore (95%) before fighting, a rogue checks gravestones and stealing
  before anything else.
- **Built-in cooperation.** Healers follow warriors, monks guard healers and caravans, rangers and wizards tag along
  with barbarians, cultists swarm. Parties form without any party system.
- **Classes defend different buildings** (warriors the Agrela temple, monks the market, dwarves the smith), so where
  you put things decides who shows up to defend them.
- **Lair raiding needs nerve.** Warriors list "raid lair" at 95%, but the fixed fight-or-flee check uses the
  self/enemy estimates, and heroes "startle easily" without a flag, a level advantage or numbers. That's why players
  feel heroes won't take lairs on alone, and why attack flags exist.

## 9. Combat model

- **Melee**: attacker rolls under Hand-to-Hand, then defender rolls under Parry to avoid it. **Ranged** uses Ranged and
  Dodge. **Magic** always hits unless the defender rolls under Resist. Attacks on buildings always hit.
- **Hero weapon damage** = random(1 … weapon) + magic bonus + STR / 8. **Spells** + caster INT / 4. Spell ranges roll
  1 … max, raised to the minimum, so they skew low.
- **Monster damage** = X + random(1 … STR − X), where X = STR / 4.
- **Armour** stops ⌊armour/2⌋ + random(0 … armour − ⌊armour/2⌋ − 1) + magic bonus. **Buildings take half damage.**
- Stats are effectively capped at 95 (85 for defence in multiplayer).
- Small HP numbers (wizard 4 HP at level 1, warrior 18) make early heroes fragile and levels matter a lot.

## 10. Threats

| Source | Behaviour |
| ------ | --------- |
| **Lairs** (dens, ruined keeps, dark castles, goblin camps) | Spawn monsters until destroyed; destroyed by attacking them; drop treasure (and legendary gear) |
| **Wandering monsters** | Walk in from the map edges |
| **Scripted quest events** | Waves, bosses and set pieces so there's always something to fight |
| **Sewer Entrances** (every 9 buildings) | Rats and ratmen; **ratmen steal coffer gold** and waylay tax collectors |
| **Graveyards** (~15 dead heroes) | Skeletons and zombies. Krypta priestesses can charm undead |
| **Trolls** (every 1000 vaporised gold) | Appear at one of your buildings and head for Marketplaces and Trading Posts; regenerate |
| **Minotaurs** (every 25 Blacksmith visits) | Come in from an edge and raid the nearest building |

Monsters have favourite behaviours ("raider", "item hunter") and **carry gold** (a minotaur 85, a Black Phantom
800), which becomes hero income. Notable types: goblin warbands (archers, priests, champions, overlords guarding
lairs), ratmen (thieves), vampires (reflect magic), evil oculi (paralyse), dragons (fast, ranged fire), daemonwoods
and strangleweeds (stationary or guarding, regenerate), rust spitters (acid that melts armour), and late bosses.

**The rule to remember: the kingdom's own growth makes threats.** More buildings mean sewers, more spending means
trolls, more smithing means minotaurs, more dead heroes mean graveyards. The game balances itself against how
well you're doing.

## 11. The Northern Expansion's additions

| Building | Role |
| -------- | ---- |
| Embassy | Auto-recruits veteran heroes (level 2+) into empty guild slots for about the normal price (±200), even classes you couldn't otherwise get; houses 2 homeless heroes |
| Outpost | A second seat: if the Palace falls you rule from here; peasants, a collector, guards, houses 6 heroes, tax drop-off |
| Hall of Champions | **Put a bounty on a whole monster type** for a while (marked with a medallion); visiting heroes get bonus HP and healing |
| Mausoleum | Stores up to 10 dead heroes for paid resurrection; prevents Graveyards, but **releases an undead horde if destroyed**. Healers, monks and paladins refuse it |
| Magic Bazaar | Potions: speed, fire arrows, strength, regeneration, invisibility, shapeshift |
| Sorcerers Abode | Six spells on a shared cooldown, cast anywhere (Change of Heart, Frost Field, Earthquake, Chain Lightning, Gate, Dismiss) |

Plus new enemies (Goblin Overlord, Greater Gorgon, Ice Dragon, Ratapult siege engine, Ratman Champion and Shaman,
Shadow Beast, Yeti).

## 12. What worked, what didn't

**Praised** (Computer Gaming World's "Pleasant Surprise of the Year", PC GameRankings 76): the genre mix, the
"quick-paced, hands-off formula", and the stories personalities create.

**Criticised**: weak multiplayer. The design itself also causes some friction:

- **Opacity.** The hidden attributes and decision lists live in the game files, not on screen, so a hero refusing
  a flag feels arbitrary.
- **Fragile early heroes** (a 4 HP wizard) and the gold you lose with them.
- **Content the AI rarely uses** (library spells, Fairgrounds training that's bugged) is wasted.
- **Exploits players love**, like Market Day spam, building a Dwarven Settlement for Ballista Towers then destroying it
  to bring in elves, or flagging your own unwanted buildings, show that players enjoy **gaming the incentive system**.
  That's a feature to keep, not a bug to remove.

**On phones**: HeroCraft's 2011 "Majesty" for iOS/Android (Metacritic 72 on iOS) was its own game, not a port,
which shows the loop survives a touch screen. There was also a fan-made browser game, *Majesty: Heroes of Ardania*.
Other games in the same world are *Defenders of Ardania* (tower defence, 2011), *Impire* (2013) and the *Warlock*
4X games (2012, 2014).

## Sources

- Majesty wiki (majesty.fandom.com), via its MediaWiki API: Palace, Building, Economy, Tax Collector, Marketplace,
  Blacksmith, Full List of Blacksmith Armor and Weapon Upgrades, Inn, Library, Trading Post, Caravan, Guardhouse,
  Ballista Tower, Wizards Tower, Statue, Fountain, House, Sewer Entrance, Graveyard, Gravestone, Henchmen, Peasant,
  Palace Guard, City Guard, Heroes, Attributes, Combat System, all guild, temple and hero pages, Sovereign Spells,
  Elven Bungalow, Gambling Hall, Elven Lounge, Dwarven Settlement, Gnome Hovel, Royal Gardens, Fairgrounds, Gazebo,
  Embassy, Outpost, Hall of Champions, Mausoleum, Magic Bazaar, Sorcerers Abode, Troll, Minotaur, Ratman and other
  monster pages, Fog of War, Freestyle Game, Starting a Game, Quests, Majesty: The Northern Expansion, Majesty series.
  Hub: <https://majesty.fandom.com/wiki/Majesty:_The_Fantasy_Kingdom_Sim_Wiki>
- [Wikipedia: Majesty: The Fantasy Kingdom Sim](https://en.wikipedia.org/wiki/Majesty:_The_Fantasy_Kingdom_Sim)
- [MobyGames](https://mobygames.com/game/1277) · [LaunchBox](https://gamesdb.launchbox-app.com/games/details/132451)
- [Steam discussion on temples](https://steamcommunity.com/app/73230/discussions/0/359543542250490722) · [Cat's Musings on temple tiers](https://conchcat.bearblog.dev/11092025-01/)
