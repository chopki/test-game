# Research: a Majesty-style kingdom game

What *Majesty: The Fantasy Kingdom Sim* and its relatives do, what worked and what didn't, and how a similar
web/phone game could be built, ideally on top of Hold the Hall's engine. This is a research note, not a commitment:
nothing here is in the [roadmap](../ROADMAP.md) yet.

## TL;DR

- **The core idea is indirect control.** You never order a unit. You build guilds that recruit **heroes**, who
  act on their own and have their own personalities. You steer them only by putting **gold bounties** on things
  (kill this, explore there). The fun comes from heroes being half-reliable: you set incentives, then watch the
  results, good or bad.
- **The economy is a loop through the heroes.** Heroes earn gold from kills and bounties, then spend it in *your*
  shops (blacksmith, marketplace, inn, temple), and you tax every sale. Gold goes out as bounties and comes back as
  taxes, and the heroes get stronger in the process.
- **What players criticised:** repetitive scenarios (Majesty 2, *Crown of Greed*), heroes that won't attack lairs on
  their own, levelling that feels flat within a mission, and the sequel's removal of real build decisions.
- **Recommendation:** build it as a third mode of this codebase (a **"Realm" mode** next to Survival and Conquest),
  not as a new project. About 60–70% of what it needs already exists: autonomous troops with A* pathing, heroes with
  XP/levels/abilities, neutral camps that refill, per-team economies, a seeded terrain generator, waves, the sprite
  pipeline and the phone HUD. The new work is the hero decision AI, bounty flags, the shop/tax loop and fog of
  war. Hold the Hall's walls and breach-cost pathing would be a real differentiator: Majesty's towns were basically
  undefended sprawl.

---

## 1. Majesty: The Fantasy Kingdom Sim (Cyberlore, 2000)

PC 2000 (MicroProse/Hasbro), Mac 2000, Linux 2003; *The Northern Expansion* 2001. Mobile ports by HeroCraft
(Android 2011, iOS 2011, Windows Phone 2012), with Metacritic 72 on iOS, so the design has already been shown to
work on a phone. PC GameRankings 76. *Computer Gaming World* gave it "Pleasant Surprise of the Year" for its
"quick-paced, hands-off formula". The main complaint was weak multiplayer.

### Structure

- 19 standalone **quests** (scenarios), each on its own map with its own win condition, plus a randomised
  **freestyle** mode. No overarching campaign plot.
- The map starts hidden: heroes and henchmen reveal it as they explore.

### Units

| Group | Units | Notes |
| ----- | ----- | ----- |
| **Heroes** (autonomous) | Warrior, Ranger, Rogue, Wizard, Paladin\*, Warrior of Discord\*, Healer, Priestess, Cultist, Monk, Barbarian, Adept, Solarus (temples); Elf, Dwarf, Gnome (racial) | Have XP, levels, stats and an inventory. Recruited from guilds/temples, typically 4 per building. \*Needs a guild plus a specific temple |
| **Henchmen** (automatic) | Peasants (build/repair), Tax collectors, Palace guards | Replaced automatically when they die |

Each class has a temperament, and that temperament is the gameplay:

- **Rogues** are greedy. They chase every bounty first, steal, and can "Extort" gold (fast but lossy).
- **Paladins** go for dangerous monsters and raid lairs.
- **Rangers** explore. **Warriors** fight and defend.
- **Wizards** are slow, fragile and expensive, need a library for spells, and are very strong at high level.
- **Elves** perform at inns. Only one of elves, dwarves or gnomes can live in your town.

### Buildings (four roles)

1. **Hero housing**: guilds and temples. Some temples are mutually exclusive (rival gods: Agrela/Fervus,
   Lunord/Helia at the third tier, Krypta, Krolm, Dauros…), which forces a build identity every game.
2. **Hero services**: blacksmith (weapons/armour), marketplace (potions, items), inn, fairground, library, royal
   gardens. Upgrading them unlocks better gear for heroes.
3. **Defence**: guard towers and guard posts.
4. **Income**: the marketplace (caravans) is the biggest earner, and many buildings yield daily income.

### The bounty flags

- **Attack flag** on a monster or lair, **Explore flag** on a map area. You fund them with gold that is **paid
  immediately and can't be taken back**.
- A bigger bounty attracts more heroes and braver ones. Heroes judge whether the reward is worth the risk, so a
  small bounty on a dragon gets ignored.
- Cooperation isn't guaranteed. Without a bounty, heroes **never attack enemy buildings** and don't gang up on
  strong foes, so bounties are both your steering wheel and your main gold sink.

### Economy

