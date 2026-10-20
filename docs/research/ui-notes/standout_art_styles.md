# Stand-out art directions and UI styles for Realm mode (indie strategy / builder / medieval games) and their feasibility in a phone-first Three.js sprite game

Scope note: the brief listed some 35 games. I found good primary or near-primary sources (developer interviews, GDC write-ups, dev blogs) for about 15 of them. Everything else is in **Inferences** or **Gaps**, marked "(general knowledge, unverified)" where it rests on my own recall of the games rather than a fetched source. The report writer should treat those parts as leads to check, not as citable facts.

Local context, read from the repo (cited by file path):
- Sprites get a hand-drawn finish **at bake time**: warm dark-brown outlines (3 px at bake resolution), inner crease and depth-step lines, shading pulled into 4 bands, warmer shadows, and diagonal hatching in dark areas. It runs on CPU pixel arrays with no runtime cost — `/home/user/test-game/src/render/inkStyle.js` (`INK_STYLE`: `ink: [44,30,22]`, `bands: 4`, `hatch: 0.12`, `hatchSpacing: 6`).
- The warm colour grade on High is a **CSS filter on the canvas** (`sepia(0.08) saturate(1.04) contrast(1.04)`), and rain and winter light are CSS filters too — `/home/user/test-game/src/render/Renderer.js` (lines ~49–53, ~1074).
- Realm fog of war today is a **soft, drifting, dark grey-violet cloud**: a shader on a plane that samples a small per-chunk "seen" DataTexture with value noise (colour `mix(vec3(0.17,0.16,0.19), vec3(0.33,0.31,0.33), n)`) — `/home/user/test-game/src/render/realmLayer.js`. So fog already uses a small, chunk-resolution mask texture, which is the cheap pattern the sources recommend (see Q3).
- A dynamic-resolution controller already steps the render scale between 0.5 and 1.5 to hold the frame-rate cap — `/home/user/test-game/src/render/dynamicResolution.js`.
- Reference images (`/home/user/test-game/docs/reference/*.jpg`, viewed): warm storybook isometric with dark-brown ink lines; bronze-framed plaques, arch-topped parchment tower cards, bronze cog buttons, a "Battle Chronicle" scroll, an "Engineer's Codex" panel; on the phone HUD, torn-edged parchment with dark iron filigree trim, a red heart bar, a gold coin counter, a "Next Wave" stamp-tag, a dagger-ended ribbon banner, and a pale ground with a faint tile grid. This is already a **"parchment and iron" frame around a coloured isometric diorama**. That is close to Kingdom Rush / Thronefall territory in feel, so the differentiation has to come from Realm's *presentation metaphor* more than from the render style.

---

## Q1. Signatures of distinctive games: palette, line, texture, framing, typography, UI motif; why each reads at a glance; how each shows fog/unknown, day/night and character voice

### Takeaway
The most recognisable identities come from **one strong governing metaphor that every system obeys**: the manuscript page (Inkulinati, Pentiment), the 1-bit engraving (Obra Dinn), the Moebius comic (Sable), the found manual (Tunic), the papercraft comic (Wildermyth), the yellowed crow-quill gothic (Darkest Dungeon). Render technique matters less than that consistency. The metaphor also decides how the unknown, night and speech are shown. Pentiment's per-character fonts and Sable's "fog is the framework for day/night" are the two most transferable concrete devices.

### Cited Findings

