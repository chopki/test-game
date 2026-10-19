# UI, HUD and art direction of Majesty-style indirect-control kingdom sims

Scope: Majesty (Cyberlore 2000; Majesty Gold HD 2012 on PC; iOS/Android ports by HeroCraft 2011), Majesty 2
(1C:Ino-Co / Paradox 2009), Crown of Greed (announced March 2024, released March 31 2026), Kairosoft's Dungeon
Village (2011/2012) and Dungeon Village 2 (Steam May 2023). Visuals and UI only; economy is in
`/home/user/test-game/docs/research/`.

**Source caveats (read first).**
- The Majesty fan wikis (majesty.fandom.com) and TV Tropes sat behind a Cloudflare challenge or returned 403 to both
  curl/api.php and WebFetch during this session, as did TouchArcade's review pages and The Drastik Measure. The
  Galaxus Crown of Greed review returned 503. So exact HUD geometry and screen-percentage numbers for these games
  could not be verified from text sources. I found **no published screen-real-estate measurements for any of them**.
- Two Crown of Greed points rest on *Vaporlens*, an AI summary of Steam reviews. It gives theme "weights" (roughly
  the share of mentions), not counts. It is useful for spotting themes but it is not a primary source.
- Crown of Greed's developer is unclear. The Steam store lists **BLUM Entertainment** (publisher PlayWay /
  ConsoleWay), but the account answering as "[developer]" on the Steam forum in February 2025 is **Odnova Games**.
  One Steam URL for the same app ID (1697870) is titled "Kings Reign", which may be an earlier working title
  (unconfirmed).
- The brief says "Crown of Greed (2024)". 2024 was the announcement and demo year. The full release was 31 March
  2026.

## 1. Camera, perspective and rendering style (how heroes are told apart)

### Takeaway
The genre splits two ways. **Majesty 1 and Dungeon Village are 2D** (Majesty: isometric sprites with lots of small
animation; Kairosoft: bright, flat pixel art). **Majesty 2 and Crown of Greed are 3D isometric-style RTS views.**
Majesty 2 is colourful and whimsical; Crown of Greed is gloomy and darker, in a Slavic-folklore setting. None of the
sources explains how heroes are told apart at a distance. That is an open design space for us.

### Cited Findings
- **Majesty 1 is 2D. Majesty 2 moved it to 3D.** A Majesty 2 preview calls the 3D look an upgrade "from the 2D graphics
  of the original" — [GameBanshee preview](https://www.gamebanshee.com/xxyr). Our earlier notes record Majesty 1 as
  "2D isometric" and Majesty 2 as "3D, rotating camera" —
  `/home/user/test-game/docs/research/02-majesty-2.md` (sources listed there: majesty2.fandom.com, GameBanshee,
  Gaming Nexus).