- **Gold is the only resource.**
- Heroes earn gold (kills, bounties, lair treasure, chests). They **pay taxes when they return home**, then spend
  the rest on gear, enchantments, potions and items in your shops.
- **Tax collectors** walk round the buildings collecting the gold in them and carry it back to the palace. They can
  be killed on the way. You can set each building to collect, exempt or collect once.
- Some choices are traps: elves double one income source but add a gambling hall and lounge that drain heroes'
  gold without paying you tax.

### Threat

- **Lairs** (dens, ruined keeps) spawn monsters until heroes destroy them.
- **Growth spawns** you can't destroy: sewer grates appear as the town grows (rats), and graveyards appear where
  heroes die. Your success creates new trouble.
- Scripted events make sure there is always something to fight.

### Why it worked

1. **Personalities make stories.** "The rogue took the bounty and ran while the paladin died holding the gate" is
   the game's appeal.
2. **A single resource, used in one loop**, so the economy is easy to read but has depth (taxes ↔ bounties ↔
   hero power).
3. **Low APM, high judgement.** A good fit for phones and for playing while doing something else.

## 2. Majesty 2 (1C:Ino-Co / Paradox, 2009)

3D remake. Changes worth knowing about:

- **Four flags:** Attack, Explore, **Defend** (time-limited, so it has to be renewed, and reviewers found it the
  most frustrating) and **Fear** (keeps heroes away; the bounty sets which levels it scares off).
- **Taverns form parties of up to 4 heroes**: you announce a party, heroes signal "looking for group", and you pick
  members. This fixes the "heroes never cooperate" problem.
- **Lords**: at the end of a mission you can promote one hero to Lord and summon them on later maps (from a
  specific building), which carries progress between missions.
- **The cost of each extra building of a type rises**, pushing towards small, upgraded towns. One review argued
  this *removed* decisions: in the original, three level-1 marketplaces vs one level-3 was a real choice.
- At launch it had **no freestyle mode, no co-op and no random maps**. Random dens and a map generator were added
  later (patch 1.3, *Kingmaker*). Reviewers' main complaint was **repetition**: "repetitive, formulaic missions"
  (GameSpot 6.5), "coaxing them around soon starts to feel like a chore".

**Lesson:** procedural maps and a freestyle mode aren't extras. Without them, an indirect-control game gets stale
fast.

## 3. Related games and what to take from each

| Game | Core mechanic | Take | Avoid |
| ---- | ------------- | ---- | ----- |
| **Crown of Greed** (2026) | The newest serious Majesty successor: bounties and rewards only, heroes with **weighted personality traits** rather than fixed rules | Weighted traits | Flat in-mission levelling, slow hero unlocks, no factions, no random maps or freestyle (all criticised) |
| **Kingdom Two Crowns** | The monarch can't fight; **coins are the only verb**. Recruit vagrants, then **equip a tool to give a job** (bow → archer, hammer → builder) | One-verb clarity, visual-only teaching, night raids against walls | Being opaque about upgrades |
| **Dungeon Keeper / War for the Overworld** | Creatures with **needs and wages** (lair, food, pay day); leave if unhappy | Needs that create logistics; heroes complaining when unpaid | Micromanagement of needs |
| **RimWorld** | An **AI storyteller** paces events; pawns have traits | An event deck that reacts to how well you're doing, as a cure for repetition | — |
| **Kingdom Rush** (mobile TD) | Phone-native touch UX, short levels, readable at a glance | HUD and controls benchmark for phones | — |
| **Majesty mobile / Heroes of Ardania** (HeroCraft) | Direct ports and a spin-off for phones | Proof that the loop survives a touch screen | — |

## 4. Design lessons for our version

1. **Make intent visible.** Indirect control only feels fair if you can see *why* a hero did something. Show an
   intent icon over each hero (⚔ bounty, 🛒 shopping, 💤 resting, 🧭 exploring, 🏃 fleeing), a dotted line to their
   target when selected, and short thought barks ("50 gold for a troll? No thanks."). Majesty hid this, and most of
   its frustration came from that.
2. **Personality as weights, not scripts** (as *Crown of Greed* does): each hero rolls traits within its class's
   bands, so two rangers behave differently.
3. **Let heroes cooperate on their own** (Majesty 2 parties), or at least join a fight a guild-mate is losing.
   Getting one-shot by a lair because nobody joined in is the main way the AI feels stupid.
4. **Keep "many cheap vs one upgraded" a real choice.** Don't use Majesty 2's escalating building cost.
5. **Make growth create threat** (sewers, graveyards). It's a good self-balancing mechanism.
6. **Procedural maps and a freestyle mode from day one.** We already have the generator.
7. **Levelling that shows within a mission**: visible gear tiers on the sprite (we already do stage sprites for
   buildings), a new ability at levels 3 and 6.
