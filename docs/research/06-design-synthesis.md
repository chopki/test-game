# Design synthesis: how it all fits together, and a proposal for our game

This pulls files 01–05 together (07–09 hold the detailed building, unit and enemy catalogues and proposals): how Majesty's systems interlock, what sets each related game apart, and a concrete
starting design for our own. Nothing here is in the [roadmap](../ROADMAP.md) yet.

**Decided so far**: either a mode of Hold the Hall or a new game is fine; medieval, fantasy or a crossover is fine;
monetisation is low priority (this is for personal pleasure). **Open**: the control model (the main research
question; see [04-control-models.md](04-control-models.md)).

---

## 1. How Majesty fits together

```
                ┌──────────────────────── IDENTITY PICKS ────────────────────────┐
                │ temples (Order / Chaos / Krolm alone; Sun vs Moon), one race    │
                └───────────────┬─────────────────────────────────────────────────┘
                                │ decides the roster, spells, shops worth building
                                ▼
 GROWTH LOOP          PALACE tier ◄── needs N heroes recruited + gold
 build → unlock            │ unlocks guilds, temples, shops, more henchmen
                           ▼
 HERO LOOP      guild ─recruit─► HERO (traits: greed, courage, loyalty, INT, willpower)
                                   │  ordered "thought process" + flags
                     ┌─────────────┼──────────────┬───────────────┐
                     ▼             ▼              ▼               ▼
                 fight/raid     explore       go home          shop / rest / vice
                 (XP, loot)     (reveals map    (40% guild       (60% sales tax,
                     │           → can build)   tax)             40% vaporised)
                     ▼                              │               │
 GOLD LOOP      taxable gold ───────────────────────┴──► COFFERS ◄──┘
                                                         │ robbed by ratmen,
                                                         │ looted if destroyed
                                         tax collectors walk routes (killable)
                                                         ▼
                                                     TREASURY ──► build, research, recruit,
                                                         ▲          FLAGS (bounties), SPELLS
                                                         └── most bounty gold returns via taxes

 THREAT FEEDBACK  every 9 buildings → sewer (ratmen steal coffers)
                  ~15 dead heroes  → graveyard (undead)
                  1000 vaporised   → troll (attacks markets)
                  25 smith visits  → minotaur raid
                  + lairs (spawn until destroyed), wandering monsters, scripted events
```

How the parts connect:

| This | affects | through |
| ---- | ------- | ------- |
| Building placement | Hero behaviour | Classes defend particular buildings; inns as forward bases; travel distance to shops (INT × sight) |
| Shops | Hero power **and** income | Research → heroes buy → stronger heroes → bigger kills → more gold → more shopping |
| Bounties | Hero activity **and** the economy | Steers who goes where; 60–76% of the gold comes back |
| Hero deaths | Economy, threat | Lost gear and gold; graveyards; resurrection is a big sink |
| Town size | Threat | Sewers, trolls, minotaurs; longer tax routes; more coffers to rob |
| Exploration | Building space | You can't build in the fog, so exploring opens the map |
| Identity picks | Everything | Roster, spells, which shops matter, which threats are easy |
| Palace gate | Pace | Recruiting (and losing) heroes is the way up |

**Why it holds together**: every system feeds at least two others, and almost all of it runs **through the
heroes**. The player never touches the outcome directly, only the incentives and the stage. That is the design's
strength and its main source of frustration.

## 2. What sets each game apart

| Game | Its one idea | The thing to borrow |
| ---- | ------------ | ------------------- |
| Majesty 1 | Gold-driven free-willed heroes; a taxed hero economy | Hidden traits as a few numbers, ordered decision lists, growth spawns, exclusive temples |
| Majesty 2 | 3D Majesty with parties and promotion | Defend and Fear flags, promotion, Lords; and the warning: no random maps means repetition |
| Crown of Greed | Trait-driven heroes, meta between scenarios | Random positive/negative traits; Heritage Points; the review checklist (speed control, pings, visible levelling) |
| Kingdom | The monarch is the cursor; coins are the only verb | Tool = job; carried gold; Greed waves timed to midnight; Blood Moons; winter |
| Dungeon Keeper | A selfish workforce with needs and wages, and a hand | Payday, rooms that attract species, thought bubbles, drop-to-assign, slap |
| Black & White | Teaching an agent by reward and punishment | Clear cause and effect is mandatory; repetition wears off |
| Thronefall | A cut-down RTS: preset slots, one payday, one king | Gold at dawn from survivors; fork upgrades; follow-me |
| Dungeon Village | Majesty's shop loop as a phone game | Buildings level from use; adjacency bonuses; upkeep; volunteers |
| Against the Storm | A race between two meters; expansion raises danger | Hostility from opened fog; a clear end to each run |
| RimWorld | Autonomy plus drafting; a director tied to wealth | Draft for crises; raid points from wealth |
| Stronghold | One popularity meter from a few levers | Taxes / food / ale / faith / fear for the townsfolk |
| Kingdom Rush | Polished phone TD with a level-4 fork | HUD and readability bar; rally points; early-call bonus |
| Darkest Dungeon | Expendable, flawed heroes; the town maintains them | Stress and quirks; town buildings as hero upkeep |

