# Control: how much should the player command?

This is still undecided, so this file lays out the whole design space: what each game does, what it costs, how
each option feels, and how to test them cheaply. Game facts come from files 01–03.

## The core tension

| Indirect control gives | Direct control gives |
| ---------------------- | -------------------- |
| Stories ("the rogue took the bounty and ran") | Mastery ("I split their army at the ford") |
| Low effort per minute, ideal for phones | Agency: the result is yours |
| A world that feels alive | Clear cause and effect |
| Blame shared with the agents, so failure feels charming | Blame sits with you, so failure feels fair |
| **Risk: "my heroes are stupid"** (helplessness) | **Risk: micromanagement**; the agents stop mattering |

Every successful game here **mixes the two**: mostly indirect, plus one or two strong, **costly or limited** direct
levers for crises.

## The spectrum

```
 0 Environment     1 Incentive        2 Assignment        3 Area command      4 Temporary direct   5 Full RTS
 ─────────────────────────────────────────────────────────────────────────────────────────────────────────►
 build, zone,      bounties, prices,  jobs, priorities,   rally points,       draft, possess,      select and
 designate         contracts, belief  tools, drop into    follow-me, call to  leash, the king      order every
                                      a room              arms, defend flag   or hero you steer    unit
 Dwarf Fortress    Majesty, Crown of  Kingdom tools,      Kingdom Rush        RimWorld drafting,   Stronghold
 Settlers, Tropico Greed, Kingdom     RimWorld work,      rally, Thronefall   DK possession, B&W   army, classic
 edicts            coins, B&W belief  DK hand, Dungeon    follow, Majesty     leash, Thronefall/   RTS
                                      Village quests      Call to Arms/Gate   Kingdom Rush hero
```

## The levers, catalogued

| Lever | Games | What the player pays | What the player learns | Phone fit |
| ----- | ----- | -------------------- | ---------------------- | --------- |
| **Bounty on a target** (kill / destroy) | Majesty, M2, Crown of Greed | Gold up front, not refunded; split or winner-takes-all | How much each class wants a job | Long-press target → amount |
| **Bounty on a place** (explore / reach) | Majesty, M2 | Gold | Scouting value | Same |
| **Defend contract** (pays over time) | M2, Crown of Greed (double-click a building) | Gold per second, expires | Positional control | Tap a building → shield |
| **Fear flag** (keep away) | M2 | Gold scales with the hero level it repels | Protecting the weak | Same radial menu |
| **Type bounty** (all monsters of a kind) | Majesty NE (Hall of Champions) | One-off gold, for a time | Strategic focus | A list in a building |
| **Building placement as attraction** | Majesty (classes defend different buildings; Inns as forward bases), DK (rooms attract species), Dungeon Village (appeal) | Construction | Spatial planning | Build mode |
| **Roster choice** (exclusive temples or races) | Majesty, M2 promotion | Opportunity cost | Identity | Menu |
| **Tool or role assignment** | Kingdom (bow → archer), RimWorld priorities, DK drop into a room | Coins / UI time | Economy of roles | Tap a vendor, drag a unit |
| **Price, tax and policy levers** | Stronghold taxes and rations, Tropico edicts, DK casino payout, Majesty collector thresholds | Slider | Economy tuning | Sliders |
| **Personality shaping** | B&W reward and punish; Majesty recruit-time buffs (Krolm courage, Library INT); Dungeon Village medals | Attention / gold | Long-term character | Hard to read on phones |
| **Rally point** | Kingdom Rush barracks | Free | Positioning | Drag a flag |
| **Follow-me** | Thronefall (walk up, then followers come with you) | Your king's position | Concentration of force | Natural with a steered king |
| **Recall** | Majesty Call to Arms (500), M2 too | Gold | Emergency defence | One button |
| **Teleport a group** | Majesty NE Gate (2000) | Gold | Big plays | Target spot |
| **Panic button** (flee or return) | Majesty NE Change of Heart (400) | Gold | Saving a hero | Tap hero |
| **Draft** (full control for a while) | RimWorld | Agents ignore needs; ends after quiet | Tactics | Select + tap, fiddly |
| **Possess one unit** | Dungeon Keeper | Mana/gold; can't do jobs | Fun, scouting | Virtual stick |
| **Steered hero or king** | Thronefall, Kingdom Rush, Kingdom (monarch, no combat) | Your attention | Being on the field | Tap to move, or a stick |
| **Spells** (buffs, heals, damage) | All | Gold / mana / cooldown | Supporting the agents | Tap target |
| **Slap / bribe** | DK (slap: faster but angry; drop gold: instantly happy) | Happiness / gold | Carrot and stick | Tap |

