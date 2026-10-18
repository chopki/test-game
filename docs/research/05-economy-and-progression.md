# Economy, upgrade paths and self-balancing: patterns across the games

This file pulls the recurring patterns out of files 01–03 and turns them into a toolkit with numbers. Majesty values
are its own scale; at the end there is a suggested **÷10 conversion** to Hold the Hall's scale (start 300 gold,
towers 75–180).

## 1. How many currencies?

| Approach | Games | Pros | Cons |
| -------- | ----- | ---- | ---- |
| **One** (gold) | Majesty, Kingdom (coins), Thronefall, DK1 | Instantly readable; every choice trades against every other | Little room for specialisation |
| One + a rare unlock currency | Kingdom (gems), Kingdom Rush (stars), Dungeon Village (town points, medals), Crown of Greed (Heritage) | Separates "today's spending" from "progress" | Two things to explain |
| One + a magic resource | DK2 (mana), B&W (prayer power) | Spells become their own economy | Balancing two flows |
| Many goods | Stronghold, Against the Storm, Settlers | Rich chains and trade | Heavy UI; poor phone fit |

**Recommendation**: **gold only** inside a run (Majesty's strongest trait, and Hold the Hall is already
single-currency). If decrees (control model C) need a currency, use a slow **Favour** meter rather than a second
resource. Meta-progression gets its own between-runs currency.

## 2. Circular economies: money that flows through the agents

The Majesty pump:

```
 you ──bounty 1000──► heroes ──spend in your shops──► 60% to the coffer ──collector──► you   (600–760 comes back)
                         └─ go home ──► 40% of taxable gold to the guild coffer (rogues 30%, non-humans 0%)
                         └─ 40% of each purchase is "vaporised" ──► every 1000 vaporised spawns a Troll
```

- A bounty works as **a subsidy that buys a result** (a kill or exploration) plus **hero power** (the gear they
  buy), and most of the gold returns. Spending 1000 nets out at only about 240–400.
- The return depends on **where heroes spend**: your taxed shops recover gold; untaxed vices (Elven Lounge,
  Gambling Hall), non-human heroes and high-loyalty heroes changing sides lose it.
- **Variants**: Dungeon Village (adventurers spend their salary in your shops, and **buildings level up through
  use**); DK2's casino (a lever sets whether it wins back payday gold or makes creatures happier); Majesty 2
  (cheap hero purchases, so the pump is weaker and research is the sink).

**Design rule**: decide on purpose **what share of income comes from heroes spending**. In Majesty 1 it's large
(shops are "the strongest earners"), so heroes are an investment. In Majesty 2 it's small, so heroes are a cost.

## 3. Physical money: gold you have to move

| Mechanic | Game | Gameplay it creates |
| -------- | ---- | ------------------- |
| **Coffers in buildings**, emptied by **tax collectors** on a route; the collector's gold is lost if he dies | Majesty, M2, Crown of Greed | Defending routes; shops near drop-off points; route settings |
| **Ratmen steal from coffers** | Majesty | Guards near markets; a reason to collect often |
| **Caravans** that carry more the further they travel, and multiply by the market's level | Majesty | Long, risky, valuable routes to escort |
| **A carried purse** (cap 40, spills over) | Kingdom | Spend locally; distance matters |
| **Subjects carry coins**, stripped by attacks (coins → tool → villager) | Kingdom | Damage is economic, not just HP |
| **Banker**: store coins, small interest, only out by day | Kingdom | Savings for winter |
| **Gold piles** on the floor; Treasury capacity per tile | Dungeon Keeper | Storage as a building problem |
| Only buildings that **survived the night** pay at dawn | Thronefall | Defending the economy, not just the throne |

For a wall game like ours this is the big opportunity: **gold moving through the town gives walls and towers
something to protect besides the Hall.** Today, enemies only want the Hall.

## 4. Income sources

| Type | Examples | Feel |
| ---- | -------- | ---- |
| Passive tick | Majesty Marketplace (125–250 every 15–30 s), Inn (90–120 a day), Thronefall houses at dawn | Reliable base |
| Activity tax | Majesty sales tax 60%, guild tax 40% | Rewards a busy hero economy |
| Logistics event | Caravans, Market Day (2× now, closed 45 s) | Spikes with a choice attached |
| Loot | Lairs, chests, monsters carrying gold (a minotaur 85, a Black Phantom 800) | Pays for aggression |
| Interest | Kingdom banker | Pays for saving |
| Emergency | Extort (instant, ~35% fee), gambling | Panic options |
| Mining / production | DK gold seams, Kingdom farms (not in winter) | Territory = money |