## 3. Big choices for our game

### Mode or new game?

**Recommendation: start as a third mode (`World({ mode: 'realm' })`) in this repo, in its own sim modules** (for
example `src/sim/realm/`) so it can be split out later. It reuses the terrain generator, flow fields, walls and
towers, troops and A*, Conquest heroes, camps, flags, the sprite pipeline, the phone HUD and the test harness. If the
playtests favour the embodied-monarch model (D in file 04), that is when a separate game makes sense, because it
changes the camera and the whole interface.

### Setting: a crossover (proposed)

**A grounded medieval kingdom on the edge of folklore wilds.** Human raiders still come at night (our existing army:
swordsmen, pikemen, archers, knights, rams, catapults), and **the wilds by day hold folklore beasts and outlaws** in
lairs: wolves and bandits first, then trolls, barrow-wights and wyverns. Gods appear as **old faiths and new**
(temples), with magic that is **rare and priced**. This fits our ink-and-wash medieval art, keeps the fantasy level
adjustable, and has a precedent in Crown of Greed's European folklore.

### Control

Follow [04-control-models.md](04-control-models.md): **build the incentive core (A), with a steered ruler-hero (B)
and Royal Decrees (C) as settings, then playtest.** Every system below works under all three.

---

## 4. Proposal: "Realm" mode, v1 concept

> You are the crown, not the sword. Found a town in the wilds, raise guilds, and pay heroes to make the land safe,
> while raiders come at night for your walls.

### Pillars (in the spirit of [GAME_DESIGN.md](../GAME_DESIGN.md))

1. **Rule, don't command.** You set incentives and build the stage; heroes decide. Every refusal is explained.
2. **Walls still matter.** Night raids use the breach-cost flow field. By day the walls also protect **gold in
   motion** (collectors, coffers, caravans) and the heroes' homes.
3. **The town is a machine of incentives.** Shops, taxes, routes and placement shape what heroes do.
4. **Success stirs the wilds.** Growth, wealth and dead heroes create new, visible threats.

### Day and night

| Phase | Length (start values) | What happens |
| ----- | --------------------- | ------------ |
| **Day** | ~3 min (with a speed control) | Heroes hunt, explore, shop and rest; lairs send out monsters; you build, research, place bounties and cast spells. Collectors walk their routes |
| **Dusk** | ~15 s | Bell; heroes head home or to their posts; the next raid is shown (side, size, types), as in our build phase today |
| **Night** | until the wave is beaten | The existing wave system against the walls; heroes defend their guilds and the Hall by class temperament |
| **Dawn** | instant | Report: gold collected, heroes lost and levelled, what stirred ("the sewers have opened"). Shops that survived pay a dawn bonus (after Thronefall) |

### Systems and how they connect

| System | Walls and towers | Heroes | Economy | Threat |
| ------ | ---------------- | ------ | ------- | ------ |
| Guilds and temples | Need protecting at night | Home, recruiting, guild tax | Recruit costs, ×2 copies | Targets for raiders |
| Shops (smith, market, alchemist) | Placement in the walls matters | Gear, potions | Research + 60% sales tax | Trolls (vaporised gold), minotaurs (smith visits) |
| Coffers and collectors | Routes inside the walls are safer | – | All income passes through | Ratmen and raiders go for coffers |
| Bounties | – | Main steering | Sink, mostly returned | – |
| Lairs | Outside the walls | XP and loot | Loot, chests | Refill and grow over time (`camps.js`) |
| Fog | Building only where explored | Rangers explore | Explore bounties | Opening fog raises hostility (after Against the Storm) |
| Night raids | The core of Hold the Hall | Defend by temperament | Wave bonus | Size from **wave number and wealth** (after RimWorld) |
| Growth spawns | Sewer mouths appear inside the town | Fight them | Coffers robbed | 1 sewer per N buildings, graveyard per N deaths |

### Heroes v1

Five classes, reusing our existing unit sprites at first (red livery). Each gets Majesty-style hidden numbers,
**shown to the player as traits in words**.