**Inkulinati (Yaza Games): medieval marginalia as the battlefield**
- It began as a Warsaw Game Design School prototype. Art director Dorota Halicka brought in medieval marginalia, and that set the direction — [PC Gamer](https://www.pcgamer.com/uk/the-memes-of-medieval-monks-inspired-the-artwork-for-this-comedic-turn-based-strategy).
- The setting draws on 11th–14th-century European manuscripts, chosen after research with a medievalist (Łukasz Kozak of *Discarding Images*). Halicka picked a drawing style that suits animation, carries game information through "graphics and colours", and is "easy to reproduce" — [TheSixthAxis](https://www.thesixthaxis.com/2019/10/31/playing-with-history-illuminating-the-insane-game-world-of-inkulinati/).
- The consultant also checks whether *mechanics* fit the meaning of the marginalia, so style and rules are kept together — [TheSixthAxis](https://www.thesixthaxis.com/2019/10/31/playing-with-history-illuminating-the-insane-game-world-of-inkulinati/).
- Halicka and Pentiment's art director Hannah Kennedy spoke together on a 2023 Getty-linked panel about medieval imagery in games — [Medieval Art (ICMA) listing](https://www.medievalart.org/calendar/online-lecture-modern-games-medieval-wireframes-the-j-paul-getty-museum-2-august-2023-11-am-pt).

**Pentiment (Obsidian): illumination and woodcut, with typography as voice**
- Josh Sawyer pitched "a 2D game, potentially with an art style evoking European block prints". The team drew on "the visual language of real art from this time" (woodcuts) — [Game Developer deep dive](https://www.gamedeveloper.com/art/deep-dive-the-art-of-pentiment).
- To get "extreme stylistic flattening", player movement runs on tracks. Characters are shown front-on or in ¾ view as in woodcuts, and are **not scaled for depth**, so their detail stays constant against the fixed world. Scenes almost always face "north" to avoid confusion between scenes — [Game Developer](https://www.gamedeveloper.com/art/deep-dive-the-art-of-pentiment).
- 157 rigged characters. Facial expressions are hand-drawn per character and per expression — [Game Developer](https://www.gamedeveloper.com/art/deep-dive-the-art-of-pentiment).
- **Fonts are the character voice.** Each character's font reflects how the protagonist perceives them, and it shifts when that perception changes. There is no voice acting — [Inverse interview with Hannah Kennedy](https://www.inverse.com/gaming/pentiment-game-art-interview); [PCGamesN](https://www.pcgamesn.com/pentiment/art-fonts-story). Lettermatic says the fonts encode each character's **education and social standing**, drawn from period hands — [Lettermatic case study](https://lettermatic.com/custom/pentiment).
- The look draws on late-medieval illumination, early-modern woodcuts and the Nuremberg Chronicle, with **paper tone showing through the colours** for a book feel — [Inverse](https://www.inverse.com/gaming/pentiment-game-art-interview) (as summarised in search results; not re-fetched).
- Accessibility caveat: the calligraphic fonts can be hard for some readers — [Well Played preview](https://www.well-played.com.au/pentiment-preview-a-murder-mystery-scratched-in-ink/).

**Bad North and Townscaper (Plausible Concept / Oskar Stålberg): minimal islands**
- Stålberg cited Revenge of the Titans' minimalist visuals and Total War's combat as inspirations. The palette uses "watered-down tones, so war rarely appears so serene" — [PocketGamer.biz](https://www.pocketgamer.biz/interview/68638/indie-spotlight-plausible-concept-on-bad-north/).
- Townscaper continues the same tile-based procedural line (Bad North was its predecessor) — [Game Developer: How Townscaper works](https://gamedeveloper.com/blogs/how-townscaper-works-a-story-four-games-in-the-making). Automaton notes Townscaper shares Bad North's "pale" palette — [Automaton](https://automaton-media.com/articles/newsjp/20200601-125801/) (Japanese, paraphrased).
- Bad North was described as showing that bloody Viking battles can be "artsy and cute" — [GamesBeat](https://gamesbeat.com/bad-north-shows-that-even-bloody-viking-battles-can-be-artsy-and-cute/).

**Tiny Glade (Pounce Light): soft toy-like builder**
- Its warm pastel look relies on ray-traced GI, ray-traced reflections and a lot of procedural tech, yet it reportedly runs well on old GPUs — [Quarter to Three forum, quoting press](https://forum.quartertothree.com/t/tiny-glade-deserves-its-own-topic-now/162584?page=2) (secondary; weak source).

**Thronefall (Grizzly Games): the closest direct competitor in look**
- Minimalist low-poly with a restricted palette, kept so the battlefield stays readable during night sieges — [games.gg](https://games.gg/thronefall/); [shapes.inc fandom guide](https://shapes.inc/fandom/thronefall/author) (both secondary or low-reliability).

**Cult of the Lamb (Massive Monster): cute against dark**
- It started more cartoony. Horror was layered on top partly because the studio's earlier game was seen as "a kids' game" — [Inverse](https://inverse.com/gaming/cult-of-the-lamb-concept-art-interview-massive-monster/amp); [DreadXP interview with James Pearmain](https://www.dreadxp.com/?p=27832).
- Art director Pearmain drew cuter designs while the co-directors pushed "too cute, make it eviler". They deliberately avoided going too gory. Influences were Midsommar and The Witch, set against a "cute, colourful" style, plus Over the Garden Wall — [DreadXP](https://www.dreadxp.com/?p=27832); [NME](https://www.nme.com/features/cult-of-the-lamb-is-happy-tree-friends-meets-midsommar-and-it-just-might-be-your-new-favourite-game-3207717).
- They chose 2D because it is "much faster to draw than modeling everything out in 3D". Realistic detail would have made the dark content "unpleasant and nasty" — [Devolver Q&A](https://www.devolverdigital.com/blog/post/Cult-of-the-Lamb-Dont-Starve-Together-Crossover-but-make-it-an-interview).
- **Spatial mood split:** the base feels safe, and the forest beyond is creepier — [ACMI](https://www.acmi.net.au/stories-and-ideas/cult-of-the-lamb-massive-monster-take-dungeon-crawling-and-base-building-to-new-levels/) (via search summary).

**Darkest Dungeon (Red Hook): heavy ink, yellowed gothic**
- Chris Bourassa avoided "dead gray" and black **everywhere except the inks**. Even cool colours are slightly **yellowed, to suggest worn parchment**. He added "the tiniest bit of cuteness" so the look is not oppressive — [GameSpot](https://www.gamespot.com:443/articles/the-gothic-sensibilities-of-darkest-dungeon/1100-6424880/).
- The Mignola influence came from Bourassa's comics reading (the X-Force issue where Liefeld gave way to Mignola) — [Blogcritics, MIGS 2018](https://blogcritics.org/montreal-international-game-summit-2018-interview-with-chris-bourassa-creative-director-red-hook-studios/). Interviewers call it a thick-lined, crow-quill style. Bourassa was the lone artist for much of development, which drove the side-on camera — [GameBanshee](https://www.gamebanshee.com/3hqup); [Void Signal](https://voidsignal.buzzsprout.com/1744704/episodes/17754731-chris-bourassa-of-red-hook-studios).

**Songs of Conquest (Lavapotion): HD pixel art in 3D light**
- Flat pixel sprites (drawn in Aseprite) sit in environments with real depth, custom directional lighting, water specular, particle fog and dust, and soft bloom. This avoids the cost of animated 3D models — [Foro3D](https://foro3d.com/en/2026/mayo/songs-of-conquest-el-pixel-art-25d-que-moderniza-los-90-en-unity.html) (secondary; not confirmed by the developer).
- The developer says it chose pixel art to "capture an oldschool vibe" — [Steam forum](https://steamcommunity.com/app/867210/discussions/0/5079478487791385575). Some players find it "blurry coarse pixel mush" — [Steam forum](https://steamcommunity.com/app/867210/discussions/0/5234891274089864354).

**Return of the Obra Dinn (Lucas Pope): 1-bit**
- Strict two-colour output. **Outlines were added for legibility** ("understanding the 3D space much easier"), which works because draw distances are short. Bayer dithering reproduces tone ranges more accurately, while blue noise feels more organic. At 640×360, stretched fullscreen, the pattern stopped blending and became uncomfortable on large screens, so he moved to 800×450 and the lesson became "use dithering as little as possible". He tied the dither pattern to the 3D camera to stop flicker — [PlayStation Blog](https://blog.playstation.com/archive/2019/10/17/lucas-pope-on-return-of-the-obra-dinns-art-style).
- Breakdown of the stable-dither technique (the pattern is remapped onto a sphere around the camera) — [Alan Zucconi](https://www.alanzucconi.com/?p=10365).

**Sable (Shedworks): Moebius line**
- Flat shading was chosen for speed and consistency, but it flattens depth. They rebuilt depth by **layering lighting, fog and lines**. **Distance fog was "really, really key"**, was tuned per biome, **and provides the framework for the day/night cycle**. A moonlight shadow keeps characters casting shadows. **Lines fade with distance**, so objects don't "just pop in". Gridded lines give perspective and scale — [Game Developer (GDC 2022 talk write-up)](https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability).

**Tunic (Andrew Shouldice): the diegetic manual**
- Shouldice built a physical booklet, folded, ripped, taped and stained it, then scanned every page as the canvas for the illustrations (visible staples included). Pages are found out of order as you play, and their diagrams and clues often only make sense hours later — [GameSpot](https://gamespot.com/articles/how-tunics-cool-in-game-manual-was-made/1100-6507719/); [TheGamer](https://www.thegamer.com/tunic-fictional-games-manual-is-a-stroke-of-brilliance/); [Wikipedia](https://en.wikipedia.org/wiki/Tunic_(video_game)).

**Wildermyth (Worldwalker): papercraft comic**
- "Hand-painted 2D characters and scenery" are woven into a 3D world — [itch.io page](https://wildermyth.itch.io/wildermyth). Characters look like paper cut-outs in battle — [GamingOnLinux](https://www.gamingonlinux.com/2020/06/papercraft-styled-tactical-rpg-wildermyth-adds-legacy-campaigns/page=1/). Story is told in **comic panels** — [Goodreads-hosted interview with Nate Austin](https://www.goodreads.com/author_blog_posts/19162356-game-dev-interview-wildermyth).
- Artist influences: Cartoon Saloon films, vintage Disney concept art, Samurai Jack backgrounds. She admires "simplicity of forms" and how brushstrokes and textures add interest — [TurnBasedLovers](https://turnbasedlovers.com/10-turns-interview/with-wildermyth-developer).

**Inkle (80 Days, Heaven's Vault): illustrated travel**
- 80 Days uses Art Deco travel-poster styling instead of standard steampunk ("The year is 1872 – welcome to the future") — [Game Developer postmortem](https://www.gamedeveloper.com/business/postmortem-inkle-s-i-80-days-i-) (via search summary).
- Heaven's Vault puts "hundreds of hand-drawn 2D frames" inside 3D worlds, aiming for every frame to look like a graphic-novel panel — [inkle](https://www.inklestudios.com/2017/03/03/announcing-heavens-vault.html); [inkle Heaven's Vault page](https://inklestudios.com/heavensvault).

**Okami (Clover): sumi-e with a paper filter**
- Inspired by sumi-e and ukiyo-e / Hokusai woodblock. A planned realistic look strained the PS2, so the team moved to cel-shading, which led to the Celestial Brush idea (painting onto the frozen screen) — [Wikipedia](https://en.wikipedia.org/wiki/%C5%8Ckami).
- A paper-grain overlay filter gives the hand-made feel and is stronger on PS2 than in the remasters. Using the brush turns the frame into a washi scroll — [chromagi](https://chromagi.com/?p=59077); [vgfacts](https://vgfacts.com/collection/okami) (fan or database sites; moderate reliability).

**Loop Hero (Four Quarters): pixel art with a card UI**
- Reviewers single out the art: minimalist overworld sprites with a broader palette for creatures and places — [Shacknews](https://shacknews.com/article/123099/loop-hero-review-happy-death-day). The designer frames the core as a hero who keeps returning to things the player builds, such as a bandit camp — [Windows Central](https://www.windowscentral.com/loop-hero-interview). Claims of a 1980s-PC palette and a CRT filter come only from a fan guide — [shapes.inc](https://shapes.inc/fandom/loop-hero/author) (unverified).

**Armello (League of Geeks): board game in a storybook**
- Art direction is by Ty Carey. The theme is "duality and contrast", influenced by Miyazaki and Spirited Away. The board is procedurally generated 3D hex tiles — [Stevivor](https://stevivor.com/features/interviews/interview-league-geeks-trent-kusters-armello); [Wikipedia](https://en.wikipedia.org/wiki/Armello).

**Northgard (Shiro Games)**
- A reviewer calls it "somewhat cartoonish but clean, essential, easy to read" — [AnimeClick](https://www.animeclick.it/news/62935-northgard-impressioni-sulla-versione-ad-accesso-anticipato). An official 176-page artbook exists — [Omake Books](https://omakebooks.com/en/livres-omake/439-c-est-presque-pareil--9782379890192.html). No art-direction interview was found.

**Hades (Supergiant)**
- Jen Zee was art director and won the 2021 BAFTA for Artistic Achievement — [Wikipedia](https://en.wikipedia.org/wiki/Jen_Zee). The art team was Zee, Joanne Tran (environments) and Paige Carter (3D) — [Kotaku](https://kotaku.com/the-art-of-hades-1845443438). I found **no sourced breakdown of the UI framing**.

### Inferences
- **Grouping by governing metaphor** (my synthesis):
  - **Book or document as the world**: Inkulinati, Pentiment, Tunic, Okami's scroll, Heaven's Vault. Fog and the unknown can be *blank page*, night can be *candlelit page*, voice can be *lettering*.
  - **Toy or diorama**: Bad North, Townscaper, Tiny Glade, Dorfromantik, Islanders, Thronefall, Kingdoms and Castles. These read through soft palette and island framing, the unknown is usually just the edge of the island or sea, and voice is mostly absent.
  - **Ink or comic line**: Darkest Dungeon, Sable, Banners of Ruin, Obra Dinn. These read through line weight and value contrast. Night and the unknown are handled by value (darkness, hatching) and distance fog.
  - **Tabletop**: Armello, Wildermyth, Card Shark, Slay the Spire, Wildfrost, Loop Hero. These read through cards, tokens and panels. The unknown is face-down cards or unrevealed tiles, voice is comic panels and card text.
- From Pentiment, **typography that encodes the speaker** is the strongest cheap "voice" device for a game without voice acting. It maps directly onto hero barks: e.g. a blackletter-ish hand for the knight, a rough scrawl for the rogue, a refined chancery hand for the wizard.
- From Sable, **fog colour plus distance does double duty as day/night**: tint the fog and ambient instead of relighting everything. That suits pre-baked sprites, whose lighting is frozen.
- From Darkest Dungeon, a **yellowed base and "black only in the ink"** keeps a dark theme warm and legible. The project already has warm brown ink, which is the same idea.
- From Obra Dinn, outlines are a *legibility* tool, and dithering/1-bit is risky in motion and at phone pixel densities.
- **(general knowledge, unverified, for the report writer to check):**
  - Dorfromantik: pastel hex tiles, unexplored space shown as an empty void around the tile cluster.
  - Islanders: flat pastel low-poly island, almost no UI chrome.
  - Spiritfarer: hand-drawn 2D with a soft palette and expressive speech bubbles.
  - Slay the Spire and Wildfrost: card frames as the main UI, with intent icons over enemies.
  - Card Shark: painted 18th-century tableaux, gameplay at a card table.
  - Banners of Ruin: inked, desaturated animal knights.
  - Diplomacy is Not an Option: stylised low-poly mass battles with comedic writing.
  - The Last Spell: pixel art with day-build / night-defence phases.
  - Manor Lords: realistic medieval, the contrast case.
  - Cartographers: a pen-and-paper roll-and-write where players draw on a blank map sheet.
  - Mapmaker: a digital tabletop of map tiles.
  - Ruinarch / Godus: god-game presentations with sculptable or painted terrain.

### Gaps
- No primary source found for: Dorfromantik, Islanders, Kingdoms and Castles, Ruinarch, Godus, Diplomacy is Not an Option, The Last Spell, Spiritfarer, Card Shark, Wildfrost, Slay the Spire, Banners of Ruin, Manor Lords, Mapmaker, Cartographers. My search budget was spent elsewhere. The Dorfromantik search returned only unrelated hexagon pages.
- How Hades frames its UI, and how Northgard draws its map and fog: no developer source found.
- Tiny Glade's rendering: only a forum quote of press coverage. Sable's exact outline method: not published (the GDC talk is the best lead). Bad North's palette and the "low poly" label: not confirmed in a primary source.
- How each listed game shows fog/unknown and day/night was **not sourced** for most titles. Only Sable (fog as the framework for day/night) and Cult of the Lamb (safe base vs creepy forest) have sourced statements.

---

## Q2. Which ideas fit a Majesty-like where the player rules through gold and flags, not direct control?

### Takeaway
Indirect control suits presentations where the player is a **ruler at a table, not a commander in the field**. Candidates: the map as a drawn chart that is filled in as heroes explore (Cartographers, Tunic's manual pages); heroes as figurines or tokens (Armello, Wildermyth cut-outs); bounties as sealed notices; a chronicle that writes itself (Pentiment's lettering, Inkulinati's page). Every one of these makes the player's distance from the action part of the fiction, which is exactly Majesty's core idea.

### Cited Findings
- Inkulinati's consultant checks that **mechanics fit the meaning** of the manuscript imagery. The metaphor constrains design as well as visuals, which is why it feels coherent — [TheSixthAxis](https://www.thesixthaxis.com/2019/10/31/playing-with-history-illuminating-the-insane-game-world-of-inkulinati/).
- Pentiment fonts encode **social standing and education**, and change as perception changes — [Lettermatic](https://lettermatic.com/custom/pentiment); [Inverse](https://www.inverse.com/gaming/pentiment-game-art-interview). For Realm, a hero's lettering could reflect class or level, or upgrade as their legend grows.
- Tunic's manual is an **artefact found piece by piece, whose meaning arrives later** — [GameSpot](https://gamespot.com/articles/how-tunics-cool-in-game-manual-was-made/1100-6507719/). This parallels a royal chronicle or atlas that fills in as heroes explore.
- Wildermyth delivers its story in **comic panels** with paper cut-out characters — [Goodreads interview](https://www.goodreads.com/author_blog_posts/19162356-game-dev-interview-wildermyth). That is a format for hero moments: level-ups, deaths, lair kills.
- Loop Hero's core is a hero who autonomously keeps returning to what the player places, e.g. a bandit camp — [Windows Central](https://www.windowscentral.com/loop-hero-interview). That is the same indirect-control loop as Majesty and a precedent for the player *placing intentions* (cards) instead of giving orders.
- Cult of the Lamb's **safe base vs creepy wilds** split — [ACMI](https://www.acmi.net.au/stories-and-ideas/cult-of-the-lamb-massive-monster-take-dungeon-crawling-and-base-building-to-new-levels/) — maps onto Realm's settled town vs outlaw camps in the fog.

### Inferences
- **The map as the ruler's table or chart.** The player looks down at a cartographer's chart of the realm: the town and its roads are inked and coloured, and the unexplored land is blank vellum with only the ruler's guesses on it ("here be outlaws", hatched hills, a compass rose). This is distinct from all eight named competitors. As far as I know (general knowledge), Majesty, Kingdom Rush, Thronefall, Stronghold, Against the Storm and Dungeon Keeper all present a lit diorama or 2D world, not a map-artefact. Majesty's minimap is the closest thing.
- **Heroes as figurines or tokens.** Since the player never controls them, it fits for heroes to look *placed but autonomous*: painted tin or wooden figurines on a round base. The round base also gives a strong tap target and a ring for class colour and health on phones.
- **Bounties as sealed notices.** A bounty flag becomes a parchment notice pinned into the map with a red wax seal stamped with the gold value. Raising the bounty adds coins under the pin, and a hero taking it ties their coloured ribbon to it. This makes "rule through gold" tangible.
- **Chronicle written as it happens.** The existing "Battle Chronicle" scroll becomes the Realm's chronicle, written by an animated quill in the hero's lettering ("Sir Aldric slew the outlaw chief at Crow's Ford"). Barks can be small banderoles (speech scrolls, a medieval device; general knowledge) above heroes, later copied into the chronicle.
- **Fog as unwritten vellum.** Replace the current grey cloud (`realmLayer.js`) with paper colour. Explored land is "inked in" (a reveal edge with an ink-bleed noise border), and old, unrefreshed knowledge fades to a sepia wash.
- **Day/night as table light.** Day is clean parchment light. Night is a candle or lantern pool near the town with deep blue-brown at the edges, using the Sable "fog/grade carries the cycle" idea.

### Gaps
- No sourced evidence on whether players read a map-artefact presentation as *less* exciting during combat. Readability during busy fights is a risk to test.
- No sourced information on how Majesty itself presents bounties visually. The comparison above is from general knowledge.

---

## Q3. Technical feasibility in Three.js on phones with pre-baked sprites

### Takeaway
Because the sprites are pre-baked and already inked, **most of the look is free at runtime**. The cheap levers are CSS-level grading, one small full-screen paper-grain overlay, a fog/paper shader on the ground plane using the existing chunk mask, and DOM/CSS UI. A real-time Moebius/Sobel edge pass is expensive on phones and redundant here. 1-bit or dither is the riskiest route.

### Cited Findings
- A WebGL Moebius-style post-process needs **two extra full-scene renders** (depth target and normal override) plus a Sobel pass of about 18 texture samples per pixel. Hand-drawn wobble comes from sin/cos offsets of the sampling coordinates, and crosshatching from luminance thresholds with `mod` stripes. Full-scene override materials miss vertex-displaced geometry — [Maxime Heckel](https://blog.maximeheckel.com/posts/moebius-style-post-processing).
- A Godot Sable-like shader is "pretty much just posterization… two layers and a texel line in between" with Sobel outlines — [80.lv](https://80.lv/articles/have-a-look-at-this-bright-godot-shader-inspired-by-sable/) (via search summary).
- Sable: distance fog carries the day/night cycle; line fade-out hides pop-in — [Game Developer](https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability).
- Obra Dinn: dithering shimmers under camera motion unless stabilised, and large pixels on big screens break the blend, so keep dithering minimal — [PlayStation Blog](https://blog.playstation.com/archive/2019/10/17/lucas-pope-on-return-of-the-obra-dinns-art-style); [Alan Zucconi](https://www.alanzucconi.com/?p=10365).
- Fog of war on web and mobile: a **map-sized render target was a large slowdown** on phones. Recommended instead: a small fixed lookup texture, one overlay shader, linear filtering without mipmaps, updates only on meaningful change, and no per-frame allocations — [html5gamedevs](https://html5gamedevs.com/topic/38537-fog-of-war-performance); [fog-of-war skill guide](https://tessl.io/registry/skills/github/MengTo/Skills/implement-fog-of-war) (community sources, no benchmarks).
- Songs of Conquest keeps sprites flat and adds 3D lighting, particle fog and bloom around them to avoid animated-3D cost — [Foro3D](https://foro3d.com/en/2026/mayo/songs-of-conquest-el-pixel-art-25d-que-moderniza-los-90-en-unity.html) (secondary).
- Okami's paper-grain overlay is a texture over the frame — [chromagi](https://chromagi.com/?p=59077) (fan or database source).
- Repo facts:
  - Ink lines, bands and hatching are applied at bake time, at zero runtime cost — `/home/user/test-game/src/render/inkStyle.js`.
  - The colour grade is a CSS `filter` on the canvas — `/home/user/test-game/src/render/Renderer.js`.
  - Realm fog is a noise shader on a plane over a chunk-resolution `DataTexture` with linear filtering — `/home/user/test-game/src/render/realmLayer.js`.
  - Render scale adapts between 0.5× and 1.5× — `/home/user/test-game/src/render/dynamicResolution.js`.
  - Changing `SPRITE_SOURCES` (including the ink style) requires `npm run bake`, about 8 minutes from an empty cache — `/home/user/test-game/CLAUDE.md`.

### Inferences (cost estimates are mine, not measured)

| Technique | Runtime cost on phones | Fit with pre-baked sprites | Notes |
|---|---|---|---|
| Ink outlines / hatching / posterisation | **Zero** (already baked) | Native | Restyle by changing `INK_STYLE` (heavier lines, sepia ink, more hatching) and rebaking (~8 min). A runtime Sobel pass would double-line the sprites and cost 2 extra scene renders. Avoid it. |
| Paper-grain / vellum overlay | Very low | Good | One tiling grain texture as a fixed full-screen quad (multiply or overlay blend) or a CSS `background-blend-mode` layer over the canvas. Keep it fixed to the screen (as in Okami's filter) or to the world (paper "under" the map), but not both. World-anchored grain reads as "map on a table". |
| Fog as parchment / vellum | Low (already a shader over a chunk mask) | Good | Swap the grey cloud colours for paper tone. Add an ink-bleed reveal edge (noise-thresholded border, darker rim), optional faint sketch decals (dashed roads, "?" hills) drawn into unexplored chunks, and a sepia "stale" state. Update the mask on reveal only. |
| Day/night grade | Very low | Good | Baked sprites have frozen lighting, so night must be a **grade plus local light**: (1) a CSS filter or a full-screen multiply quad going from warm to cool-dark; (2) additive light sprites (lantern pools, torches, campfires) on top, or a low-res light-map render target (e.g. ¼-res) multiplied over the scene. Sable shows fog/grade alone can carry the cycle. The existing CSS-filter grade path supports (1) almost for free; CSS filters on a WebGL canvas may cost compositing time on some mobile browsers (unmeasured). |
| Hatching that grows at night | Low–medium | Medium | Screen-space hatch texture masked by night amount or by distance from light. Risks swimming under camera pan unless world-anchored (the Obra Dinn lesson). |
| 1-bit / dither | Medium, high risk | Poor | Dither shimmer and phone DPI issues. Would need a re-bake to a 1-bit ink style plus stabilised dithering. Not recommended. |
| Pixel-art / HD-pixel (Songs of Conquest) | Low | Poor | Would mean re-authoring all models and textures for a pixel look. Doesn't use the ink pipeline. |
| DOM/CSS UI (parchment, wax seals, banderoles, comic panels, custom fonts) | Low (DOM) | Independent of renderer | `border-image` for frames, SVG filters for torn edges, web fonts for character lettering (font files cost load size; subset them). Keep animations transform/opacity-only for phones. |
| Pop-up / papercraft reveals | Low | Good | Sprites can scale-Y or "fold up" from the ground on build or reveal; cut-out heroes on stands are just a sprite with a base decal. |

### Gaps
- No device benchmarks found for: a full-screen overlay quad vs a CSS filter vs a CSS blend layer on mid-range Android WebGL; or Three.js post-processing (EffectComposer) cost on phones. Profile against the existing frame-cap and draw-call budget e2e tests.
- No sourced data on how legible small calligraphic fonts are on phones. Pentiment's accessibility complaint suggests offering a plain-font toggle.

---

## Q4. Candidate identity concepts for Realm (4–6), each with a pitch, key devices, UI motif, heroes/bounties/fog/barks, risks and rough effort

### Takeaway
The best balance of distinctiveness and cost is **"The Ruler's Chart"** (map-as-artefact on a war table), with the chronicle and barks borrowed from **"Illuminated Chronicle"**. Both reuse the existing parchment-and-iron UI and the baked ink sprites, and they turn Realm's systems (fog, bounties, heroes) into diegetic objects. Darker or stronger-contrast options (Woodcut, Lantern & Shadow) are more striking but cost re-bakes and readability work.

### Cited Findings
(The concepts are syntheses. Their supporting facts are cited in Q1–Q3. The key precedents are below.)
- Map or page as world: Inkulinati — [TheSixthAxis](https://www.thesixthaxis.com/2019/10/31/playing-with-history-illuminating-the-insane-game-world-of-inkulinati/); Pentiment — [Game Developer](https://www.gamedeveloper.com/art/deep-dive-the-art-of-pentiment); Tunic — [GameSpot](https://gamespot.com/articles/how-tunics-cool-in-game-manual-was-made/1100-6507719/).
- Character lettering as voice — [Lettermatic](https://lettermatic.com/custom/pentiment).
- Papercraft and comic panels — [Wildermyth itch.io](https://wildermyth.itch.io/wildermyth); [Goodreads interview](https://www.goodreads.com/author_blog_posts/19162356-game-dev-interview-wildermyth).
- Fog carries the day/night cycle — [Game Developer on Sable](https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability).
- Yellowed palette with black only in the ink — [GameSpot on Darkest Dungeon](https://www.gamespot.com:443/articles/the-gothic-sensibilities-of-darkest-dungeon/1100-6424880/).
- Cute vs dark, safe base vs creepy wilds — [DreadXP](https://www.dreadxp.com/?p=27832); [ACMI](https://www.acmi.net.au/stories-and-ideas/cult-of-the-lamb-massive-monster-take-dungeon-crawling-and-base-building-to-new-levels/).
- Woodcut flattening; characters not scaled for depth — [Game Developer on Pentiment](https://www.gamedeveloper.com/art/deep-dive-the-art-of-pentiment).

### Inferences

**Concept A: "The Ruler's Chart" (map as artefact on a war table)** (recommended core)
- *Pitch:* You never walk your realm; you rule it from a candlelit table. The battlefield is a living chart on vellum: what your heroes have seen is inked and watercoloured, and the rest is blank parchment with the cartographer's guesses. Heroes are painted figurines that move on their own, bounties are notices you pin to the chart with gold, and the day passes as the light on the table changes.
- *Visual devices:*
  - World-anchored vellum grain under the painted ground, at low opacity, with stained edges.
  - A compass rose and a scale bar in a corner.
  - Dashed ink roads into the unknown.
  - Map-style labels in the fog ("Crow's Ford", "Outlaws?").
  - The existing ink sprites unchanged, plus a slightly stronger ground grid (see the phone reference).
- *UI motif:* the current parchment-and-iron HUD, recast as items on the table: a gold purse (gold), a wax-seal stamp tool (bounty), a sealed letters tray (events). The chronicle is a ledger.
- *Heroes:* a sprite with a round painted base (class colour ring, health as a base ring). Selected heroes get a brass pin label with their name.
- *Bounties:* a parchment notice with a red wax seal stamped with the reward, pinned by a dressmaker's pin. Coins stack under it as the reward grows, and a taking hero ties a ribbon of their colour to it.
- *Fog:* blank vellum (replacing the grey cloud colours in `realmLayer.js`), revealed with an ink-bleed edge. Previously seen but unwatched land fades to sepia line-only. Outlaw camps in fog show as a hand-drawn "?" skull mark once rumoured.
- *Barks:* small speech banderoles (curling scroll ribbons) above heroes, then copied into the chronicle.
- *Day/night:* warm parchment by day. At night, a cool multiply grade with a vignette, plus warm additive pools around the town hall, torches and camps (low-res light map).
- *Risks:*
  - Close to the existing look, so it may read as "the TD game with fog" unless the table framing (edges, pins, figurine bases) is committed to.
  - Busy fights over vellum could lose contrast.
- *Effort:* **Low–medium.**
  - Fog recolour and reveal edge: ~1–2 days.
  - Paper overlay: <1 day.
  - Figurine bases: bake or decal, ~1–2 days.
  - Bounty notices: sprite or DOM, ~2 days.
  - Night grade and light pools: ~3–5 days.
  - Table-edge framing: CSS, ~1–2 days.

**Concept B: "Illuminated Chronicle" (the realm as a manuscript being written)**
- *Pitch:* Realm is a book of hours being illuminated as you play. The battlefield sits inside a decorated page border whose marginalia (a snail knight, a rabbit archer) react to events. Each hero has their own hand: barks and deeds are written in the margin by an unseen scribe, and a hero who dies has their entry rubricated in red.
- *Visual devices:*
  - An illuminated border frame (DOM/CSS) around the canvas on desktop; on phones, a thin top and bottom border only.
  - Drop-cap initials for chronicle entries.
  - Gold-leaf accents (CSS gradients) on currency and bounties.
  - Rubrication (red) for deaths and outlaw raids.
- *UI motif:* manuscript page, ruled lines, catchwords, blackletter headings.
- *Heroes:* the battlefield sprites stay the same. Their portraits become **historiated initials** (portrait inside a letter).
- *Bounties:* manicules (pointing-hand marks, a real manuscript device; general knowledge) and marginal notes pointing at the map spot.
- *Fog:* unwritten vellum with faint ruling lines.
- *Barks:* each hero class gets a typeface keyed to class and status, following Pentiment. A level-up "promotes" a hero's hand.
- *Day/night:* the page is lit by a candle at night (vignette, warm flicker).
- *Risks:*
  - Legibility of period hands on phones, with an accessibility toggle needed.
  - Font load size.
  - The frame eats phone screen space.
  - Closest to Inkulinati and Pentiment, which are well known, so the visual claim is less unique among indies but unique in the Majesty-like niche.
- *Effort:* **Medium.**
  - Fonts plus licensing or subsetting: ~2–3 days.
  - Border, initials and marginalia: illustration-heavy, the main cost. Marginalia could be baked from the existing models in the ink style.
  - Chronicle writing animation: ~2 days.

**Concept C: "Woodcut Realm" (hand-coloured block print)**
- *Pitch:* The kingdom as a hand-coloured 16th-century woodcut. Heavy black-brown lines, strong hatching, flat washes of 4–5 inks on cream paper. It looks like a page torn from a chronicle, and the night is carved out of the block.
- *Visual devices:*
  - Re-bake with `INK_STYLE` pushed further: thicker outline, higher `hatch`, `bands: 3`, desaturated washes.
  - Paper grain showing through the colours (Pentiment).
  - Pentiment-style constant figure scale.
- *UI motif:* broadsheet: framed woodcut panels, printer's ornaments, a pamphlet-style bounty sheet ("WANTED: the outlaw of Crow's Ford, 50 crowns").
- *Heroes:* woodcut figures with a single flat colour wash per class.
- *Bounties:* printed broadside notices pasted on posts.
- *Fog:* uncut block (dark hatched void) or blank paper.
- *Barks:* printed speech ribbons (common in woodcuts; general knowledge).
- *Day/night:* night is extra hatching density plus a blue-black ink wash. World-anchored hatching avoids shimmer.
- *Risks:*
  - A full re-bake and art retune that departs from the current warm storybook reference.
  - Heavy lines at small phone scale can clog unit readability (the Obra Dinn lesson about density).
  - It may look too much like Darkest Dungeon's ink.
- *Effort:* **Medium–high.**
  - Ink-style retune and full rebake (~8 min per bake, but many iteration rounds).
  - Revalidating sprite atlases and tests.
  - Night hatching shader: ~3 days.

**Concept D: "Lantern & Shadow" (cute day, dangerous night)**
- *Pitch:* By day the realm is a bright, cosy storybook; by night the edges go ink-black and only the town's lanterns and the heroes' torches push the dark back. Outlaws are silhouettes with glinting eyes at the edge of the light. Cult of the Lamb's cute/dark contrast and Thronefall's day/night rhythm, made into the realm's identity.
- *Visual devices:*
  - A strong day/night grade, with light pools as the main readable shapes at night.
  - Fog that becomes darkness at night.
  - Embers and fireflies (existing particles).
- *UI motif:* the existing parchment by day, a lantern-lit iron frame at night (HUD swaps skin).
- *Heroes:* carry a small light radius at night, so their position is always readable.
- *Bounties:* lit beacon flags.
- *Fog:* charcoal ink wash, with lit areas revealed.
- *Barks:* short and emotive. Nervous barks at night ("Too dark…"), boasts by day.
- *Risks:*
  - Night readability on phones outdoors (screen glare).
  - Thronefall already owns the day/build, night/fight rhythm.
  - Lighting cost: a low-res light map plus additive sprites is fine, but many dynamic lights on low-end Android need capping.
- *Effort:* **Medium.**
  - Light-map render target and grade: ~4–6 days.
  - HUD night skin: ~2 days.

**Concept E: "Pop-up Realm" (papercraft storybook)**
- *Pitch:* The realm is a pop-up book. Buildings fold up out of the page when placed, heroes are painted card cut-outs on little stands, and explored land unfolds from flat blank paper. Hero milestones are told in short comic strips (Wildermyth).
- *Visual devices:*
  - Fold-up build animation (scale-Y and skew of the sprite from its base).
  - A paper-edge drop shadow on sprites (a cheap offset shadow).
  - Fog as folded blank paper flaps that "open".
- *UI motif:* cardstock tabs, paper fasteners, scissors-cut panels.
- *Heroes:* cut-out sprites on wooden stands (base decal). A hero's death plays a 2–3 panel comic in the chronicle.
- *Bounties:* paper flags on toothpicks.
- *Fog:* closed flaps of plain paper.
- *Barks:* comic speech balloons.
- *Day/night:* a lamp behind the page shines through (backlit paper glow at night).
- *Risks:*
  - Cut-out figures conflict somewhat with the current 3D-baked figure shading.
  - Comic panels need bespoke illustration per event type. Procedural composition from baked sprites is possible but the hardest part.
- *Effort:* **Medium–high**, driven by panel content.

**Concept F: "The Realm Tapestry" (embroidered chronicle)** (speculative)
- *Pitch:* The chronicle is a growing embroidered tapestry along the bottom of the screen, a Bayeux-like strip (the Bayeux Tapestry is a long embroidered medieval narrative cloth; general knowledge) on which each hero deed appears as a stitched vignette. The battlefield stays the painted map.
- *Visual devices:* stitch-texture strip (CSS/SVG), woollen palette (madder red, woad blue, weld yellow), Latin-style captions.
- *Heroes:* stitched icons in the strip.
- *Bounties:* stitched banners.
- *Fog:* unstitched linen.
- *Barks:* captions above stitched figures.
- *Risks:* a phone-width strip is tiny, so it works best as an end-of-day recap screen. I found no game precedent to validate it.
- *Effort:* **Medium** as a recap screen, high as live UI.

**Recommendation (my inference):**
- Build **A, the Ruler's Chart**, as the identity. It is cheapest, makes Realm's systems diegetic, and is distinct from all eight named competitors (to my knowledge).
- Layer in **B's lettering-as-voice** (a per-class hero hand in banderoles and the chronicle) and **D's night light pools** for drama.
- Keep C and E as stretch ideas.
- First steps, in order:
  1. Recolour the fog to vellum and add the ink-bleed reveal edge in `realmLayer.js`.
  2. Add a world-anchored paper grain.
  3. Add bounty wax-seal notices.
  4. Add hero figurine bases.
  5. Add the night grade using the existing CSS-filter path.

### Gaps
- The effort estimates are my judgement from the repo structure, not measured.
- No player-testing data on whether map-artefact or manuscript presentations hurt combat readability on phones.
- No legal check of font licensing for period-hand typefaces (Pentiment's are custom by Lettermatic and not available for reuse).
- Whether any existing game already uses a "living cartographer's chart" as its main playfield was not researched. Cartographers and Mapmaker are the leads to check.