## 5. Sinks

Construction · upgrades · research · recruitment · **bounties** · spells · guild powers · **wages** (DK payday: wage =
base × (1 + 0.35 × (level − 1)), every ~8 min) · **upkeep** (Dungeon Village buildings, Battle Brothers' daily pay) ·
repairs and rebuilds (Kingdom stumps) · resurrection (Majesty 1500–2000, priced by level in the Mausoleum) · vices
and vaporised gold.

**Majesty has no upkeep at all**, which is why big hero rosters cost nothing after recruitment, so the guild
capacity (4) and recruit prices do all the limiting. Adding light upkeep is the main knob if rosters snowball.

## 6. Self-balancing threats: success creates danger

This may be the most important pattern to copy. It keeps the challenge up without a difficulty curve on a timer.

| Trigger | Consequence | Game |
| ------- | ----------- | ---- |
| Every 9 buildings | An indestructible **Sewer** (rats, gold-stealing ratmen) | Majesty |
| ~15 heroes dead | An indestructible **Graveyard** (undead) | Majesty |
| Every 1000 gold "vaporised" by hero shopping | A **Troll** spawns at a building and goes for markets | Majesty |
| Every 25 Blacksmith visits | A **Minotaur** raider from the map edge | Majesty |
| Number of heroes | Bigger goblin waves (the *Legendary Heroes* quest) | Majesty |
| Colony wealth and pawn count | **Raid points** buy raiders (35 … 10,000), times an adaptation factor | RimWorld |
| Years, glades opened, villagers added | **Hostility** (resolve penalties, storm effects) | Against the Storm |
| Destroying a portal | A counter-attack wave | Kingdom |
| A Mausoleum destroyed | An undead horde | Majesty NE |
| Unhappy, unpaid creatures | They leave or join the enemy | Dungeon Keeper |

**Rule**: tie each big player action to a visible, explained consequence ("Your town has grown: the sewers stir…").
Keep a time-based floor (waves still grow each night) so turtling doesn't win.

## 7. Time structures

| Game | Clock |
| ---- | ----- |
| Majesty | A day ≈ 60 s; "half a day" buffs; quests count days |
| Kingdom | Day/night: waves timed to hit the walls at midnight; a recovery day after a Blood Moon; 16-day seasons, winter has no income |
| Thronefall | Build by day, fight by night; gold at dawn |
| Against the Storm | Drizzle → Clearance → Storm, ~8 min plus the storm |
| Dungeon Keeper | Payday every ~8 min |
| Dungeon Village | Months and years (town points monthly, medals at year end) |
| Hold the Hall (now) | Build phase with a countdown → wave → bonus |

Our build/wave phases already work as day and night. Majesty's continuous world fits in **by day** (heroes hunt,
shop and explore while you build), and **night** keeps the raid against the walls.

## 8. Upgrade-path patterns

| Pattern | Examples | Why it works |
| ------- | -------- | ------------ |
| **Hub tier gates** | Majesty Palace (needs 4, then 12 heroes recruited, plus 3000 / 3750); Kingdom town centre (6–7 tiers unlock vendors); Thronefall castle | One clear "level of the town" |
| **Gate on something other than gold** | Majesty's hero count; Kingdom Rush stars from lives kept; Dungeon Village popularity | Pushes the play you want (here: recruit and risk heroes) |
| **Research, then the agents buy** | Majesty shops, M2 Blacksmith (250 / 1000 / 3000 / 3500 research, heroes pay 30 / 70 / 100 / 120) | The player invests, and the agents carry the benefit |
| **Finish all research before upgrading** | Majesty Blacksmith | Paces content |
| **Buildings level from use** | Dungeon Village | Rewards a busy town |
| **Fork at a tier** | Kingdom Rush (two specialisations at level 4); Thronefall (two options at some steps; unit type locked) | Identity without a big tree |
| **Mutually exclusive picks** | Majesty temples (Order / Chaos / Krolm alone; Sun vs Moon) and races (elf / dwarf / gnome) | A different kingdom every run |
| **Promotion** | Majesty 2 (Warrior → Paladin or Blademaster at a temple) | Keeps attachment to a hero |
| **Recruit-time buffs** | Majesty Fairgrounds +1 STR, Library +INT, Krolm courage | Build order matters |
| **Escalating copies** | Majesty guilds ×2, Wizards' Guild ×4, temples ×1.5–2, guardhouse ×1.25, inn ×1.1, market ×1.29; M2 ×1.5 | Soft caps without hard limits |
| **Flat-cost exceptions** | Majesty Ballista and Wizards Towers | A reason to pick those |
| **Hero levels** | Majesty: 1000 XP a level, XP ÷ level; stats per level; HP from Vitality | Natural slowdown |
| **Visible gear tiers** | Majesty named gear (short sword → longsword…); M2 tiers 1–4 | Growth you can see (Crown of Greed was criticised for its absence) |
| **Job change and mastery** | Dungeon Village (master at level 10 to unlock for everyone) | Roster-wide progress |