| Class | Sprite base | Temperament (Majesty analogue) | Greed | Courage (self / enemy estimate) | Flee at | Signature |
| ----- | ----------- | ------------------------------ | ----: | ------------------------------- | ------: | --------- |
| Man-at-arms | swordsman | Warrior: loyal, defends, raids lairs | 12 | 1.0 / 1.0 | 35% | Defends the Hall and chapel; buys armour |
| Ranger | archer | Ranger: explores, follows brave men | 3 | 1.0 / 1.1 | 35% | Explore first; leaves to "far lands" when all is mapped, comes back stronger |
| Rogue | archer (hooded variant) | Rogue: cheapest, greediest, unreliable | 26 | 0.8 / 1.2 | 45% | Loots graves, steals from rival coffers, first to any bounty, pays 30% guild tax |
| Hedge priest | new model (later) or pikeman stand-in | Healer: follows and heals | 1 | 0.6 / 1.4 | 50% | Follows men-at-arms and collectors; heals |
| Knight | knight | Paladin: expensive, brave, needs a chapel | 3 | 1.4 / 0.8 | 15% | Raids lairs on its own; never shops at vices |

Later: wizard (needs a tower, sovereign spells), barbarian (old faith, excludes others), monk, dwarves or another
race pick, and promotion (Man-at-arms → Knight of the Order or Berserker of the Old Faith).

Each recruit rolls **1–2 traits** from a list (brave, craven, greedy, frugal, devout, drunkard, curious, homebody,
loyal, fickle), each nudging the numbers above, as in Crown of Greed. Traits show on the hero card, with a line of
what they mean.

### Hero AI

Combine **Majesty's ordered list** (cheap, readable, personality through order and chances) with **utility scoring**
for bounties and fights. All of it pure in `src/sim/`, with every number in `config.js`.

```
every 0.5 s (staggered), unless committed to a step in progress:
  1. threat check   — foes within sight: fight if  myPower × selfEst  >  theirPower × enemyEst
                      (myPower includes allies within 3 tiles); otherwise flee home or to the nearest inn/tower
  2. hurt?          — hp < fleeAt → drink a potion if carried, else go home or to an inn
  3. bounty check   — for each visible flag: value = reward × ⌊greed/4⌋ / (1 + dist/8) − risk penalty;
                      accept the best if value > class threshold. Committed until done, failed or out-bid by 30%
  4. defend         — home, the Hall or a class-favoured building under attack within range → go
  5. shop           — carrying ≥ price of the next upgrade and a stocked shop within sight × INT/2
  6. class list     — walk the class's ordered list (e.g. ranger: explore 95%, hunt monsters 75%, go home 15%…),
                      first item that rolls under its chance and has a valid target wins
  7. wander
```

- **Payout**: an attack bounty is split by damage share, with at least 20% each for anyone who landed a hit
  (rewards ganging up; stops last-hit sniping). Explore pays whoever arrives first; a second visitor gets a small
  share.