8. **Carry something between runs** (Lords): one veteran hero carries over, which gives runs a story without
   breaking balance.

## 5. Proposed game: "Realm" mode

> You are the crown, not the sword. Found a town in the wilds, raise guilds, and pay heroes to make the land
> safe, while raiders come at night for your walls.

### Core loop

```
 Build guilds/shops ──► heroes recruit ──► place bounties ──► heroes hunt, explore, loot
        ▲                                                           │
        │                                                           ▼
   tax income ◄── tax collectors ◄── shop sales ◄── heroes spend gold in your shops
        │
        └──► night raids (existing waves) test your walls; lairs grow if left alone
```

### Hero decision AI (utility scoring)

Every ~0.5 s (staggered across heroes) each hero scores its options and takes the best, with hysteresis (stick
with the current goal unless something beats it by about 20%) so it doesn't dither.

| Option | Score (sketch) |
| ------ | -------------- |
| Fight a foe in sight | `bravery × (power / threat)`; drops sharply when HP is low |
| Pursue a bounty | `reward × greed / (distance + k) × riskTolerance(power / threat)` |
| Explore | `curiosity × unexploredNearby / distance` |
| Go home: rest/heal | `(1 − hp/maxHp)²` or fatigue |
| Shop | `goldCarried ≥ nextUpgradePrice` and a shop that sells it exists |
| Defend home | `loyalty × threat near own guild` |
| Flee | `hp/maxHp < cowardice` and losing |