## 9. Between runs (meta-progression)

| Game | What carries over |
| ---- | ----------------- |
| Majesty 2 | One **Lord** per mission, summonable later |
| Crown of Greed | **Heritage Points** → permanent kingdom upgrades (buildings, economy, defences); more on harder levels |
| Kingdom Rush | **Stars** (1–3 per stage by lives) → permanent tower and spell upgrades |
| Kingdom Two Crowns | Statues and hermits unlocked with gems stay; islands remain (and decay); heirs |
| Against the Storm | Citadel upgrades; prestige difficulty levels |
| Dungeon Village | Unlocked jobs |
| Darkest Dungeon | Hamlet upgrades from heirlooms |
| Thronefall | Perks, weapons, mutators by level |

For a personal-pleasure project, a **light** layer is enough: unlocks (new classes, buildings, temples) plus a
**Hall of Heroes** where one veteran per run can be brought back (Majesty 2's Lords). Avoid power creep that makes
early maps trivial; prefer **options** to **raw power**.

## 10. Majesty numbers at a glance

| Thing | Majesty 1 | Majesty 2 |
| ----- | --------- | --------- |
| Hero recruit | 100 (gnome) … 275 (rogue) … 450 (warrior) … 1000 (paladin) | 100 (rogue) … 500 (mage), 700 tier 2, 1000 temple |
| Guild | 600–1500, ×2 per copy | 450–1000, ×1.5 per copy |
| Hall upgrade | 3000, 3750 (+ 4 / 12 heroes recruited) | – |
| Marketplace | 1500 / 1000 / 1000; 125–250 per 15–30 s | One per map |
| Smith research | 200 / 300 / 400 per line | 250 / 1000 / 3000 / 3500 |
| Hero gear price | weapon 100–300, armour 300–900 | 30 / 70 / 100 / 120 |
| Potion | research 300; the hero pays ~50 (20 taxed) | research 150 |
| Spells | 100 (Blessing) … 2000 (Reanimate) | – |
| Guild powers | Call to Arms 500, Move Camp 800, Rage 1500 | – |
| Tax | guild 40% (rogues 30%, non-humans 0%), sales 60% | – |
| Collectors | 1 per Palace level, +1 per Fountain | 4 / 5 / 6 |

### Converting to Hold the Hall's scale (÷10)

Hold the Hall: start 300, wall 10, archer tower 75, barracks 120, catapult 180, Town Hall stages 200–800, wave bonus
30 + 10 × wave, kills 4–20. Dividing Majesty by 10 lands in the same range:

| Majesty 1 | ÷10 | Next to |
| --------- | --- | ------- |
| Warrior 450 | 45 | Below an archer tower (75) |
| Warriors' Guild 800 | 80 | Like a magic spire |
| Marketplace 1500, yields 125–250 | 150, yields 12–25 per tick | Like a cannon tower |
| Blacksmith 500 | 50 | |
| Inn 400 | 40 | |
| Hall L2 3000 | 300 | Our Town Hall stages (200–800) |
| Healing spell 200 | 20 | |
| A typical bounty 100–500 | 10–50 | 1–3 kills' gold |

These are starting points to tune in `config.js`, not balance.

## Sources

See files [01](01-majesty.md), [02](02-majesty-2.md) and [03](03-related-games.md).