- **Barks and intent icons** on every decision change (see file 04's feedback requirements).
- **Determinism**: seeded rolls (`sim/rng.js`) so replays and tests are stable.
- **Tests**: "a greedy rogue takes the 200 flag over a nearer 50 flag", "a healer follows the most hurt
  man-at-arms", "no hero is idle or stuck for 30 s across 50 seeded days" (as our Conquest AI-vs-AI test does).

### Economy v1 (gold only; numbers at Hold the Hall's ÷10 scale)

- **Coffers**: shops, guilds and houses hold gold until collected.
- **Collectors** (1 per Hall stage, +1 per 5 shops via a well or fountain): walk the coffers inside the walls, then go
  to the Hall or a tower. Defaults: pick up at ≥ 10, return at ≥ 25; adjustable later. A dead collector loses his gold.
- **Taxes**: heroes pay 40% of their earnings (bounties, loot) when they go home (rogues 30%), and **60% of every
  purchase** lands in the shop's coffer; the other 40% is "spent" and counts towards a troll.
- **Market**: 12–25 gold per tick (grows with the Hall stage, the market level and nearby houses), every 30 / 22 / 15 s.
- **Sinks**: building, research, recruiting, bounties, spells, repairs, resurrection. **No upkeep in v1**; add a
  small daily wage (Dungeon Keeper style) only if rosters snowball.
- **Night raiders** pick targets by flow field to the Hall as now, but **looter** types (a new enemy role) weigh full
  coffers. One extra flow field per looted building is too costly, so looters can use A* per squad, as Conquest
  soldiers already do.

### Upgrade paths v1

| Track | Steps | Gate |
| ----- | ----- | ---- |
| **Town Hall** (existing 5 stages) | Unlocks guilds → temples, shops L2 → wizard tower, L3 shops → late buildings | Gold **and heroes recruited** (2 / 5 / 9 / 14), after Majesty's Palace gate |
| **Shops** (3 levels each) | Each level unlocks research; research once, then heroes buy | All research done before the next level (Majesty's Blacksmith rule) |
| **Gear** | 4 visible tiers per class line (e.g. sword: iron → steel → fine → masterwork) shown on the sprite | Smith level |
| **Faith** (one pick at Hall stage 2) | **The Order** (healer + knight, healing and blessing) **or the Old Faith** (barbarian + druid, rage and beasts) | Mutually exclusive |
| **Hero levels** 1–10 | 100 XP a level; XP gained ÷ level; stats per level; a new ability at 3 and 6 | – |
| **Promotion** (later) | Man-at-arms → Knight of the Order / Berserker | At the chosen faith's temple |

### Threats v1

- **Lairs**: extend `camps.js` (camps that refill) into lairs that **send out** raiding parties by day, and can be
  destroyed. Two types for v1 (outlaw camp, wolf den), each with loot.
- **Growth spawns**: a sewer per 9 buildings (rats, gold thieves), a barrow per 10 dead heroes (undead at night), a
  troll per 1000 (÷10: 100) spent gold. Each announced with a line and a ping.
- **Night raids**: the existing waves, scaled by wave number **and** town wealth.

### Bounties and spells v1

- Flags: **Attack** and **Explore** first, **Defend** next (pays per second while guarding, renews automatically at
  dawn if gold is left), **Fear** later.
- Spells (from the Hall and temples): Heal (20), Bless (10, +combat stats), Call to Arms (50, a guild's heroes
  teleport home), Lightning (40; a wizard tower).

### Phone UX

The existing touch flow (drag to position, ✓/✕ confirm) plus file 04's input map: long-press for bounties, a spell
wheel, hero cards, intent icons, edge pings for attacks, speed 1×/2×/3× and pause.

---

## 5. Fit with the codebase

| Needed | Exists today | Work |
| ------ | ------------ | ---- |
| Autonomous units with pathing | `troops.js` (posts, `walkTo`, A* in `pathfind.js`) | Goal-driven heroes instead of guard posts |
| Heroes with levels and abilities | `heroes.js`, `HEROES` in config | Many heroes per side, traits, inventory, carried gold |
| Lairs | `camps.js` (bandit camps that refill and grow) | Lairs that send parties out, destroyable buildings, loot |
| Flags on the map | `flags.js` (Conquest capture flags, already drawn) | Bounty flags with a pot and accepted heroes |
| Gold per team | `Economy.js`, `economyOf(team)` | Coffers in buildings, gold carried by units |
| Map generation | `terrain.js` (seeded) | Lair and point-of-interest placement |
| Night raids | `WaveManager.js`, flow field, walls | Day/night clock, wealth scaling, looter role |
| Rendering | Sprite baker, animated units, stage sprites, phone HUD | Intent icons, fog of war, gear tiers, new buildings |
| AI tests | Conquest AI-vs-AI test | Hero decision tests and stuck-hero watchdog tests |
| — | **No fog of war** | An explored-tiles grid in the sim, a darkening layer in the renderer |

Project rules still apply: logic in `src/sim/` (no three.js or DOM), every number in `config.js`, input only through
`World` methods (new: `placeBounty`, `fundBounty`, `recruit`, `castSpell`, `setCollector`), tests in `test/`, and
`docs/GAME_DESIGN.md` and `docs/ROADMAP.md` kept in sync once anything is built.

### Phases

1. **Prototype the loop.** Realm mode on the open map: two guilds (Man-at-arms, Ranger), Attack and Explore flags,
   the hero AI (threat, bounty, class list), one lair type, carried gold and the 40% home tax. Control A plus the B
   toggle. **The question to answer: is placing bounties and watching fun, and does B fix the frustrating moments?**
2. **Close the economy.** Smith and market, research-then-buy, coffers and collectors, fog of war, intent icons,
   barks, the hero card.
3. **Threat and identity.** Night raids with looters, growth spawns, rogues and the hedge priest, the faith pick,
   Defend flags, spells; C (decrees) as a toggle for testing.
4. **Longevity.** Freestyle setup (seeded maps with modifiers), a light meta layer (a Hall of Heroes keeping one
   veteran, and unlocks), save and load, speed control.

## 6. Open questions

1. **Control model**: decide after the phase 1 playtests (A alone, A+B, A+C).
2. **Fantasy level**: how quickly folklore beasts escalate (wolves and outlaws → trolls → wyverns?).
3. **Map size** for Realm: Medium (52) is probably right, since day exploration needs room.
4. **Hero count and performance**: target ≤ 30 heroes plus henchmen plus monsters on phones; the AI ticks staggered.
5. **Save/load**: probably needed by phase 3, since runs will be longer than Survival's.
6. **Name**: "Realm" is a placeholder.

## Sources

See [01](01-majesty.md), [02](02-majesty-2.md), [03](03-related-games.md), [04](04-control-models.md) and
[05](05-economy-and-progression.md).