- Traits per hero: greed, bravery, curiosity, loyalty, cowardice (class bands, seeded roll).
- `power` and `threat` come from a single "combat rating" (`hp × dps`) that's also shown in the UI.
- Pure functions in `src/sim/heroAI.js`, so every rule gets a unit test ("a greedy rogue picks the 200-gold flag
  over the nearer 50-gold one").

### Bounty flags

- **Attack / Explore** in the MVP; **Defend** (lasts N seconds) and **Fear** later.
- The gold goes into the flag up front (a gold sink, as in Majesty). You can add more to it but not take it back.
- Payout: split by damage share among heroes who hit the target, with a minimum share, so a rogue can't snipe the
  last hit and take everything. This also rewards ganging up.
- On a phone: long-press a monster or the ground → radial menu (Attack / Explore / Defend / Fear) → amount stepper
  (+25 / +100). A flag shows its pot and the heroes who have accepted it.

### Economy (gold only at first)

- **Income:** hero taxes (a percentage of gold carried home), a margin on shop sales, a small marketplace trickle,
  lair treasure.
- **Collection:** gold builds up *in* buildings, and tax collectors walk it to the Hall, so raids and wandering
  monsters can intercept them. That gives walls and towers a job beyond guarding the Hall.
- **Sinks:** buildings, upgrades, recruiting heroes, bounties, temple spells (heal / haste).

### Content for the MVP

| Kind | MVP | Later |
| ---- | --- | ----- |
| Guilds | Warriors' Guild, Rangers' Guild | Rogues', Wizards', two rival temples (mutually exclusive) |
| Services | Blacksmith (2 gear tiers), Marketplace (potions) | Inn (rest faster), Library, Tavern (parties) |
| Henchmen | Peasant builder, Tax collector | Guards |
| Threat | Two lair types (bandit camp reusing `camps.js`, wolf den), night raids (existing waves) | Sewers and graveyards, a boss lair, wandering monsters |
| Flags | Attack, Explore | Defend, Fear |
| Win | Destroy all lairs, or hold N nights | Scenario list, freestyle with modifiers |

### Phone and web specifics

- **Sessions of 15–25 minutes**, with game speed 1×/2×/3× and pause. Low APM suits phones.
- **Save/continue is required**, because phone sessions get interrupted (already a roadmap "later" item, and
  entities are already plain data).
- **Installable app:** a PWA first (manifest and a service worker that caches the atlas), then Capacitor for the
  app stores if wanted. The deterministic sim and baked-sprite renderer already fit this.
- **Performance:** the heroes plus henchmen plus monsters target is under about 150 units. Utility AI ticks
  staggered, A* paths cached per goal, the flow field unchanged for raids.

## 6. Fit with this codebase

| Needed | Exists today | Work |
| ------ | ------------ | ---- |
| Autonomous units with pathing | `troops.js` (guard posts, `walkTo`, A* in `pathfind.js`) | Generalise from "guard a post" to goal-driven |
| Heroes with levels/abilities | `heroes.js`, `HEROES` in config (XP, levels, abilities, respawn) | Many heroes per side, traits, inventory |
| Lairs that refill | `camps.js` (bandit camps, respawn, growth) | Lairs that *send out* monsters, destroyable buildings |
| Flags on the map | `flags.js` (capture flags; rendering and UI exist) | New bounty-flag entity with a gold pot |
| Gold per team | `Economy.js`, `economyOf(team)` | Gold carried by units and stored in buildings |
| Map generation | `terrain.js` (seeded woods, rock, rivers, hills, coast) | Lair and point-of-interest placement |
| Raids | `WaveManager.js`, flow field, walls and breach cost | Time waves to a day/night clock |
| Rendering | sprite baker, animated units, stage sprites, phone HUD | Hero gear tiers, intent icons, fog of war |
| — | **No fog of war** | Explored-tile grid in sim, darkening layer in renderer |

Following the project rules: all logic in `src/sim/` (no three.js or DOM), every number in `config.js`, input only
through `World` methods (new ones: `placeBounty`, `fundBounty`, `recruit`), tests in `test/`, and
`World({ mode: 'realm' })` alongside `'survival'` and `'conquest'`.

### Suggested phases

1. **Prove the loop (playable prototype).** Realm mode on the open map, Warriors' and Rangers' guilds, Attack and
   Explore flags, utility AI (fight/bounty/explore/rest), one lair type, gold carried home and taxed. Unit-test the
   AI choices. Question to answer: *is placing bounties and watching fun?*
2. **Close the economy.** Blacksmith and Marketplace, gear tiers, tax collectors, fog of war, intent icons and barks.
3. **Threat and identity.** Night raids against walls, second lair type, growth spawns, rogues and wizards, rival
   temples, Defend and Fear flags.
4. **Longevity.** Freestyle with modifiers, a storyteller-style event deck, Lords carried between runs, save/load,
   PWA install.

## 7. Open questions for you

1. **A mode of Hold the Hall or a separate game?** I recommend a mode (shared engine, art and tests). A separate
   repo would only make sense for a different art style or setting.
2. **Setting:** stay with the grounded medieval look (human raiders, palisades), or go fantasy (monsters, wizards,
   gods) like Majesty? The class/temple roster above assumes some fantasy, while the current art and enemies are
   historical.
3. **How much direct control?** Pure Majesty (none), or one directly controlled ruler-hero (as in the v0.5 roadmap
   item) alongside autonomous ones?
4. **Monetisation and stores**, if this becomes an app: this affects whether a meta-progression layer (Lords,
   unlocks) is needed early.

## Sources

- [Majesty: The Fantasy Kingdom Sim (Wikipedia)](https://en.wikipedia.org/wiki/Majesty:_The_Fantasy_Kingdom_Sim)
- [Majesty 2: The Fantasy Kingdom Sim (Wikipedia)](https://en.wikipedia.org/wiki/Majesty_2:_The_Fantasy_Kingdom_Sim)
- [Majesty (MobyGames)](https://mobygames.com/game/1277) · [LaunchBox entry](https://gamesdb.launchbox-app.com/games/details/132451)
- [Majesty wiki: Heroes](https://majesty.fandom.com/wiki/Heroes) · [Steam discussion on temples](https://steamcommunity.com/app/73230/discussions/0/359543542250490722) · [Cat's Musings on temple tiers](https://conchcat.bearblog.dev/11092025-01/)
- Majesty 2 previews and review: [GameBanshee preview](https://www.gamebanshee.com/xxyr), [GameBanshee preview 2](https://gamebanshee.com/xxyq), [GameBanshee review](https://gamebanshee.com/a84), [Gaming Nexus](https://www.gamingnexus.com/Article/2352/Majesty-2-The-Fantasy-Kingdom-Sim), [GameSpot Q&A](https://www.gamespot.com/articles/majesty-2-the-fantasy-kingdom-sim-updated-qanda/1100-6192803/), [Aywren: Majesty 2 Collection (Lords)](https://aywren.com/2015/06/04/steam-challenge-majesty-2-collection)
- Crown of Greed: [Steam](https://store.steampowered.com/app/1697870/), [Galaxus review](https://www.galaxus.de/en/page/gold-instead-of-obedience-crown-of-greed-tested-42293), [wasdland player review](https://www.wasdland.com/game/crown-of-greed-1697870/)
- [Kingdom Two Crowns (Wikipedia)](https://en.wikipedia.org/wiki/Kingdom_Two_Crowns) · [Push Square review](https://pushsquare.com/reviews/ps4/kingdom_two_crowns)
- Dungeon Keeper, RimWorld, Kingdom Rush and the tax-collector details come from general knowledge of those games,
  not from the searches above.
