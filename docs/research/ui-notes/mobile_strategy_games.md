# Mobile (phone) strategy games: UI, touch controls and art direction (survey for "Hold the Hall" Realm mode)

Scope note: research done 2026-10-19 with web search plus a few page fetches. Several primary pages were not reachable: TouchArcade article pages returned HTTP 403 to the fetch tool, and the GDC news page returned 404. Many findings below come from search-result snippets of those pages rather than full reads. Treat a quote from a snippet as accurate to the snippet, not as checked against the full article. Items marked "(training knowledge, unverified)" are not sourced and must not be presented as fact.

## 1. Orientation (portrait vs landscape), one-thumb vs two-thumb, thumb-zone placement

### Takeaway
Industry commentary since 2016 treats portrait/one-hand as the default for phone-first games. The sources split on it. Supercell built Clash Royale for portrait one-hand play, but moved Brawl Stars to landscape because portrait controls were hurting retention. Builders and sims that support both orientations (Pocket City) are praised, though their portrait layouts draw "quirk" complaints. Thumb-zone research says the bottom third of the screen is the easy-reach area, and the top corners are hard to reach.

### Cited Findings
- Jon Jordan (PocketGamer.biz, 15 Mar 2016) says Clash Royale was "designed to be played on a phone in portrait (or upright) mode", with an interface built for one-handed play and controls that "sit nicely under your thumb". He contrasts this with Clash of Clans and Hay Day, which were tablet/landscape-oriented. — [PocketGamer.biz](https://www.pocketgamer.biz/comment-and-opinion/62882/how-portrait-mode-trumped-tablet-first-gaming/)
- The same piece cites top-grossing Japanese portrait games (Puzzle & Dragons, Monster Strike), and Candy Crush (portrait) outperforming the landscape Bubble Witch Saga. It also gives counter-examples where landscape midcore games succeeded (Marvel Contest of Champions, Star Wars Galaxy of Heroes). Its conclusion is that a game not designed for one hand in upright orientation "is fighting a losing battle". This is opinion, not data. — [PocketGamer.biz](https://www.pocketgamer.biz/comment-and-opinion/62882/how-portrait-mode-trumped-tablet-first-gaming/)
- Supercell's earlier stance (2012) was "the primary focus will be to create the optimal experience on a tablet". Boom Beach (2014) was landscape. — [PocketGamer.biz (via search snippet)](https://www.pocketgamer.biz/how-portrait-mode-trumped-tablet-first-gaming)
- Counter-case: Brawl Stars moved from portrait to landscape during soft launch (March 2018). Supercell said the portrait controls were "a major hindrance" to retention. Community manager Ryan Lighton said: "Our decision was not portrait to landscape. Our decision was landscape or kill [the game]." Tap-to-shoot was dropped as uncomfortable in landscape, so there was a single joystick control scheme. The camera zoomed out, and characters were drawn bigger to compensate. — [TouchArcade (via snippet)](https://toucharcade.com/2018/03/21/brawl-stars-landscape-balance-update-attempts-to-improve-long-range-brawlers/); [Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2018/5/11/bs)
- An Elder Scrolls: Blades interface write-up argues that people often have "one free hand", so portrait is a must for that play context. Blades shipped with both orientations. — [UESP](https://content2.uesp.net/wiki/General:Building_the_Interface_of_The_Elder_Scrolls:_Blades_in_Landscape_and_Portrait)
- Pocket City / Pocket City 2 (Codebrew): TouchArcade says the interface "feels right" in both portrait and landscape on any device, with auto-rotate or a fixed-orientation option. The original lets you switch orientation on the fly. iMore found "several UI quirks that end up being annoying, especially in portrait mode". — [TouchArcade, Pocket City 2 review](https://toucharcade.com/2023/04/18/pocket-city-2-review-mobile-iphone-ipad-premium-city-builder/); [iMore](https://www.imore.com/pocket-city-review); [App Store listing](https://apps.apple.com/app/id1330451888)
- Kingdom Rush (landscape): a mobile-UI critique says "between two thumbs the user can reach everything easily". It praises circular buttons as "perfect for your thumbs and not too small". — [Emily Miles, mobile UI blog (2018)](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for)
- Thumb-zone research: Steven Hoober's 2013 field study (1,333 observations, 780 of them touching the screen) found 49% one-handed grip, 36% cradling the phone and tapping with the other hand, and 15% two-handed. Writers who build on it describe the bottom of the screen as the easy-reach zone and the top corners as the "red zone". They caution that zones shift with device size, handedness and orientation. — [Smashing Magazine, "The Thumb Zone"](https://smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users); [A List Apart grip figures](https://alistapart.com/1-2-phone-grips-jpg/)
- Clash of Clans (landscape) UI revamp, 8 Oct 2026: Battle is now bottom-left and Build bottom-right, "mirrored" so the two halves of the core loop get equal weight. Settings and Inbox moved inside the Profile button (top-left). The stated goal is "the right buttons in the right place", "not to have less buttons just for the sake of it". — [Supercell blog](https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/)

### Inferences
- Realm involves panning a map, placing flags and reading cards. That is closer to Clash of Clans' base view (landscape, two thumbs, primary actions in the bottom corners) than to Clash Royale's one-lane battle. A portrait layout is still viable if every primary action sits in the bottom third. The Brawl Stars case shows portrait struggles when the game needs continuous two-axis control. Realm's indirect control (no direct steering of units) is the kind of game where portrait works well.
- Supporting both orientations, as Pocket City does, is praised, but its portrait layout drew most of the complaints. If Hold the Hall supports both, design the portrait layout first.
- CoC's mirrored bottom corners (two core verbs, one per thumb) map naturally onto Realm. One possible split is "Place flag" bottom-right and "Build/Hire" bottom-left, with the day/night or wave control in a bottom corner as well.

### Gaps
- No primary Supercell GDC talk on Clash Royale's orientation decision was found; the evidence is trade-press commentary.
- I could not confirm the orientation of Kairosoft's Kingdom Adventurers or Dungeon Village from sources. (Training knowledge, unverified: Kairosoft mobile titles are mostly portrait, with a vertically scrolling town view.)
- Rush Royale's portrait one-hand layout was not covered by any review found. (Training knowledge, unverified: it is portrait, with a merge grid at the bottom and the opponent's board mirrored at the top.)

## 2. HUD conventions: resources, menus, minimap, notifications; bottom sheets vs side panels; info cards; screen share

### Takeaway
The dominant base-view convention, current as of the Oct 2026 CoC revamp, puts the profile/settings cluster top-left, resources in a top strip, and two big core-verb buttons in the bottom corners. Notifications are badges placed on the button they relate to, rather than separate alerts. Premium ports of PC strategy games (Northgard, Legend of Keepers, Majesty) all advertise a "revamped interface designed for mobile". Majesty's 2011 iPhone port was criticised for small fonts and an "unfriendly" interface.

### Cited Findings
- CoC revamp (Oct 2026): the Shield sits next to resources "since it protects them". "Each tab shows only the currencies that tab can spend". Battle Log and Edit Army are folded into the Battle button, and all upgrades go into four Build tabs. The Clan War button appears only while a war is active. — [Supercell blog](https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/)
- CoC notification pattern: "the Battle button now tells you when something's waiting" (a flaming-sword icon for revenge, an eye for a live replay). The Shop shows a red pip only "when there's a real reason to visit", and it clears after a visit. The event tray opens automatically on load. — [Supercell blog](https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/)
- Third-party guides confirm Battle Log and Edit Army now live inside the bottom-left Battle button, with star-bonus progress shown above it. These are secondary sources. — [trophycoach.com](https://trophycoach.com/clash-of-clans/guides/clash-of-clans-new-ui-2026-where-did-my-buttons-go); [cocbasedrop.com](https://cocbasedrop.com/blog/clash-of-clans-new-ui-2026-where-everything-moved)
- Kingdom Rush: the level map shows status per level, with quick access to the hero room, store and encyclopedia. A "quick description of the major tower upgrades is displayed to the side" during selection. The reviewer praises the game for staying "away from cursive-fonts in the game-play". — [Emily Miles](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for)
- Kingdom Rush on iPhone shipped with a "revised interface that's optimized for smaller screens" (promotional press release). — [Armor Games / Triple Point PR](https://pressreleases.triplepointpr.com/md/tower-defender-kingdom-rush-invades-puny-little-iphones-after-viciously-conquering-ipad-charts.md/)
- Ironhide devlog #21: after player feedback that a new game's UI "didn't feel like Kingdom Rush", the studio is reworking it to be "cleaner, clearer, and more Kingdom Rush-y". Which title this refers to was not confirmed from the snippet. — [Ironhide devlog #21](https://www.ironhidegames.com/News/Details/502)
- Northgard mobile (Playdigious/Shiro, iOS April 2021) was "carefully redesigned for mobile" with "a revamped mobile interface". Its App Store rating is about 4.6/5 from about 3.6K ratings. — [TouchArcade launch](https://toucharcade.com/2021/04/13/northgard-mobile-out-now-ios-price-free-dlc-roadmap-playdigious-shiro-games/); [App Store](https://apps.apple.com/us/app/northgard/id1533979882)
- Legend of Keepers mobile (Playdigious, May 2023) had a "revamped interface", cloud saves and MFi controller support. — [Playdigious press release (PDF)](https://storage.mfn.se/8fd8908c-54ce-4811-a28c-1f33f19d6be6/playdigious-releases-mobile-version-of-legend-of-keepers.pdf); [TouchArcade](https://toucharcade.com/2023/05/23/legend-of-keepers-mobile-download-out-now-dungeon-management-roguelite-playdigious-iphone-android-price)
- Majesty (HeroCraft iOS port, 2011): TouchArcade (4/5) called the interface unfriendly and said the small font is "much trickier to decipher on an iPhone screen", recommending "the larger device". A Windows Phone review said "most of the commands are through a menu based system, which works well on a smartphone screen" (71%). PocketGamer's review of the Northern Expansion advised playing it on a tablet. — [TouchArcade (via snippet)](https://toucharcade.com/2011/08/18/majesty-the-fantasy-kingdom-sim-review); [All About Windows Phone](https://allaboutwindowsphone.com/reviews/item/17924_Majesty.php); [PocketGamer](https://www.pocketgamer.com/majesty-northern-expansion/review)
- Kingdom Two Crowns mobile (2020, $9.99) "doesn't have a single onscreen button". The game is gesture-only: drag to move, swipe down to drop coins, swipe up for the mount's special, two-finger swipe up for the monarch's special. A review complains that the game "never once told me to swipe up" for the mount ability. — [AppUnwrapper review](https://www.appunwrapper.com/2020/05/17/kingdom-two-crowns-ios-review/); [Kingdom wiki: controls](https://kingdomthegame.fandom.com/wiki/Menu); [TouchArcade launch](https://toucharcade.com/2020/04/28/kingdom-two-crowns-mobile-version-out-now-controller-support-splitscreen-ios-android-bloodstained/)
- Polytopia: Midjiwan CEO Christian Lövstedt describes the studio's approach as a "minimalism of experience" that keeps focus on gameplay "rather than menus and currencies". Creator Felix Ekenstam "kept simplifying and removing stuff until they reached the core". — [Mobidictum](https://mobidictum.com/christian-lovstedt-midjiwan-polytopia-minimalism/); [Pocket Tactics interview](https://www.pockettactics.com/the-battle-of-polytopia/interview)
- Kairosoft Dungeon Village 2: the main complaint is "an over-abundance of informational pop-ups". A player-review aggregator lists "overwhelming unskippable pop-ups" as a common complaint. — [LadiesGamers](https://ladiesgamers.com/dungeon-village-2-review/); [Vaporlens (aggregator)](https://vaporlens.app/app/1983710/dungeon_village_2)
- Cult of the Lamb: PocketGamer's review notes that on a small screen "often the text box felt very large, going over the creature's head" when talking to characters. — [PocketGamer](https://www.pocketgamer.com/cult-of-the-lamb/review/)

### Inferences
- Contextual badges on the relevant button (CoC's sword/eye icons and red pips that clear) fit Realm's barks and alerts better than modal pop-ups. Kairosoft and Majesty's pop-up and small-text problems are the anti-pattern.
- Realm should show a currency only where it can be spent (the CoC rule): gold in the top strip always, forge materials only inside the forge sheet.
- A speech bubble or text box that covers the speaker (Cult of the Lamb) is a known small-screen problem. Barks should be short (one line), anchored above the head with a pointer, and kept away from the tapped object.
- Players and reviewers recognise and expect "Revamped for mobile" for ports. In practice that means larger fonts, fewer nested menus and contextual buttons.

### Gaps
- No source measured how much screen share HUDs take; percentages would need screenshots (e.g. from gameuidatabase.com, which was not fetched).
- Minimap conventions on phones were not covered by any source found. (Training knowledge, unverified: most phone base builders omit a minimap and rely on pinch-out; Northgard mobile keeps one.)
- Bottom sheets vs side panels: no source compares the two directly for games.

## 3. Touch patterns for placement and targeting; selecting small units; avoiding mis-taps

### Takeaway
The most-praised patterns are a few. The first is fixed, visible build slots with a contextual ring of options, plus a second tap to confirm a purchase, with a tap elsewhere to cancel and keep your money (Kingdom Rush). The second is tap a unit, then tap a destination, with units engaging foes on their own (Bad North). The third is tap to place and hold to delete, backed by haptics (Townscaper). Mis-taps come from menus placed too close to tappable world spots, hero icons that are easy to trigger, and free-form placement or targeting on a small screen (Majesty iPhone, Mini Metro on small iPhones).

### Cited Findings
- Kingdom Rush: "blank circles on the map indicate where the tower goes". Tapping a spot shows the tower options. "The game requires a second-tap to confirm a tower purchase or tower upgrade", and tapping elsewhere cancels and keeps the money. — [Emily Miles](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for)
- Kingdom Rush complaints: the extra-weapons menu "frequently rolls out at inappropriate times" because it sits too close to a tower slot. The hero icon is easily triggered by accident, and "it isn't super-clear when you've selected your hero by accident", which can send the hero somewhere unintended. — [Emily Miles](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for)
- Kingdom Rush Origins (TouchArcade): the reviewer understands the lack of zoom but found it hard to track hero units on the iPad mini screen in large battles. — [TouchArcade review](https://toucharcade.com/2014/12/19/kingdom-rush-origins-review/)
- Bad North mobile (Jotunn Edition, 2019): "Tap the troop unit and then tap where you want them to go". Troops attack automatically when near enemies, and you can easily zoom and rotate the islands. Time slows down during combat so you can adjust. — [TouchArcade (via snippet)](https://toucharcade.com/?p=259983); [GamesBeat](https://gamesbeat.com/bad-north-shows-that-even-bloody-viking-battles-can-be-artsy-and-cute/)
- Townscaper mobile: tap to place, hold "for a second or two" to delete, two-finger zoom, one-finger rotate, two-finger drag to pan. TapSmart says it "makes great use of the iPhone's haptic touch features". TouchArcade says touch is "the way to go" over a controller. — [AppUnwrapper](https://www.appunwrapper.com/2021/10/20/townscaper-ios-review/); [TapSmart](https://www.tapsmart.com/news/townscaper-review/); [TouchArcade](https://toucharcade.com/2021/10/20/townscaper-mobile-review-iphone-android-ipad-icloud-controller-support-raw-fury/)
- Pocket City: Destructoid reported no case of building something unintended (played on a 2018 iPad). TouchArcade calls the touch controls "nearly perfect". — [Destructoid](https://destructoid.com/?p=227371); [TouchArcade](https://toucharcade.com/2023/04/18/pocket-city-2-review-mobile-iphone-ipad-premium-city-builder/)
- Mini Metro: Mac|Life said that on a smaller iPhone "the tight quarters ... can make it difficult to make the exact moves you want". It called the touch controls "less-than-accurate", which can lead to accidentally deleting lines, and said "It's better on iPad". — [Mac|Life via PressReader](https://www.pressreader.com/australia/mac-life/20161213/284262414817254)
- Majesty iPhone: "Positioning of buildings and waypoints is occasionally troublesome, as is the targeting of your spells". The bounty/building focus removes clicks-per-minute pressure, "more fun and less frustration". — [TouchArcade (via snippet)](https://toucharcade.com/2011/08/18/majesty-the-fantasy-kingdom-sim-review)
- Kingdom Two Crowns: a gesture-only scheme with no on-screen buttons. Undiscoverable gestures were the complaint. — [AppUnwrapper](https://www.appunwrapper.com/2020/05/17/kingdom-two-crowns-ios-review/)
- Brawl Stars: Supercell dropped tap-to-shoot in landscape for comfort and to keep "one single control scheme". — [TouchArcade (via snippet)](https://toucharcade.com/2018/03/21/brawl-stars-landscape-balance-update-attempts-to-improve-long-range-brawlers/)

### Inferences
- For Realm bounty flags: snap the flag to a target (camp, foe, or tile) rather than a free pixel position, and show a preview ring. Then require a confirm tap that shows the gold cost, with a tap elsewhere cancelling (the Kingdom Rush pattern). This directly avoids Majesty iPhone's "waypoint and spell targeting troublesome" complaint.
- Keep world-anchored popups (flag menu, build ring) away from other tappable world objects and from the HUD. Kingdom Rush's mis-tap came from the extra-weapons menu sitting near a build slot.
- Selecting tiny heroes: make a tap on a hero's general area pick the nearest hero within a generous radius, and add a portrait rail so heroes can also be selected off-map. Kingdom Rush Origins' "hard to track heroes" complaint suggests that a tappable portrait which centres the camera on the hero is worth having.
- Hold-to-delete or hold-to-inspect with haptics (Townscaper) suits a long-press info card. The browser Vibration API exists on Android Chrome but not on iOS Safari (training knowledge, unverified), so haptics cannot be relied on.
- Every gesture needs an on-screen affordance or tutorial prompt, because Kingdom Two Crowns' hidden gestures were missed.

### Gaps
- No source found describes a magnifier/loupe for placement in any of these games.
- I found no source on radial menus in these games apart from Kingdom Rush's build ring. (Training knowledge, unverified: Kingdom Rush's tower menu is a ring of round icons around the slot.)

## 4. Making autonomous agents legible on a small screen

### Takeaway
Evidence is thin. Majesty's reviewers say the AI heroes mostly look after themselves and bounties are a "nudge". Kingdom Rush's hero-tracking problem on small screens shows that legibility needs help beyond the map view. Bad North keeps its units readable with a tiny, uncluttered playfield and slow-motion in combat.

### Cited Findings
- Majesty HD (iPad): "it's possible to give the AI a nudge in the right direction by offering bounties ... though it's easier just to let the heroes go about on their merry way for the most part". — [Digitally Downloaded](https://digitallydownloaded.net/?p=52937)
- Majesty is described as indirect control: "you place structures and set bounties to encourage units in the right direction". — [All About Windows Phone](https://allaboutwindowsphone.com/flow/item/14479_Majesty-fantasy_flavoured_real.php)
- Kingdom Rush Origins: it is hard to track hero units on the iPad mini during large battles, and there is no zoom. — [TouchArcade](https://toucharcade.com/2014/12/19/kingdom-rush-origins-review/)
- Bad North: "the key feature here is the size of the game space: it's small". Time slows during combat. — [80.lv](https://80.lv/articles/bad-north-cure-minimalistic-rts-with-vikings/); [GamesBeat](https://gamesbeat.com/bad-north-shows-that-even-bloody-viking-battles-can-be-artsy-and-cute/)
- Kingdom Rush 5: Alliance (mobile release 25 Jul 2025, $6.99) headlines using two heroes at once in each battle. Hero counts conflict between sources (12 heroes at launch per TouchArcade; "16 epic heroes" in the TD+ listing). — [TouchArcade](https://toucharcade.com/2024/04/10/kingdom-rush-5-alliance-release-date-app-store-preorder-pre-registration-google-play-android-iphone-ipad-gameplay-trailer/); [PocketGamer](https://www.pocketgamer.com/kingdom-rush-5-alliance/now-available-to-pre-order); [AppGoblin (TD+ listing)](https://appgoblin.info/apps/6741771054)
- Kairosoft Kingdom Adventurers (2019, free, no IAP per its listing) has you recruit warriors and mages, clear fog to open new areas, and build a town. A third-party analysis site lists "inefficient NPC pathfinding causes units to take unnecessarily long routes" as the top player complaint (methodology unverified). — [game-solver listing](https://game-solver.com/kingdom-adventurers/); [Kairosoft wiki manual](https://kairosoft.wiki.gg/wiki/Transcript:Manual_(Kingdom_Adventurers))
- Dungeon Village 2 is described as managing a village "to indirectly cultivate and empower adventurers" (aggregator summary). — [Vaporlens](https://vaporlens.app/app/1983710/dungeon_village_2)
- Kingdom Rush includes memorable voice lines on upgrade ("For the queen!"). The reviewer counts them as part of the feedback loop. — [Emily Miles](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for)

### Inferences
- Players notice autonomous agents' pathing (Kingdom Adventurers' top complaint), so heroes walking to a flag should look purposeful. A thin dotted path or an intent icon over the head ("→ flag", "resting", "shopping") would make the AI's decisions readable. Speech-bubble barks can carry the same job ("Gold on that camp? I'm in!").
- Realm needs a portrait/hero rail or a "next idle hero" button, given Kingdom Rush's hero-tracking issue on small screens. Each portrait should show state (HP ring, current-intent icon); tapping it centres the camera and opens the hero card.
- Bad North's small playfield and slowdown suggest that a short "focus" slowdown when a fight starts near a flag could aid legibility on phones.

### Gaps
- No source discussed icons over heads, colour coding of agents, or follow cameras in these specific games. Game UI Database screenshots were not reviewed.
- Majesty mobile's flag UI specifically is not described in any review found.

## 5. Session length, pause/speed controls, notifications

### Takeaway
Little direct evidence was found. Kingdom Rush's reviewer asks for a speed-up button. Premium ports add cloud saves for on-the-go play. CoC moved to badge-on-button, cleared-on-visit notifications. Dorfromantik's mobile version is being "reimagined" with a new flow for "on-the-go play", which signals that the developers think PC session lengths do not carry over to phones.

### Cited Findings
- The Kingdom Rush reviewer suggested adding a speed-up button for waves. — [Emily Miles](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for)
- Dorfromantik mobile (announced around May 2025, with Headup and Clockstone) will "retain the essence" but introduce "a new gameplay flow and mechanics optimised for touch controls and on-the-go play". Its release status was not confirmed. — [GamesMarket](https://www.gamesmarket.global/games-and-products/new-platforms-dorfromantik-comes-to-mobile-phones-and-more-consoles-with-the-help-of-clockstone-and-headup-04f6c37bb4b4e2c646fda3aa72551721); [appgefahren](https://www.appgefahren.de/dorfromantik-beliebter-spiele-hit-kommt-auf-iphone-und-ipad-378717.html)
- Northgard mobile shipped with iCloud save sync, and Legend of Keepers mobile with cloud saves. — [TouchArcade](https://toucharcade.com/2021/04/13/northgard-mobile-out-now-ios-price-free-dlc-roadmap-playdigious-shiro-games/); [Playdigious PR](https://storage.mfn.se/8fd8908c-54ce-4811-a28c-1f33f19d6be6/playdigious-releases-mobile-version-of-legend-of-keepers.pdf)
- Kingdom Rush uses phone vibration when enemies get past the exit, "creating tension". — [Emily Miles](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for)
- CoC notifications are contextual badges and pips that clear once visited, and the event tray opens on load. — [Supercell blog](https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/)
- Bad North slows time during combat. — [GamesBeat](https://gamesbeat.com/bad-north-shows-that-even-bloody-viking-battles-can-be-artsy-and-cute/)

### Inferences
- A day/night cycle maps naturally to sessions of a few minutes: one day plus one night per sitting, with an autosave at dawn. This lets a browser tab be closed safely, which matters because there is no cloud save.
- Provide 1x/2x speed and pause in a thumb-reachable corner. The Kingdom Rush reviewer asked for speed-up, and Bad North shows that slowing time aids control.

### Gaps
- No source gave measured session lengths for any of these games.
- Push notifications are not applicable to a browser game without a PWA; I did not research web-push norms.

## 6. Visual styles that read well on small screens; distinctive styles that stood out

### Takeaway
The standout looks in this space are minimalist and strongly shape-coded. Polytopia is low-poly and Bad North is a muted, picture-book isometric diorama. Townscaper's look is procedural pastel; Mini Metro's is the flat transit-map style. Kingdom Rush uses chunky, saturated cartoon illustration. Reviewers repeatedly tie readability to small playfields, simple silhouettes and shape coding, and fault busy or unclear enemies (Thronefall).

### Cited Findings
- Polytopia: Midjiwan's CEO names its "distinct low-poly graphic art style" as a key appeal factor alongside the core loop. The game has passed 25M downloads (per Wikipedia). Critics praised the graphics and found the gameplay simple and approachable. — [PocketGamer.biz interview](https://www.pocketgamer.biz/inside-the-battle-of-polytopia-studio-midjiwan/); [Wikipedia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia)
- Bad North: Stålberg drew on Revenge of the Titans' minimalist visuals. Nintendo Life describes "Monument Valley-style isometric art" and a "micro-strategy" minimalism. 80.lv says it "looks like an illustration from some twisted kids picture book". — [PocketGamer.biz indie spotlight](https://www.pocketgamer.biz/interview/68638/indie-spotlight-plausible-concept-on-bad-north/); [Nintendo Life](https://www.nintendolife.com/reviews/switch-eshop/bad_north); [80.lv](https://80.lv/articles/bad-north-cure-minimalistic-rts-with-vikings/)
- Mini Metro's information is encoded in geometric shapes ("triangles want to go to a triangular station"), so it needs very few words. It came from a game jam whose theme was minimalism. The developers say "there is a ridiculous amount of work that goes into minimalist games". — [Next City](https://nextcity.org/daily/entry/mini-metro-game-transportation-planning); [SUPERJUMP](https://www.superjumpmagazine.com/from-game-jam-idea-to-mobile-classic/); [Dinosaur Polo Club blog](https://dinopoloclub.com/?p=2315)
- Thronefall mobile (iOS, June 2025, App Store 4.6/5): iPhonesoft found it "visually striking, even on the small screens of our iPhones", but said enemies "sometimes lack clarity". — [iPhonesoft](https://iphonesoft.fr/2025/05/21/excellent-thronefall-defendre-royaume-ios); [Wikipedia](https://en.wikipedia.org/wiki/Thronefall); [App Store DE](https://apps.apple.com/DE/app/id6744029320)
- Kingdom Rush: "clear and memorable" icons and no cursive fonts in gameplay. Kingdom Rush 5 is described as the series' "most beautiful to date". — [Emily Miles](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for); [PocketGamer](https://www.pocketgamer.com/kingdom-rush-5-alliance/now-available-to-pre-order)
- Kingdom Rush co-founder Alvaro Azofra wanted the stage to feel like "a battle was going on", with the player "involved, busy". — [Kodeco interview](https://www.kodeco.com/2769-making-a-hit-tower-defense-game-a-top-app-dev-interview)
- Brawl Stars: when the camera zoomed out for landscape, "all characters are bigger too", so the art was scaled up to stay readable. — [TouchArcade (via snippet)](https://toucharcade.com/2018/03/21/brawl-stars-landscape-balance-update-attempts-to-improve-long-range-brawlers/)
- General low-poly guidance (secondary, from art-outsourcing blogs): readability, scalability and identity "especially matter for mobile titles". Colour plus silhouette identify enemies. Flat colours keep props from overpowering key elements. Don't spend geometry on small details. — [RetroStyle Games](https://retrostylegames.com/blog/low-poly-game-art-an-ultimate-guide/); [Pixune](https://pixune.com/blog/low-poly-game-art-guide/)

### Inferences
- Hold the Hall's painted storybook sprites are closest to Bad North's "picture book with a dark side" and Kingdom Rush's chunky illustration. To stand out, lean into what neither does. One option is an ink outline with a paper-texture HUD, in the manner of a medieval manuscript or a hand-drawn map. Another is a strong day/night palette swap (warm parchment day, deep blue-ink night lit by torches), which also tells the player the phase without UI.
- Thronefall's "enemies lack clarity" complaint argues for outlaws with a distinct silhouette and a single faction colour (e.g. red hoods). Heroes should be colour-coded by guild and scaled slightly larger than "real" proportions, as Brawl Stars did.
- Shape coding in the Mini Metro manner should apply to flag types (sword flag = attack, eye or compass = explore). Then the meaning reads without text even at tiny sizes.

### Gaps
- No primary art-direction interview for Polytopia or Kingdom Rush was found in this pass.
- App Store "featured" status for distinctive styles was not checked.

## 7. Performance-driven art choices relevant to browser-on-phone

### Takeaway
The direct evidence here is thin. Townscaper ships on phones with a 30 fps cap, and Cult of the Lamb's Switch port was hurt by performance until patches brought it to a 30 fps target. Kingdom Rush's devs named memory and aspect ratios as their main iOS problems. Low-poly, flat colour and pre-rendered or 2D approaches dominate the successful titles.

### Cited Findings
- Townscaper mobile has limited options: a 30 fps cap and an anti-aliasing toggle. — [TouchArcade (via snippet)](https://toucharcade.com/2021/10/20/townscaper-mobile-review-iphone-android-ipad-icloud-controller-support-raw-fury/)
- Kingdom Rush on iOS: the main challenges were "the memory issues and screen aspect ratios" (Alvaro Azofra). — [Kodeco](https://www.kodeco.com/2769-making-a-hit-tower-defense-game-a-top-app-dev-interview)
- Cult of the Lamb Switch: "oppressively bad technical performance" at launch (Nintendo World Report), improved by later patches. Pocket Tactics called the port "undercooked". — [Nintendo World Report](https://nintendoworldreport.com/review/62020); [Pocket Tactics](https://www.pockettactics.com/cult-of-the-lamb/switch-review)
- Thronefall iOS is about 636 MB and requires iOS 12+. — [App Store DE](https://apps.apple.com/DE/app/id6744029320)
- Low-poly and flat colour are recommended for readability and mobile scalability (secondary sources). — [RetroStyle Games](https://retrostylegames.com/blog/low-poly-game-art-an-ultimate-guide/)

### Inferences
- Hold the Hall's pre-baked sprites are already the right call for phone browsers: no realtime lighting, a bounded draw-call budget, and a texture-memory cost that is the main risk (as with Kingdom Rush's "memory issues"). Night could be a tinted overlay plus a few additive light sprites rather than realtime lights.
- A 30 fps cap is accepted on phones even for premium titles (Townscaper), which supports the project's existing frame-rate cap.

### Gaps
- No source on WebGL/HTML5 strategy games on phones was found in this pass. (Training knowledge, unverified: notable web strategy titles include Kingdom Rush's original Flash/Armor Games release and various .io games.)

## 8. Reviewer and player praise and complaints about phone UI (quote bank)

### Takeaway
Praise goes to thumb-sized round buttons, confirm-before-spend, menu-light minimalism, tap-unit/tap-destination, haptics, and a free choice of orientation. Complaints concern small fonts, imprecise free placement, menus that pop open near tappable spots, accidental hero selection, hidden gestures, pop-up overload, and text boxes covering characters.

### Cited Findings
- "Circular BUTTON style, perfect for your thumbs and not too small" (Kingdom Rush). — [Emily Miles](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for)
- "The game has clearly been designed with mobile play in mind, with the interface and button sizes highly optimised for touchscreens" (Kingdom Rush review). — [Switch Player](https://switchplayer.net/2020/08/07/kingdom-rush-review/)
- "Controls are precise and fun to use" (Bad North mobile); "it just feels great on touch" (TouchArcade). — [TouchArcade (via snippet)](https://toucharcade.com/?p=259983); [ZoomG](https://www.zoomg.ir/game-review/312414-bad-north-mobile-game-review)
- Majesty iPhone: small font "much trickier to decipher on an iPhone screen"; it handles "all things touchscreen imperfectly". — [TouchArcade (via snippet)](https://toucharcade.com/2011/08/18/majesty-the-fantasy-kingdom-sim-review)
- Mini Metro: touch controls "less-than-accurate", "better on iPad". — [Mac|Life](https://www.pressreader.com/australia/mac-life/20161213/284262414817254)
- Pocket City: "UI quirks ... especially in portrait mode" (iMore) vs "interface feels right in both" (TouchArcade, PC2). — [iMore](https://www.imore.com/pocket-city-review); [TouchArcade](https://toucharcade.com/2023/04/18/pocket-city-2-review-mobile-iphone-ipad-premium-city-builder/)
- Kingdom Two Crowns: "never once told me to swipe up". — [AppUnwrapper](https://www.appunwrapper.com/2020/05/17/kingdom-two-crowns-ios-review/)
- Dungeon Village 2: "an over-abundance of informational pop-ups". — [LadiesGamers](https://ladiesgamers.com/dungeon-village-2-review/)
- Cult of the Lamb: "the text box felt very large, going over the creature's head". — [PocketGamer](https://www.pocketgamer.com/cult-of-the-lamb/review/)
- Rush Royale: merging and skill balancing "add complexity and confusion" (Common Sense Media). — [Common Sense Media](https://www.commonsensemedia.org/app-reviews/rush-royale)

### Inferences
- A checklist for the Realm phone UI follows from these complaints:
  - Round buttons of 44pt or more (training knowledge: Apple HIG minimum 44pt; unverified here).
  - Confirm-before-spend on flags and hires.
  - A no-popup policy: barks and toasts that never block input.
  - Text at least 14–16 px with no script fonts in play.
  - Visible affordances for every gesture.
  - Snapped targets for flags.
  - Hero portrait rail for selection.
  - Info cards as bottom sheets that never cover the selected object.
- Lords Mobile and Rise of Kingdoms HUD conventions were not researched in this pass (time/tool budget). This is a gap.

### Gaps
- Not covered or not found: Lords Mobile / Rise of Kingdoms HUD details, Islanders mobile, RimWorld Console Edition, "The Sun Origin" (I could not verify that this game exists in this genre), Medieval Merge, Game UI Database screenshots, and Reddit threads. A fuller pass should fetch gameuidatabase.com pages for Kingdom Rush, Bad North, Northgard and Polytopia to measure HUD layouts.
- Whether Cult of the Lamb has an official phone release could not be confirmed. The PocketGamer review quoted may concern a handheld version.