- **Majesty mobile, visual richness from small animations.** "Tiny details in building animations and inspired visual
  flourishes sprinkled about make Majesty very easy on the eyes" (Catalin Alexandru, 7 March 2011, 3.5/5) —
  [Pocket Gamer, Majesty Android review](https://www.pocketgamer.com/articles/027948/r/).
- **Majesty HD on iPad.** "the clear screen displaying sharp colours with nary a hint of slowdown"; "a great thing to
  behold" — [Digitally Downloaded](https://digitallydownloaded.net/?p=52937).
- **Majesty Gold HD (PC, Steam app 25990)** added support for "all common resolutions" and "several other graphics
  and gameplay updates" to the 2000 sprite game. Its Steam rating is Very Positive, 91% of 517 reviews —
  [Steam: Majesty Gold HD](https://store.steampowered.com/app/25990/).
- **Majesty 2 look.** "The move from 2D to 3D was a success, and battles are colorful and fun to watch" —
  [GameBanshee review](http://www.gamebanshee.com/kakyu). Another review: the graphics are "rich in color and detail,
  with a somewhat whimsical presentation style" — [GameGrin](https://www.gamegrin.com/reviews/majesty-2-review/)
  (quote from search snippet). Against that: "Nothing about the environments or buildings ever stood out as really
  using all of the graphical power" (5.5/10) — [GamingBolt](https://gamingbolt.com/majesty-2-review/amp).
- **Crown of Greed look.** "extremely impressive visuals", "that classic RTS and strategy game isometric style", a
  "medieval and fantasy" world "inspired by Slavic myth and folklore" with vampires, giant spiders and undead
  (Ed Smith, 7 March 2024) — [PCGamesN](https://www.pcgamesn.com/crown-of-greed/new-steam-rts-game). The store page
  sells a "gloomy and dark" atmosphere and biomes of forests, swamps, icelands and deathlands —
  [Steam](https://store.steampowered.com/app/1697870/).
- **Crown of Greed's living buildings.** A Steam reviewer: "the graphical style, the visuals and the animations are
  also excellent", with lights turning on and off, structural damage, and "minor actions taking place all over the
  buildings" — [Steam reviews, via search snippet](https://store.steampowered.com/app/1697870/). A pre-release
  player praised the "unit appereance with darker vibe" —
  [Steam forum thread, 3 Feb 2025](https://steamcommunity.com/app/1697870/discussions/0/595139814470240895). Review
  summaries cite a "Slavic-Germanic style and gloomy folklore setting" as charm —
  [Vaporlens](https://vaporlens.app/app/1697870/crown_of_greed.md).
- **Dungeon Village 2.** "The game has the classic Kairosoft visual look, bright and colourful", "cute little NPCs
  walking about" — [LadiesGamers](https://ladiesgamers.com/dungeon-village-2-review/). The Steam tags are Pixel
  Graphics, 2D, Retro, Cute, Colorful, City Builder and Colony Sim —
  [Steam: Dungeon Village 2](https://store.steampowered.com/app/1983710/).
- **Hero differentiation, the only hard data point.** Crown of Greed heroes have random positive and negative traits
  ("a Devout Warrior with fragile health and low stamina", "a Rogue with a costly vice") —
  [Steam](https://store.steampowered.com/app/1697870/). Dungeon Village adventurers have jobs with "six different
  attributes" — [LadiesGamers](https://ladiesgamers.com/dungeon-village-2-review/). Neither source says how the
  traits are shown on the model.

### Inferences
- Majesty 1 and Dungeon Village read through **silhouette and animation at a fixed scale** (sprites). Majesty 2 and
  Crown of Greed rely on 3D and a free camera. Our pre-baked painted sprites at a fixed isometric angle are closer to
  Majesty 1 and Kairosoft in how they read, but with a painterly finish that none of these games uses. That gap
  (painted storybook versus pixel, cartoon-3D or grim-3D) is our clearest visual opening.
- Palettes form a spectrum: Kairosoft's saturated pastel pixels; Majesty 2's "colorful/whimsical" 3D; Majesty 1's
  warmer 2D fantasy; Crown of Greed's desaturated gloom. A warm, inked, storybook palette with strong day/night
  shifts would not clash with any of them.
- "Lights turning on and off" and "minor actions all over the buildings" in Crown of Greed, and "tiny details in
  building animations" in Majesty mobile, show that **buildings that look alive** are a big part of the genre's appeal.

### Gaps
- No source gives zoom ranges, camera rotation rules or field of view for Majesty 2 or Crown of Greed, nor how readable
  units are at maximum zoom-out.
- I could not verify how heroes are colour-coded or marked (for example name labels, guild colours, selection rings)
  in any game. *Unverified recollection, check against screenshots:* Majesty 1 shows a hero's name and health
  bar when you hover or select them. Majesty 2 heroes are recognisable by class model and colour.
- No palette or lighting statements from the developers (no art-direction interviews found).

## 2. HUD layout and screen real estate

### Takeaway
Text sources describe HUD layout only in fragments. Majesty 2 added **hero portraits** and build queues. Crown of
Greed puts a **hero list in the top-left corner** and hides bounties, buildings and spells inside a **castle
panel** and a **spell wheel**, and players criticised that heavily. In Dungeon Village 2 quest progress runs **along
the bottom bar**. No source gives screen-share percentages.

### Cited Findings
- **Majesty 2.** "The interface received a major facelift, including build queues, a pause button, and hero
  portraits", which "allow you to easily select and examine your heroes" —
  [GameBanshee review](http://www.gamebanshee.com/kakyu).
- **Crown of Greed, before release (Feb 2025 demo/playtest).** Player Lotor13: "The active skills are nice, but
  'hidden' in ability tree, just add them to the main screen (like Godsworn)"; "same with bounty and building
  options, there are 'hiden' in castle panel"; casting spells takes three steps (castle, then spell wheel); "I see,
  that You made UI to be adjustable for console control, but 'this is not good' for strategy on PC"; "You simple
  need attack/defense/exploration/warning flags to be available from main screen"; "Heroes list in upper left corner,
  I would like (or need) too see teams separated from individual heroes". Developer (Odnova Games): "The UI will
  definitely see many changes and improvements, mainly based on feedback from our community" —
  [Steam forum](https://steamcommunity.com/app/1697870/discussions/0/595139814470240895).
- **Crown of Greed, after release.** Review summaries list "improved and intuitive" and "modern" UI as positives, and
  missing quality-of-life features and inconsistent **minimap icon visibility, "especially for placed flags"**, plus
  minimap movement problems as negatives — [Vaporlens](https://vaporlens.app/app/1697870/crown_of_greed.md). Our
  earlier notes from critic reviews record that "crises aren't pinged on the minimap" and that there is "no visible
  day/night clock" — `/home/user/test-game/docs/research/03-related-games.md` (sources there:
  [Galaxus](https://www.galaxus.at/en/page/gold-instead-of-obedience-crown-of-greed-tested-42293),
  [Gamestic](https://www.gamestic.nl/2026/04/05/review-crown-of-greed/),
  [The Drastik Measure](https://www.thedrastikmeasure.com/2026/09/11/crown-of-greed-pc-review/)).
- **Dungeon Village 2.** "You can watch your adventurers progress on quests as shown at the bottom of the screen";
  info is "mentioned on the bar on the bottom" — [LadiesGamers](https://ladiesgamers.com/dungeon-village-2-review/).
  On PC its UI "feels built for touchscreens", and many players say it plays better on mobile —
  [Vaporlens DV2](https://vaporlens.app/app/1983710/dungeon_village_2.md).
- **Majesty mobile.** "relatively tiny UI text" — [Pocket Gamer](https://www.pocketgamer.com/articles/027948/r/). Text is
  readable on iPad but "much trickier to decipher on an iPhone screen" —
  [TouchArcade review, 18 Aug 2011, 3/4 stars (search snippet; page 403)](https://toucharcade.com/2011/08/18/majesty-the-fantasy-kingdom-sim-review).
  "playing on an iPhone can be very challenging (due to screen size)" —
  [MacTrast, Northern Expansion](https://www.mactrast.com/2013/02/review-majesty-the-northern-expansion/amp/)
  (search snippet).

### Inferences
- The Crown of Greed thread is a direct warning for our design. A **console-style radial or wheel that buries flags
  and spells two or three taps deep** annoyed core players. Flags are the main verb and need to sit one tap from the
  main screen. Our bottom-right fan already does this for building. The Realm flags should live in that fan or in a
  sibling fan, not in a sub-menu.
- The hero roster/portrait strip (Majesty 2's portraits, Crown of Greed's top-left list) is the genre's standard way to
  find autonomous units. Players asked for **parties grouped apart from solo heroes** in that list.
- The Majesty port shows that PC-scale text on a phone fails. Any Realm card text must be sized for phones from the
  start.

### Gaps
- No screen-share measurements exist in the sources. If needed, measure from screenshots (Steam store images,
  YouTube) as a separate task.
- *Unverified recollection, check against screenshots:* Majesty 1's interface is a fixed panel along the right edge
  with the minimap at the top, the selected-object info and the build/spell buttons below. The world view takes
  roughly three quarters of the screen. Kairosoft phone games are mostly portrait, with money and date at the top and
  a menu button bar at the bottom. I could not confirm either from a text source this session.

## 3. How the core verbs are presented (flags, hiring, hero cards, fog, day/night and threat)

### Takeaway
All three Majesty-line games use **physical flags planted in the world with a gold amount attached**. Heroes respond
only if the sum is worth their while, and money is added in steps until someone accepts. Majesty 2 has four flags
(Explore, Attack, Defend, Fear). Crown of Greed calls them "contracts", lets you drag and adjust them, posts a defend
contract when you double-click a building, and adds a **rally flag for coordinated attacks** that players praised.
Dungeon Village uses quests that adventurers volunteer for, not map flags. Day/night and threat cues are weak across
the genre: Crown of Greed has no visible day/night clock and no crisis pings.

### Cited Findings
- **Majesty 2 flags.** "To make heroes complete tasks you plant one of three flags, explore flags have your heroes explore
  that area"; "You add a reward of gold to the flag until a hero or heroes accept(s) it" —
  [GamingBolt](https://gamingbolt.com/majesty-2-review/amp). A preview lists four rewards: "explore, attack, protect,
  and fear" — [GameBanshee preview](https://gamebanshee.com/xxyq) (search snippet). The sources disagree on the count
  (3 or 4); the wiki-based notes confirm four, with bounties raised "in 100 or 500 steps, with a settable default" —
  `/home/user/test-game/docs/research/02-majesty-2.md`. Heroes respond "only if they feel that the amount is worth
  their while" — [Gear Diary](https://geardiary.com/2011/01/17/pc-game-review-majesty-2-the-fantasy-kingdom-sim/amp/)
  (search snippet).
- **Majesty 1 flags.** Attack (unit or building) and Explore flags, paid up front and not refundable. Explore "draws
  heroes to a spot or into the fog". Only the area around the Palace starts revealed and "you can't build on
  unexplored ground" — `/home/user/test-game/docs/research/01-majesty.md`.
- **Majesty iPad.** You give the AI "a nudge in the right direction" by "offering bounties for destroying certain enemy
  structures"; "there's no mouse on the iPad", so no right-clicking — [Digitally Downloaded](https://digitallydownloaded.net/?p=52937).
  The touch version cannot queue hero training: "there's no way of queuing up heroes for training like in the PC
  version" — [Pocket Gamer](https://www.pocketgamer.com/articles/027948/r/).
- **Crown of Greed contracts.** Bounties such as "clearing a monster den" or rewards "for exploring ruins"; "master the
  art of motivation" — [Steam](https://store.steampowered.com/app/1697870/). Double-clicking a building posts an
  instant defend contract; contracts can be moved and adjusted; rewards can be paid early to keep heroes in place —
  `/home/user/test-game/docs/research/03-related-games.md`. Flag types named by a player: attack, defense,
  exploration, warning, and a **coordinated-attack "rally flag"** paired with a target flag ("this is simple but
  -excelent- idea") — [Steam forum](https://steamcommunity.com/app/1697870/discussions/0/595139814470240895). After
  release, flag icons on the minimap are hard to see — [Vaporlens](https://vaporlens.app/app/1697870/crown_of_greed.md).
- **Crown of Greed day/night.** Day/night strengthens some enemies and some hero traits, but players report no visible
  day/night clock — `/home/user/test-game/docs/research/03-related-games.md`.
- **Dungeon Village.** "you can't directly control the adventurers as they act independently"; quest progress appears
  on the bottom bar — [LadiesGamers](https://ladiesgamers.com/dungeon-village-2-review/). Up to nine adventurers
  volunteer for a quest at random, and you can pay to fill the gaps —
  `/home/user/test-game/docs/research/03-related-games.md` (Kairosoft wiki).
- **Hero selection.** Majesty 2's portraits "allow you to easily select and examine your heroes" —
  [GameBanshee](http://www.gamebanshee.com/kakyu).

### Inferences
- The shared pattern is world flag, then gold amount, then heroes deciding. None of the sources describes a clear
  "who took it" display. On a phone, a strong opening is a flag that shows **the takers as small portrait pips on
  the flag itself**, and a gold figure painted on the pennant.
- Crown of Greed's missing day/night clock and crisis pings, and its faint flag icons on the minimap, are known gaps.
  A clear day/night dial and threat banner on a framed plaque would set us apart.
- A rally-plus-target flag pair was well liked. It suits our attack flag if parties exist.

### Gaps
- What a flag looks like in each game (pennant colours, banner art, how the gold number shows) is not described in any
  source I could reach. *Unverified recollection:* Majesty flags are small pennants in the world with the reward shown
  when selected; Majesty 2 flags are tall coloured banners (one colour per type) with gold readouts. Check screenshots.
- What a hero info card contains (stats, inventory, current thought or target) is not documented in reachable text for
  any of the games beyond "portraits" and "six attributes".
- How fog of war looks (black, painted parchment or desaturated) is undocumented in the reachable sources.

## 4. How heroes' autonomous thinking is communicated

### Takeaway
Voice is the genre's strongest channel. Majesty's royal-advisor narration (George Ledoux) and the heroes' spoken
comments are remembered as highlights. Majesty 2 brought the advisor back, and Crown of Greed brought back a
narrator "George" that players liked. Kairosoft uses **speech bubbles over the walking NPCs** and a message bar at
the bottom. No source documents thought icons or status text.

### Cited Findings
- **Majesty 2** "brought back George Ledoux to play your royal advisor. His voice acting was one of the highlights of
  Majesty, and he does another good job with Majesty 2" — [GameBanshee review](http://www.gamebanshee.com/kakyu).
  GamingBolt jokes that all backstory is told by a "Sean Connery sound alike, whom I have come to call Con Seanery" —
  [GamingBolt](https://gamingbolt.com/majesty-2-review/amp).
- **Majesty 1 had spoken comments.** The Majesty 2 preview says "the spoken comments of the original are not (yet)
  present" but the humour is — [GameBanshee preview](https://www.gamebanshee.com/xxyr) (search snippet). A GOG user
  review praises the "excellent voice work" — [GOG Majesty Gold HD reviews](https://www.gog.com/en/game/majesty_gold_hd)
  (search snippet, user opinion).
- **Majesty iPad.** The reviewer enjoys "the bites of text that consist of the game's story" for their humour —
  [Digitally Downloaded](https://digitallydownloaded.net/?p=52937). Pocket Gamer, though, says "the writing and dearth
  of content dent the experience" — [Pocket Gamer](https://www.pocketgamer.com/articles/027948/r/).
- **Crown of Greed.** Voice acting is praised, and the "return of narrator George is well received". A
  narrator-related bug unpauses the game after the narrator speaks —
  [Vaporlens](https://vaporlens.app/app/1697870/crown_of_greed.md). (Probably George Ledoux, but the summary does
  not give a surname. Unconfirmed.)
- **Dungeon Village 2.** "cute little NPCs walking about with speech bubbles above their heads" —
  [LadiesGamers](https://ladiesgamers.com/dungeon-village-2-review/).
- **Related genre precedent.** Dungeon Keeper shows "thought bubbles" over creatures for what they want (food, pay,
  sleep) — `/home/user/test-game/docs/research/03-related-games.md`.

### Inferences
- Our speech-bubble barks put us in Kairosoft's lane visually, and in Majesty's lane in tone (humour). Painted
  storybook bubbles (inked outline, small icon plus a short line), backed by short voice or chirp sounds, could
  combine both. A narrator or advisor voice is a genre signature that a browser game could hint at cheaply with
  text-only "royal herald" plaques.
- No game in the set clearly shows *why* a hero picked a target. Showing intent briefly (an icon of the flag they are
  heading for, or a coin icon when greed wins) would be distinctive.

### Gaps
- No source describes Majesty's in-world hero text, health bars or status lines. No source describes Crown of Greed
  thought or status icons.
- No examples of Majesty hero voice lines could be checked (TV Tropes and the wiki were blocked).

## 5. Feedback and juice (notifications, logs, sound, gold animations)

### Takeaway
The best-documented feedback finding is negative. Kairosoft's **constant, unskippable info pop-ups** are the most
cited complaint about Dungeon Village 2 and were already noted for the first game. Crown of Greed lacks crisis
pings. Majesty is remembered for its advisor voice cues. Little is documented about gold or tax animations.

### Cited Findings
- **Dungeon Village 2.** "there is an over-abundance of informational pop-ups"; "it's annoying how often the game
  pauses to tell you something that has just been mentioned on the bar on the bottom" —
  [LadiesGamers](https://ladiesgamers.com/dungeon-village-2-review/). Unskippable pop-ups are the top negative theme
  (weight 0.97, "click-intensive chore"); players want to skip events, get fewer notifications and have a high-speed
  mode — [Vaporlens DV2](https://vaporlens.app/app/1983710/dungeon_village_2.md).
- **Dungeon Village (2012).** "You're forever being bombarded with fresh information, and unlocking new items and
  events" (Damien McFerran, 12 March 2012, 4/5) — [Pocket Gamer](https://www.pocketgamer.com/dungeon-village/review/).
- **Crown of Greed.** Crises aren't pinged on the minimap —
  `/home/user/test-game/docs/research/03-related-games.md`. The soundtrack by Polish artists is described as
  "haunting" — [Steam](https://store.steampowered.com/app/1697870/).
- **Majesty 2.** The pause button and build queues were added — [GameBanshee](http://www.gamebanshee.com/kakyu). Advisor
  voice — as in section 4.

### Inferences
- Steer clear of modal pop-ups entirely. Use non-blocking toasts or barks with an optional log. This is the one
  feedback lesson that is clearly documented.
- Crisis pings (an edge-of-screen arrow, or a minimap pulse when a building or hero is attacked) are an expected
  feature that the newest Majesty-like lacks.

### Gaps
- No source describes gold or tax animations (coins flying to the treasury, tax collector visuals) in any of the
  games, nor event-log design.

## 6. Reviewer and player views on UI and visual clarity (especially mobile)

### Takeaway
The Majesty mobile port was judged **well suited to touch in concept** (no APM pressure, no right-clicking) but let
down by **tiny text on iPhones, fiddly placement and targeting, and icon-only spells**. Kairosoft is judged
charming but noisy, and its controls feel "mouse-driven" on touch. Crown of Greed's early UI hid its main verbs.

### Cited Findings
- **TouchArcade (Majesty iOS, 18 Aug 2011, 3/4).** Building and bounty focus means no clicks-per-minute pressure, a
  good fit for touch. "Positioning of buildings and waypoints is occasionally troublesome, as is the targeting of your
  spells". "Spells are denoted by icon only, so determining the function and efficacy of your arcane arsenal is
  problematic". Text is readable on iPad but "much trickier to decipher on an iPhone screen" —
  [TouchArcade](https://toucharcade.com/2011/08/18/majesty-the-fantasy-kingdom-sim-review) (via search snippet; page
  returned 403 to direct fetch).
- **Digitally Downloaded (Majesty HD iPad).** "a masterful interface" with one hitch: "no 'tap and drag' ability" for
  precise building placement — [Digitally Downloaded](https://digitallydownloaded.net/?p=52937).
- **Pocket Gamer (Majesty Android, 3.5/5).** "An elegant finger-friendly building placement system makes tapping up a
  city a straightforward affair", "despite the relatively tiny UI text" —
  [Pocket Gamer](https://www.pocketgamer.com/articles/027948/r/). (Note: Pocket Gamer finds placement elegant, while
  Digitally Downloaded finds precision placement hard. They disagree.)
- **MacTrast (Majesty Northern Expansion iOS).** The iPhone "can be very challenging (due to screen size)"; "touch targets
  on both the iPhone and iPad were iffy"; but "an excellent tutorial", after which "it's actually quite easy to play" —
  [MacTrast](https://www.mactrast.com/2013/02/review-majesty-the-northern-expansion/amp/) and
  [MacTrast 2012](https://www.mactrast.com/2012/12/review-majesty-northern-expansion-a-fantasy-sim-ios/amp/) (search
  snippets).
- **Pocket Gamer (Dungeon Village).** "It feels almost as if it's been made with a mouse-driven control system in mind,
  and feels a little imprecise when allied with a touchscreen" —
  [Pocket Gamer](https://www.pocketgamer.com/dungeon-village/review/). Gamezebo found "confusing instructions" —
  [Wikipedia: Dungeon Village](https://en.wikipedia.org/wiki/Dungeon_Village).
- **Dungeon Village 2 on PC.** The port feels built for touchscreens; controls described as "janky" with "excessive
  clicking"; no batch "buy all" operations; 20 FPS lock — [Vaporlens DV2](https://vaporlens.app/app/1983710/dungeon_village_2.md).
  Steam: Very Positive, 86% of 672 — [Steam](https://store.steampowered.com/app/1983710/).
- **Crown of Greed.** UI called "wanky" before release (see section 2). After release it is praised as improved and
  intuitive, with minimap flag icons hard to see; Steam Mixed, 59% of 698 —
  [Steam](https://store.steampowered.com/app/1697870/), [Vaporlens](https://vaporlens.app/app/1697870/crown_of_greed.md).
- **Majesty 2 overall.** Metacritic 72 — [Wikipedia: Majesty 2](https://en.wikipedia.org/wiki/Majesty_2:_The_Fantasy_Kingdom_Sim).

### Inferences
- Lessons for a phone-first Realm mode: (1) a minimum text size on cards and plaques; (2) spell and flag icons
  **with labels or a long-press tooltip**, never icon-only; (3) drag-to-place with a snap preview for flags; (4) large
  touch targets for picking a hero inside a crowd (for example, tap a crowd to fan out portraits).

### Gaps
- No reachable review of the 2011 iOS or Android Majesty ports gives a layout description or mentions whether the
  layout was changed for phones. HeroCraft's role as porter is from memory and unverified this session.
- I found no review discussing Kairosoft's portrait layout specifically.

## 7. Visual signatures (what makes each recognisable)

### Takeaway
Each game has a one-line identity: Majesty 1 has busy, humorous 2D isometric sprites plus the advisor's voice;
Majesty 2 has colourful, whimsical 3D with banner flags and a portrait strip; Crown of Greed has gloomy Slavic-folklore
3D with buildings that look alive; Kairosoft has bright, chunky pixel towns full of speech-bubble chatter. Nobody in
this set occupies a **painted storybook or illuminated-manuscript** look.

### Cited Findings
- Majesty 1: 2D original [GameBanshee preview](https://www.gamebanshee.com/xxyr); "tiny details in building animations
  and inspired visual flourishes" [Pocket Gamer](https://www.pocketgamer.com/articles/027948/r/); the voice acting was
  "one of the highlights of Majesty" [GameBanshee](http://www.gamebanshee.com/kakyu); the "gently satirical, high fantasy
  world of Ardania" [Wikipedia: Majesty 2](https://en.wikipedia.org/wiki/Majesty_2:_The_Fantasy_Kingdom_Sim).
- Majesty 2: "colorful and fun to watch" 3D battles, hero portraits [GameBanshee](http://www.gamebanshee.com/kakyu);
  "whimsical presentation" [GameGrin](https://www.gamegrin.com/reviews/majesty-2-review/).
- Crown of Greed: "gloomy and dark", Slavic folklore (Baba Yaga, drowners, basilisks)
  [Steam](https://store.steampowered.com/app/1697870/), [PCGamesN](https://www.pcgamesn.com/crown-of-greed/new-steam-rts-game);
  "darker vibe" units [Steam forum](https://steamcommunity.com/app/1697870/discussions/0/595139814470240895).
- Dungeon Village: "classic Kairosoft visual look, bright and colourful", speech bubbles
  [LadiesGamers](https://ladiesgamers.com/dungeon-village-2-review/); pixel and retro tags
  [Steam](https://store.steampowered.com/app/1983710/); jokey names for heroes riffing on famous video-game characters
  [Wikipedia](https://en.wikipedia.org/wiki/Dungeon_Village).

### Inferences
Draft signatures for the report writer, synthesised from the findings above:
- **Majesty (2000, HD, mobile):** A 2D isometric fantasy town crowded with small animated sprites. Gentle satire in
  the writing, and a royal advisor (George Ledoux) whose voiced asides carry much of the personality. On phones it is
  the same PC layout shrunk down, with tiny text.
- **Majesty 2 (2009):** The same idea in colourful, slightly toy-like 3D with a rotating camera. The HUD adds hero
  portraits, build queues and pause, flags come in four types, and the voiced advisor returns. Reviewers found it
  pretty but technically unremarkable.
- **Crown of Greed (2026):** A grim, desaturated, Slavic-folklore Majesty in modern 3D. Buildings light up and show
  damage, heroes carry trait-based personalities, a narrator returns, and a console-friendly wheel UI was first
  criticised for burying flags and spells.
- **Dungeon Village 1/2:** A cheerful, saturated pixel-art village seen from above. Tiny chibi adventurers chatter in
  speech bubbles, a bottom message bar tracks quests, and the game is known for interrupting with pop-ups.
- **Our opening:** The painted storybook look (inked outlines, parchment and wood-framed plaques), a fan build wheel,
  barks as illustrated bubbles, and flags as painted pennants with taker pips would read as different from all four.

### Gaps
- Signatures for Majesty 1, Majesty 2 and Kairosoft would be stronger with screenshot analysis (palette swatches,
  HUD measurements). That was not possible from text sources this session.
- Related Kairosoft kingdom sims (for example Kingdom Adventurers, Dungeon Village's sister titles) were not
  researched because of the tool budget.