## What goes wrong, and the fixes

| Failure | Seen in | Fix |
| ------- | ------- | --- |
| **"Why didn't anyone come?"** Opaque refusal | Majesty (hidden greed and courage), B&W (which action did I reward?) | Show **who accepted**, **why others refused** ("too dangerous for Mira", "50 g isn't worth the walk"), and the **expected payout** per hero. DK's thought bubbles and Majesty's spoken lines are a start |
| **Heroes ignore lairs** without flags | Majesty, Crown of Greed | Raise base aggression for some classes (Majesty's Solarus hunts hidden lairs at 95%); let groups gather courage together |
| **Dithering** between goals | (generic utility AI) | Commitment: keep a goal unless another beats it by a margin; finish the current step |
| **Stuck agents** | Crown of Greed launch | Watchdogs: re-plan after N seconds without progress; tests that run many seeds and assert nobody is stuck (we already do this for Conquest) |
| **Upkeep chores** | Majesty 2 defend flags that expire, Dungeon Village remodelling | Make the default sensible and renewal automatic; let the player opt into micro |
| **Crisis helplessness** | All indirect games | One **strong, expensive emergency lever** (Call to Arms, Gate, draft, or the steered king) |
| **Micromanagement creep** | RimWorld late game, RTS | Limit direct control: costs, cooldowns, a single unit, or one time of day |
| **Learning by guessing** | Kingdom (no text), B&W | Teach mechanics visibly (Kingdom's coin slots are good); a short in-game advisor for the rest |

## Five candidate models for our game

All five can sit on **one hero AI**: a scorer that adds weights for flags, decrees, follow orders and so on. So the
choice can be a **setting we test**, not a fork in the code.

### A. Pure Majesty: incentives only

Bounties (attack, explore, defend, fear), spells, guild powers and buildings. The ruler is not on the map.

- \+ Truest to the reference. Lowest input load, good for phones. Strongest emergent stories.
- − Highest risk of helplessness. Needs excellent feedback UI. Walls and towers end up as the only thing you control
  directly, which may feel odd next to autonomous heroes.
- **Test**: can a new player clear a lair and survive three nights using only flags and spells? Count their "why
  didn't they…" moments.

### B. Majesty plus a ruler-hero (Thronefall / Kingdom Rush style)

As A, plus **one unit you steer**, a Lord or Captain at the Hall, who fights and gives **follow-me** to nearby heroes
(they come along while you're close, unless their flee threshold says otherwise). The v0.5 roadmap's "one hero you
control directly" fits here, and Conquest's heroes already have orders, XP, levels and respawn in `sim/heroes.js`.

- \+ A cure for helplessness that is always on hand. Hands and eyes on the field. Natural on phones (tap to move).
  Reuses existing code.
- − The ruler can become the whole game (players play an ARPG and ignore bounties), so balance its power and give it
  a reason to stay near home (an aura or bonuses round the Hall, or it's the one who has to be alive).
- **Test**: what share of kills does the ruler make? Target 15–25%; above 40% the indirect game has collapsed.

### C. Majesty plus limited Royal Decrees

As A, plus a small number of **hard orders**, e.g. "Muster at the Hall", "Hold this gate", "Hunt this beast",
which every hero in range **must obey** for N seconds. Paid with a scarce currency (favour, crowns) that refills
slowly, or a growing gold price per use in a day.

- \+ Crisp crisis control without a unit to steer. Strategic rather than twitchy. The scarcity makes each decree a
  decision.
- − Another currency to explain. Obeying heroes look less alive (fix: they grumble, and loyalty dips if overused,
  as with DK's slap).
- **Test**: are decrees used about 1–3 times a night? If players save them and never use them, they cost too much; if
  they use them every wave, too little.

### D. Embodied monarch (Kingdom style)

The ruler is an avatar who **is** the cursor: you can only build, pay or place bounties **where you are standing**.
Coins are carried, and perhaps lost if the ruler is hit.

- \+ Very distinctive, very phone-friendly (one thumb), gives the map meaning (distance is a cost) and naturally
  limits how many actions you take.
- − Slow for large maps (our maps are 40–64 tiles). Fights with the top-down camera and the existing build HUD. A big
  departure from Hold the Hall's interface.
- **Test**: run a paper or quick prototype on the Small map; see whether travel feels like strategy or like chores.

### E. Doctrine settings (RimWorld / Dwarf Fortress style)

No per-target orders. Instead, **standing orders per guild**: aggression (cautious ↔ reckless), range (stay near
town ↔ roam), priorities (hunt / guard / explore). Plus bounties for specifics.

- \+ Low input; deep. The player shapes personality rather than micromanaging moves.
- − Abstract and slower to feel. Weaker on stories than traits plus bounties.
- **Test**: do players change doctrines in response to events, or set them once and forget?

### Recommendation

**Build A as the core, with B and C behind a setting, and run a prototype pass with playtests.** Reasons:

1. A is the reference experience and the cheapest to build on our sim (flags already exist as map objects, see
   `sim/flags.js`; troops already act on their own).
2. B costs little because Conquest heroes exist. It's the most likely cure for helplessness on phones.
3. C is the strategic alternative if B turns into an action game.
4. D is the boldest but fights our camera and HUD. Keep it as a possible **separate game** (see
   [06-design-synthesis.md](06-design-synthesis.md)).
5. E can arrive later as an advanced tab once the core is fun.

## Making indirect control feel fair: requirements for any model

1. **Intent visible at a glance**: an icon over each hero (⚔ bounty, 🛡 defend, 🧭 explore, 🛒 shop, 💤 rest, 🏃 flee,
   🍺 vice), with a dotted line to the target for the selected hero.
2. **Flag cards**: the pot, who has accepted (portraits), and an **estimated pull** ("attracts: rogues, rangers;
   too risky for: healers"). Warn when a flag is too small for anyone who can see it.
3. **Barks**: short lines on decisions ("Problem? I am on my way!", "Not for 50 gold", "I'm out of here!"). Majesty's
   class quotes show how much character a line carries.
4. **Readable personality**: show traits (brave, greedy, loyal, curious, devout) and their effect in plain words, not
   hidden numbers.
5. **Stable rules**: the same situation gives a similar decision, with seeded randomness and no flip-flopping.
6. **Crisis pings**: arrows at the screen edge and minimap pings for attacks (Crown of Greed's reviewers asked for this).
7. **Game speed** 1×/2×/3× plus pause (Crown of Greed was criticised for lacking a speed slider).

## Phone input map

| Action | Gesture |
| ------ | ------- |
| Place a bounty | Long-press a target or the ground → radial menu (Attack / Explore / Defend / Fear) → steppers (+25 / +100 / +500) → confirm (fits our ✓/✕ touch flow) |
| Add to a bounty | Tap the flag → + buttons |
| Cast a spell | Tap a spell in the build wheel → tap the target (as tower placement works now) |
| Decree (C) | Tap the crown → choose → drag over an area |
| Move the ruler (B) | Tap the ground (move) or tap an enemy (attack); hold on the ruler for follow-me |
| Inspect a hero | Tap → card with intent, traits, gold, gear, a line of thought |

## Sources

See files [01](01-majesty.md), [02](02-majesty-2.md) and [03](03-related-games.md) for per-game sources.
