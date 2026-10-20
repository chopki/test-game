# Research: Majesty-style kingdom games

Base data and design notes for an indirect-control kingdom game (in the spirit of *Majesty: The Fantasy Kingdom
Sim*), either as a mode of Hold the Hall or as a game of its own. Gathered in October 2026.

| File | What's in it |
| ---- | ------------ |
| [01-majesty.md](01-majesty.md) | **Majesty 1 and its expansion in full**: every player verb, the Palace tiers, buildings and costs, the gold loop with exact tax splits and formulas, upgrade paths, temples and races, all 16 hero classes with stats, hidden attributes and decision lists, the combat model, threats and growth spawns |
| [02-majesty-2.md](02-majesty-2.md) | What Majesty 2 changed: four flags, tiers and promotion, parties, Lords, costs, gear research; and why reviewers found it repetitive |
| [03-related-games.md](03-related-games.md) | Crown of Greed, the Kingdom series, Dungeon Keeper, Black & White, Thronefall, Dungeon Village, Against the Storm, RimWorld, Stronghold, Kingdom Rush, Darkest Dungeon and others: loop, economy, interaction, upgrades, the one idea of each; a comparison matrix |
| [04-control-models.md](04-control-models.md) | **The control question**: the spectrum from incentives to direct control, every lever catalogued, failure modes and fixes, five candidate models with tests, a recommendation, a phone input map |
| [05-economy-and-progression.md](05-economy-and-progression.md) | Cross-game patterns: currencies, circular hero economies, physical gold, income and sinks, self-balancing threats, time structures, upgrade-path and meta patterns, Majesty's numbers and a ÷10 conversion to our scale |
| [06-design-synthesis.md](06-design-synthesis.md) | How Majesty's systems interlock, what sets each game apart, and a concrete "Realm" mode proposal (pillars, day/night, heroes, AI, economy, upgrades, threats), mapped onto this codebase, with phases and open questions |
| [07-buildings.md](07-buildings.md) | Buildings across the games by role (Crown of Greed, Kingdom, Dungeon Keeper rooms, Thronefall, Kingdom Rush, Stronghold, Dungeon Village) with costs and stats; patterns; a proposed Realm building list |
| [08-units.md](08-units.md) | Heroes, troops and workers: production models, rosters (Majesty 2 promotion, Kingdom subjects, Dungeon Keeper creatures with wages and attraction rules, Thronefall units…), patterns, a proposed Realm roster |
| [09-enemies.md](09-enemies.md) | Enemies, monsters and lairs: where they come from, **what they go for**, damage systems, bestiaries for each game with stats, a proposed Realm bestiary |
| [10-ui-and-art-direction.md](10-ui-and-art-direction.md) | **UI, HUD and art direction** of the reference games and phone strategy games, and a proposed identity for Realm: the realm as a living chart (vellum fog, heroes on bases, sealed bounty notices, a lettered chronicle, lantern-lit nights), phone layout and touch patterns, what to avoid, a staged plan. Source notes in [ui-notes/](ui-notes/) |
| [data/](data/) | JSON: Majesty 1 [heroes](data/majesty1-heroes.json) (stats and decision lists), [buildings](data/majesty1-buildings.json), [spells](data/majesty1-spells.json), [monsters](data/majesty1-monsters.json); [Dungeon Keeper creatures and heroes](data/dungeon-keeper-creatures.json); [Thronefall buildings, units and enemies](data/thronefall.json) |

## Things to remember

1. **Indirect control works when every refusal is explained.** Show intent, who accepted a bounty, and why others
   didn't. Majesty hid this, and most of its frustration came from that.
2. **A few hidden numbers make a personality**: greed (a bounty multiplier), two courage estimates (self and enemy),
   a flee threshold, intelligence (shopping), willpower (vice). Show them as traits in words.
3. **Ordered decision lists with chances** (Majesty's "thought process") are cheap, readable and give each class a
   temperament. Follow behaviours (healers follow warriors, monks guard healers) give cooperation for free.
4. **Run the economy through the heroes.** Bounties go out, heroes spend in your shops, and taxes bring 60–76% back.
5. **Make gold physical.** Coffers, collectors and caravans give walls something to protect besides the Hall.
6. **Success should stir danger**: sewers per 9 buildings, trolls per 1000 spent, graveyards per 15 dead, raid size
   from wealth.
7. **Exclusive identity picks** (rival temples, one race) make every run different and are decided early.
8. **Random maps and a freestyle mode are core.** Majesty 2 and Crown of Greed were both criticised for lacking them.
9. **Visible growth within a run** (gear tiers on the sprite, levels, promotion). Crown of Greed was criticised for
   flat levelling.
10. **Every indirect game needs one strong, costly direct lever** for crises: Call to Arms, drafting, a steered
    king, or decrees. Which one is the main thing to playtest.

11. **Give every enemy a target preference** (the seat, gold, economy, defences, units, the ruler, people). Today
    all our raiders go for the Hall; a few looters and flyers would give walls more jobs (see [09](09-enemies.md)).

## Sources and reliability

- **Fan wikis** read through their MediaWiki APIs: Majesty, Majesty 2, Kingdom, Dungeon Keeper, Black & White,
  Kairosoft (Dungeon Village), RimWorld, Kingdom Rush and Stronghold, plus the official community wiki for Thronefall. They are detailed but community-maintained; conflicts are noted where
  they occur.
- **Reviews and store pages** for Crown of Greed, Thronefall, Majesty 2, Kingdom, Stronghold and Kingdom Rush; one
  strategy guide for Against the Storm.
- **General knowledge** for parts of Stronghold, Kingdom Rush, Darkest Dungeon and the short entries; marked † in
  [03](03-related-games.md).
- Each file ends with its own source list.
