# Hold the Hall: audit of our rendering pipeline, and options for crisper graphics

Scope: measured facts about the current pipeline (file:line references are to /home/user/test-game, three.js 0.186.1 per `node_modules/three/package.json`), plus options for raising visual resolution within phone budgets, checked against outside sources. Repo facts come from the code and the files in `public/`. Numbers marked "computed" come from scripts that read `public/sprites*/atlas.json` and the code constants.

Conventions used below:
- **ppu** means pixels per world unit in the camera's view plane. Sprites are baked at a fixed ppu.
- A ground tile is 1×1 world unit. On screen its diamond is about 1.41 units wide and 0.87 units tall (iso azimuth 45°, elevation 38°, `src/render/iso.js:7-10`).
- **Screen ppu** is how many canvas pixels one view-plane unit covers. It equals `short side in CSS px × pixel ratio / 30 × zoom`. The camera shows at least 30 units on the short axis: `VIEW_HEIGHT = VIEW_WIDTH = 30` and `viewH = max(30, 30/aspect)` (`src/render/Renderer.js:85-86, 705`).

## Q1. Current numbers: atlases, download, GPU memory, sprite px vs screen px, ground resolution, UI text

### Takeaway
Both sets hold the same 3147 frames.
- **Standard set:** 13 pages of 2048², 6.8 MB to download. Decoded it is about 204 MiB of RGBA8, or about 272 MiB with mipmaps.
- **HD set:** 36 pages, 11.1 MB to download. Decoded it is about 563 MiB, or about 751 MiB with mips.

The game starts on High, which renders at full device pixel ratio. At that setting a Pixel 7 shows 36 device px per unit at zoom 1 and 130 at max zoom (3.6). So standard sprites (72 ppu) are magnified from zoom 2.0 up, and soldiers (56 ppu) from zoom 1.55 up. The painted ground (32 px per tile) is already about 1:1 at zoom 1 and is magnified up to 4× at max zoom. All UI text is DOM, so it is always crisp.

### Cited Findings

**Sprite sets and bake resolution**
- There are two sets: `standard` at `pxPerUnit: 72, supersample: 2`, and `hd` at `pxPerUnit: 144, supersample: 1.5` (`src/render/spriteCatalog.js:81, 89-92`).
- Soldiers and engines bake at `ENEMY_PX_PER_UNIT = 56` in both sets (`spriteCatalog.js:94, 237, 264`). Elite or hero frames bake at 56/1.3 ≈ 43 ppu (`spriteCatalog.js:237`), and catapult arm frames at 60 (`spriteCatalog.js:151`).
- Measured ppu per frame group (computed from atlas.json):
  - Standard: s, wall, b, arm, icon at 72.0–72.9. Animals 56–58. Units 43.1–57.2 (median 56.1).
  - HD: the same groups at 144–145.7. Units unchanged at 43–57.
- Atlas pages are 2048 px, with 3 px padding and shelf packing grouped by kind (`src/render/atlasPacking.js:11-18, 26-27`). The last page is trimmed in height (`atlasPacking.js:82`).

**Page counts, fill, download size (computed from `public/sprites*/atlas.json` and file sizes)**

| | Standard | HD |
|---|---|---|
| Frames | 3147 | 3147 |
| Pages | 13 (12 × 2048², last 2048×1532) | 36 (35 × 2048², last 2048×420) |
| Page texels | 53.5 M | 147.7 M |
| WebP pages | 5.86 MB | 10.18 MB |
| atlas.json | 0.93 MB | 0.93 MB |
| Total download | 6.8 MB | 11.1 MB |
| WebP bits per texel | ≈0.88 | ≈0.55 |
| Average page fill | about 0.85 | about 0.80 (some building pages only 0.55) |

- HD building sprites (`b`) are big: 4–9 frames per page across 10 pages (HD pages 15–24). Walls span 11 HD pages versus 3 in standard.

**Where the texels go (computed)**
- Standard: units ("e:") are 44% of used texels, walls 17%, buildings 15%, wall arms 7%, UI icons 5%.
- HD: walls 26%, buildings 23%, units 17%, arms 10%, icons 8%.
- Baked ground shadows are stored at half resolution (`src/render/spriteBaker.js:247-255`). They are only 9.2% (standard) and 14.4% (HD) of texels.
- Split by mode in standard: the player's red troops are 21% of texels, blue (Conquest) buildings 6%, blue heroes 3%, neutral bandits 2%.

**GPU memory (computed)**
- Pages are uploaded as uncompressed RGBA8 `THREE.Texture`s with three.js defaults (`src/render/spriteAssets.js:58-61`). The defaults are `minFilter = LinearMipmapLinearFilter` and `generateMipmaps = true` (`node_modules/three/src/textures/Texture.js:48, 257`), so mips are generated on the GPU.
- RGBA8 is 4 bytes per texel:
  - Standard: 53.5 M texels ≈ 204 MiB, or ≈272 MiB with mips (×4/3).
  - HD: 147.7 M texels ≈ 563 MiB, or ≈751 MiB with mips.

**Every page is uploaded, including pages the battlefield never draws**
- `SpriteLayer` builds a material and an InstancedMesh for every atlas page. It does this twice, once for the object layer and once for the shadow layer (`src/render/spriteLayer.js:92`, `Renderer.js:157-158`).
- In three.js, `renderBufferDirect` calls `setProgram(...)` before any draw (`node_modules/three/src/renderers/WebGLRenderer.js:1202`). That call binds the textures and so uploads them. Only the draw itself is skipped when there are zero instances (`webgl/WebGLBufferRenderer.js:19-23`: `if ( primcount === 0 ) return;`).
- So the UI-icon pages are uploaded on the first frame even though the battlefield never shows them. That is standard page 12 (≈12 MiB, 16 MiB with mips) and HD pages 32–35 (≈51 MiB, 68 MiB with mips).

**Loading and sprite-set choice**
- Pages are decoded one at a time to avoid running out of memory during decode (`spriteAssets.js:39-66`).
- The decoded `Image` stays referenced as `page.source` (`spriteAssets.js:62`). It is reused for UI icons through `frameToDataURL` (`spriteBaker.js:311-319`, `src/ui/HUD.js:126`).
- Set choice: `?sprites=` wins, then the Sprite detail setting, else `pointer: coarse` gives standard and anything else gives HD (`spriteAssets.js:10-16`). Changing it needs a reload (`src/render/graphicsSettings.js:201`).

**Render scale**
- Presets:
  - Low and Medium: `resolution: 'auto'`, `antialias: false`.
  - High: `resolution: 'native'`, `antialias: true` (`graphicsSettings.js:70-74`).
- Every launch starts on High (`STARTUP_PRESET = 'high'`, `graphicsSettings.js:237-238`). A WebGL context loss steps down one preset (`src/game/Game.js:34-43`).
- `'native'` sets pixel ratio = `devicePixelRatio`. Any number is capped at the DPR (`Renderer.js:689-693`).
- `'auto'` starts at 0.75 on touch screens and 1 on desktops, ranging 0.5 to min(2, DPR) (`graphicsSettings.js:189`, `Game.js:137-141`, `Renderer.js:1511-1514`). It is driven by `DynamicResolution`: ±0.1 steps once a second, with a ceiling after a failed step up (`src/render/dynamicResolution.js:3-8, 18-41`).

**Zoom range**
- Max zoom is `ZOOM.in = 3.6`. Zoom-out factors are normal 1, far 0.7 (the default), farthest 0.5 (`graphicsSettings.js:169, 204`).
- The normal limit is `0.55 × (40+28)/(mapWidth+28)` (`Renderer.js:731`, `PAINT_BORDER = 14` in `src/render/terrainPainter.js:21`). On the default Medium (52-tile) map that is 0.4675, so the default "far" minimum is 0.327.
- The camera starts at zoom 1, the OrthographicCamera default. Nothing sets it in Renderer or Game.

**Screen px per unit vs sprite px (computed from the formula in Conventions)**
- Base screen ppu at zoom 1:
  - Pixel 7 (Playwright descriptor: 412×839 CSS, DPR 2.625): 36.05 at native, 10.3 at the 'auto' start of 0.75, 27.5 at the 'auto' max of 2.
  - iPhone at 393 CSS px and DPR 3: 39.3.
  - Desktop 1080p at DPR 1: 36.
  - 1440p: 48.
  - MacBook Air 13" (956 CSS px tall, DPR 2): 63.7.
- Pixel 7 at native (High), Medium map. Values are screen px per sprite px; above 1 means magnified (blurry), below 1 means minified:

| zoom | screen ppu | standard 72 | units 56 | elite 43 | HD 144 | ground (horiz 32 / vert 52 texels per unit) |
|---|---|---|---|---|---|---|
| 0.327 (far min) | 11.8 | 0.16 | 0.21 | 0.27 | 0.08 | 0.37 / 0.23 |
| 1 (start) | 36 | 0.50 | 0.64 | 0.84 | 0.25 | 1.13 / 0.69 |
| 2 | 72 | 1.00 | 1.29 | 1.68 | 0.50 | 2.25 / 1.39 |
| 3.6 (max) | 130 | **1.80** | **2.32** | **3.0** | 0.90 | **4.06 / 2.50** |

- Zoom at which magnification starts:
  - Pixel 7 native: standard 2.0, units 1.55, elites 1.19, ground 0.89.
  - iPhone at DPR 3: 1.83, 1.42 and 1.09.
  - 1080p desktop with HD: HD sprites are never magnified (they reach 0.9 at 3.6), but units are from zoom 1.56.
  - MacBook at DPR 2 with HD: HD magnified from zoom 2.26, reaching 1.59× at max. Units are already magnified at zoom 0.88, reaching 4.1× at max (elites 5.3×).
- The docs say "a phone shows fewer pixels per tile than the standard set has, even zoomed in" (`docs/ARCHITECTURE.md:92-93`, `spriteCatalog.js:84-85`). That holds only when the pixel ratio is at most about 1.46: max zoom gives 49.4 × ratio screen ppu, against 72. At High/native it is false on every current phone.
- Other docs are out of date:
  - `docs/ROADMAP.md:79` still says 1.5 MB (standard) and 2.5 MB (HD). Today it is 5.9 and 10.2 MB.
  - `ARCHITECTURE.md` ("~680 sprites fit in about 2.5 pages") is out of date too.

**Painted ground**
- `GROUND_PX = { off: 12, low: 16, medium: 24, high: 32 }` px per tile (`graphicsSettings.js:197`).
- The canvas is `(mapTiles + 2×14) × pxPerTile` square (`terrainPainter.js:21, 325-326`):
  - Medium at High: 80 × 32 = 2560² ≈ 25 MiB RGBA, 33 MiB with mips.
  - Large: 2944², ≈44 MiB with mips.
  - It is a `CanvasTexture` with anisotropy 4 (`Renderer.js:309-311`).
- How the 32 px/tile land on screen: screen-right runs along a tile diagonal, so 1 view unit holds 32 texels horizontally. Screen-up covers 1/sin 38° = 1.62 ground units, so it holds 52 texels vertically.
- Close up, `groundDetail.js` multiplies in a 256² tiling grass-stroke texture repeating every 2 tiles (128 px/tile, anisotropy 8). It fades in between zoom 1.3 and 2.4 to strength 0.55 (`src/render/groundDetail.js:11-13, 20, 62, 97-101`).
- Realm's parchment fog is a 1024² power-of-two texture repeating every 14 tiles, about 73 px/tile (`src/render/parchment.js:10-13`, `src/render/realmLayer.js` `PAPER_TILES = 14`).

**Text and UI**
- HUD, menus, settings and Realm barks are DOM (`src/ui/*.js`), so they render at device DPR whatever the WebGL render scale.
- The minimap and map sketch canvases cap DPR at 2 (`src/ui/Minimap.js:65`, `src/ui/mapSketch.js:21`).
- Building and hero portraits are atlas icon frames turned into PNG data URLs (`HUD.js:126, 220-221, 594`, `src/ui/MainMenu.js:23`). They are 72 ppu on phones (standard) and 144 on desktops.

**Ink line width**
- The ink outline is `outline: 3` bake pixels (`src/render/inkStyle.js:17`), and hatching spacing is 6 bake px (`inkStyle.js:25`). Both are in supersampled pixels.
- So lines are 1.5 px at 72 ppu (0.021 units) in standard, but 2 px at 144 ppu (0.014 units) in HD.

### Inferences
- **The two sets do not look identical.** HD ink lines and hatching are about one third thinner in world units than standard ones.
- **The HD set's level-1 mip is almost exactly the standard set** (144 → 72 ppu; the bake supersampling differs slightly). A client holding HD pages holds standard-resolution data redundantly.
- **Units are the blurriest thing on screen when zoomed in.** They are the largest group on phones (44% of standard texels) and the lowest-resolution group (56 ppu, elites 43) in both sets.
- **High on phones renders about 2.4 M pixels a frame** (1081×2202 on a Pixel 7) and still magnifies sprites beyond zoom 2. 'auto' at 0.75 renders about 0.2 M pixels and has the browser compositor stretch the canvas 3.5×. That is a whole-image blur that no atlas resolution can fix.

### Gaps
- No GPU memory has been measured on a device. The figures above are arithmetic from texel counts. Driver padding, the HTMLImageElement decode cache and the browser's own copies (Chrome keeps a CPU-side copy for context restore in some paths) are not included.
- Which sprite subsets each game mode actually draws was not traced. That would show how much a per-mode page subset could save.

## Q2. Where the image loses sharpness today, and where memory/performance is at risk on phones

### Takeaway
Sharpness is lost in six places:
1. Magnified sprites (units from zoom 1.55, standard sprites from zoom 2 on phones at native).
2. The 32 px/tile ground, magnified 2.5–4× at max zoom and only partly hidden by the grass detail.
3. Phones on 'auto' rendering at 0.75 and upscaled by the compositor.
4. Alpha-tested (binary) sprite edges that MSAA does not smooth.
5. Mip and padding artifacts when zoomed out.
6. Possibly a sub-pixel canvas size mismatch at fractional DPRs.

The CSS colour grade changes colour only and does not blur. Memory is the main risk. The standard set alone is about 272 MiB of GPU textures. Choosing HD on a phone means about 751 MiB, well beyond the roughly 256 MB at which older iOS devices are anecdotally reported to lose the WebGL context.

### Cited Findings

**Sprite edges**
- Object sprites use `alphaTest: 0.5` with depth writes (`src/render/spriteLayer.js:111-123`), so every edge is a hard cut at screen resolution.
- Nothing in `src/` sets `alphaToCoverage`. A grep for alphaToCoverage/premultipl* in `src` returns nothing.
- MSAA (High's `antialias: true`, `Renderer.js:123-126`) only smooths triangle edges. A sprite quad's triangle edges lie in transparent texels, so MSAA does nothing for sprite silhouettes. Alpha to coverage is the multisampling technique that turns alpha into a sub-pixel coverage mask, used for dense foliage and grass; with 4× MSAA it gives 5 levels — [Wikipedia: Alpha to coverage](https://en.wikipedia.org/wiki/Alpha_to_coverage); [Ben Golus, "Anti-aliased Alpha Test: The Esoteric Alpha To Coverage"](https://bgolus.medium.com/anti-aliased-alpha-test-the-esoteric-alpha-to-coverage-8b177335ae4f) (I could only read summaries; the page returned 403).
- The bake renders with `antialias: false` (`spriteBaker.js:55`), and the ink pass makes a binary solid mask at alpha ≥ 128 (`inkStyle.js:35`). Soft edge alpha comes only from the 2:1 (standard) or 1.5:1 (HD) canvas downscale (`spriteBaker.js:242-243`). That downscale uses the 2D canvas default smoothing; neither `spriteBaker.js` nor `atlasPacking.js` sets `imageSmoothingQuality`.

**Mips and padding**
- Atlas padding is 3 px with no edge extrusion (`atlasPacking.js:27`).
- The textures are straight (not premultiplied) alpha: `premultiplyAlpha` is left at three's default of false (`spriteAssets.js:58-61`). Mips are generated by the GPU from that straight-alpha data.
- Sources agree that filtering and mipmapping straight or premultiplied-black transparent texels leaks dark colour into edges ("dark halos"). The fixes are edge extrusion of 1 px for bilinear and 2+ px for mipmapped sprites, or filling transparent texels with the border colour — [FastPack: extrude](https://www.mintlify.com/Hexeption/FastPack/packing/extrude); [TexturePacker options, reduce_border_artifacts](https://pytexturepacker.readthedocs.io/en/master/2_options.html); [Khronos forum](https://community.khronos.org/t/texture-filter-and-atlas-image-distortion-problem/76802).
- Alpha-tested foliage also loses alpha density at distance through mipmapping. Scaling alpha per mip fixes that, but can make close-up edges jaggy — [gamedev.net foliage thread](https://www.gamedev.net/forums/topic/540726-foliage-rendering/4492102/?page=1).

**Anisotropic filtering**
- Sprite pages use `anisotropy = 4` (`spriteAssets.js:60`, `atlasPacking.js:103`). The quads always face the camera (`spriteLayer.js:215` uses `ISO_QUATERNION`), so their texel footprint is isotropic.

**Ground**
- At max zoom the ground is magnified 4.06× horizontally and 2.5× vertically on a Pixel 7 at native (computed, Q1).
- The detail overlay only adds a generic grass pattern. It is masked off water and used on flat ground and plateau tops (`groundDetail.js:72-90`), with no per-terrain detail for sand, gravel or forest floor.
- Raising `GROUND_PX` is capped by the maximum texture size:
  - A Medium map at 64 px/tile would need 5120², and Large 5888².
  - On Android, only 75% of WebGL2 reports support 8192 and 3% support 16384; iOS reports 100% at 8192 — [web3dsurvey MAX_TEXTURE_SIZE](https://web3dsurvey.com/webgl2/parameters/MAX_TEXTURE_SIZE).

**Render scale below 1 (the 'auto' setting)**
- On touch devices Low and Medium start at 0.75 and may sit as low as 0.5 (`graphicsSettings.js:189`).
- `setPixelRatio` then gives a backing store smaller than the device pixels, which the browser stretches (`Renderer.js:689-693`).
- There is no sharpening or upscaling pass: there is no EffectComposer/FXAA/SMAA anywhere in `src/` (grep).

**Canvas size**
- three.js sets `canvas.width = Math.floor(width * pixelRatio)` (`node_modules/three/src/renderers/WebGLRenderer.js:683`). On a Pixel 7 at native that is 412 × 2.625 = 1081.5, floored to 1081.
- WebGL Fundamentals says the only exact way to get one canvas pixel per device pixel is `ResizeObserver` with `devicePixelContentBoxSize` ("Only this path gives the correct answer"), which it reports is available in Chrome/Edge only. With fractional DPRs, "which one gets or loses a pixel is undefined by any specs" — [WebGL Fundamentals: resizing the canvas](https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html).

**CSS colour grade**
- On High (`glow`), `COLOUR_GRADE = 'sepia(0.08) saturate(1.04) contrast(1.04)'` is applied as a CSS `filter` on the canvas, plus rain/winter/night filters and a 3 s filter transition (`Renderer.js:49-56, 1083-1095`). These are per-pixel colour operations and do not resample the image.

**Memory: risk thresholds**
- iOS has an undocumented memory limit; crossing it loses the WebGL context or reloads the page — [WebKit bug 229606](https://bugs.webkit.org/show_bug.cgi?id=229606); [Babylon.js forum](https://forum.babylonjs.com/t/gpu-memory-leak-on-ios-when-using-hdr-textures/55069).
- One blog claims about 256 MB of GPU memory on older devices triggers crashes. That figure has no primary source — [abratabia iOS Safari gotchas](https://abratabia.com/mobile-web-games/ios-safari-gotchas.php).
- Context loss on iOS 18 can need a browser kill and restart — [WebKit bug 289601](https://bugs.webkit.org/show_bug.cgi?id=289601).
- The game already handles context loss and steps the preset down (`Game.js:34-47`). But the presets do not change the sprite set or its memory: `sprites` is a separate setting, needing a reload.

**Memory: our totals (computed)**
- Phone on standard, High:
  - Sprites: ≈272 MiB.
  - Ground (Medium): ≈33 MiB.
  - Parchment and detail textures: a few MiB.
  - Framebuffer at 1081×2202: about 19 MB single-sampled colour plus depth, and up to ×4 for 4× MSAA if the browser allocates a real multisample renderbuffer.
- Phone with Sprite detail HD: ≈751 MiB of sprite textures.

**Draw calls**
- Each page costs one draw per layer whenever something on it is visible. HD spreads walls over 11 pages (standard 3) and buildings over 10, so HD frames issue more draw calls.
- The desktop e2e budget is ≤28 calls (`e2e/desktop.spec.js:395-397`).

### Inferences
- **Anisotropic filtering does no useful work on the sprite pages**, because the camera-facing quads have isotropic footprints. On the ground the footprint is 1:1.62, so 2× would be enough.
- **The biggest single memory lever is texture format, not resolution.** Uncompressed RGBA8 with mips costs 5.3 bytes per texel. Any HD-on-phone plan has to change the format or stream pages.
- **The icon pages are pure waste on the GPU** (16 MiB standard, 68 MiB HD with mips): the battlefield never samples them, yet they are uploaded because a SpriteLayer material exists for each page.
- **The 3 px padding fails at mip level 2 and below** (≥4:1 minification). There it becomes under 1 texel. That is about zoom ≤ 0.5 for standard on phones, and zoom ≤ 1 for HD on a 1080p desktop, which includes the start zoom. Expect slight dark fringes or neighbour bleed, and thin parts (spears, flagpoles, branches) dropping out under `alphaTest` 0.5 when zoomed out.
- **The fractional-DPR canvas mismatch is a whole-frame softness risk** on Android phones whose DPR is not an integer (Pixel 7: 2.625). It has not been measured in our game.

### Gaps
- No screenshots or measurements on real devices of fringe, edge shimmer or canvas resampling. These are code-derived predictions.
- Whether Chrome or Safari allocate a full multisample buffer for WebGL `antialias: true` on tile-based GPUs, or resolve on chip, is not documented for browsers. See Q3 for the GPU-vendor statements.
- I found no source measuring the compositor cost of a CSS `filter` on a WebGL canvas.

## Q3. Options to raise resolution and quality within phone budgets: effort, gain, memory/perf, risk

### Takeaway
Cheapest high-value wins:
- Turn on alpha-to-coverage, which three.js supports with one material flag and which pairs with High's existing MSAA.
- Fix the bake's edge colour and padding.
- Stop uploading icon pages.
- Raise the unit sprites' ppu.

The strategic change is compressed textures through KTX2. ASTC/ETC2 are about 99.7–99.9% available on Android and iOS, and BC7 is 99.7% on Windows. They cut sprite GPU memory about 4× (standard ≈68 MiB, HD ≈188 MiB with mips), which would make HD on phones viable. The cost is a much larger download (UASTC about 4–6 bits per texel against our WebP's 0.55–0.88) or lower quality (ETC1S).

A third @3x set or WebGPU is low value for this pipeline. The ground is best sharpened with per-terrain detail textures or chunked painting, not a bigger single canvas.

### Cited Findings

**Compressed-format support**
- WebGL2 extension support ([ASTC](https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_astc), [ETC](https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_etc), [S3TC](https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_s3tc), [BPTC](https://web3dsurvey.com/webgl2/extensions/EXT_texture_compression_bptc)):

| Format | Android | iOS | Windows | macOS | Linux |
|---|---|---|---|---|---|
| ASTC | 99.73% | 99.99% | 1.8% | 89.68% | – |
| ETC | 99.86% | 99.99% | 1.8% | 89.66% | 91.18% |
| S3TC | 28.72% | 52.69% | 99.96% | 88.21% | 94.82% |
| BPTC (BC7) | 22.55% | 52.69% | 99.69% | 81.87% | 93.96% |

**Basis Universal (KTX2) modes**
- ETC1S is about 0.3–3 bits per pixel after BasisLZ, with a JPEG-like quality slider.
- UASTC is a fixed 8 bpp before compression, about 4–6 bpp per texture with RDO plus LZ, with quality "close to BC7" — [Basis Universal README (mirror)](https://skia.googlesource.com/external/github.com/BinomialLLC/basis_universal/+/8bf012367213fb3668beadf2aa071d0d01443785); [basisu cmd help](https://skia.googlesource.com/external/github.com/BinomialLLC/basis_universal/+/HEAD/cmd_help/cmd_help.txt).
- Basis advises encoding from the original uncompressed images — same sources.

**three.js KTX2Loader (local copy)**
- It detects ASTC/ETC2/S3TC/BPTC/PVRTC (`node_modules/three/examples/jsm/loaders/KTX2Loader.js:235-254`).
- It transcodes UASTC/ETC1S to ASTC_4x4 first, then BC7, then BC1/BC3, ETC1/ETC2, PVRTC, and falls back to RGBA32 (`KTX2Loader.js:795-868`).
- The transcoder is `basis_transcoder.wasm` (527 KB) plus a 57 KB JS file (`node_modules/three/examples/jsm/libs/basis/`).
- The repo's own AVIF trial found that lossy alpha flipped about 0.1% of edge pixels across the 0.5 alpha cut, and that at matching quality AVIF was no smaller than WebP (`docs/ROADMAP.md:80-83`).

**Resolution variants in 2D engines**
- PixiJS expands patterns such as `bunny@{0.5,1,2}x.{png,webp}` and picks the variant at runtime by format support and device pixel ratio ("2x if on a high-res display") — [PixiJS Assets resolver guide](https://pixijs.com/8.x/guides/components/assets/resolver). This is the standard 2D approach of shipping @1x/@2x(/@3x) atlases chosen per DPR.

**Alpha to coverage in three.js (local)**
- `Material.alphaToCoverage` exists (`node_modules/three/src/materials/Material.js:409`). It enables `gl.SAMPLE_ALPHA_TO_COVERAGE` (`renderers/webgl/WebGLState.js:787`).
- With `alphaTest` set, the shader chunk becomes `diffuseColor.a = smoothstep(alphaTest, alphaTest + fwidth(diffuseColor.a), diffuseColor.a)` (`renderers/shaders/ShaderChunk/alphatest_fragment.glsl.js`). That is the fwidth-sharpened alpha-to-coverage that Golus describes, and it works only with an MSAA framebuffer.
- Godot shipped the same "alpha antialiasing" (sharpened alpha to coverage) — [Godot PR #40364](https://github.com/godotengine/godot/pull/40364).

**Cost of MSAA on tile-based mobile GPUs**
- Epic (PowerVR era): MSAA resolves on die, cost 0–5 ms — [Bringing AAA graphics to mobile](https://www.slideshare.net/slideshow/smedberg-niklas-bringingaaagraphics/36754982).
- Meta: 4× MSAA is "extremely cheap" on its Arm-based Quest devices and is recommended — [Meta: GPU improved algorithms](https://developers.meta.com/horizon/documentation/native/android/gpu-improved-algorithms/).
- Qualcomm: Adreno resolves MSAA in GMEM during the tile store — [Qualcomm: Anti-aliasing with Adreno](https://developer.qualcomm.com/software/snapdragon-profiler/app-notes/anti-aliasing-with-adreno).
- Arm warns against storing MSAA data to DRAM — [Arm Vulkanised 2025 deck](https://www.vulkan.org/user/pages/09.events/vulkanised-2025/T18-Pete-Harris-Arm-MobileBestPractices.pdf).

**Sharpening (AMD FidelityFX CAS)**
- CAS is a "low overhead adaptive sharpening algorithm with optional up-sampling" by Timothy Lottes. It wants linear-colour input, and its constants are computed on the CPU — [AMD GPUOpen CAS](https://gpuopen.com/manuals/fidelityfx_sdk/samples/contrast-adaptive-sharpening/).
- An MIT-licensed GLSL port exists (Shadertoy `stXSWB`, via [godotshaders](https://godotshaders.com/shader/amd-fsr-cas-contrast-adaptive-shapenening/)).
- I found no maintained three.js CAS pass.

**WebGPU status**
- Safari ships it on macOS Tahoe 26 and iOS/iPadOS 26.
- Chrome on Android has it since 121, on Android 12+ with Qualcomm or ARM GPUs.
- Firefox has it on Windows (141) and on ARM macOS (145). Android and Linux are still in progress — [web.dev, Nov 25 2025](https://web.dev/blog/webgpu-supported-major-browsers).

**Repo constraints that affect the options**
- The sprite shaders are `onBeforeCompile` string patches of MeshBasicMaterial (`spriteLayer.js:124-153`), as is the ground detail (`groundDetail.js:75-92`). WebGPURenderer would need them ported to node materials.
- The ink look is CPU pixel code run at bake time on colour, normal and depth renders (`spriteBaker.js:215-241`, `inkStyle.js`).
- Packing is kept out of the bake fingerprint on purpose, so a repack needs no re-render (`atlasPacking.js:3-8`).
- A full fresh bake takes about 8 minutes (`docs/ARCHITECTURE.md:100-101`).

### Options (cost/benefit; estimates are inferences from the numbers above unless cited)

1. **Alpha-to-coverage on object sprites, with MSAA (High)**
   - **Change:** `material.alphaToCoverage = true` in `SpriteLayer._makePage` (`spriteLayer.js:111`). Keep `alphaTest`: three then applies fwidth sharpening.
   - **Effort:** hours, plus an e2e screenshot check.
   - **Gain:** anti-aliased silhouettes and ink outlines on every sprite. That is the main visible jaggedness at native DPR, and it gets worse wherever 'auto' scale is low (if MSAA is on there too).
   - **Cost:** close to free on tile-based GPUs, where MSAA resolves on chip (sources above). It only works when `antialias: true`, which today means High only (a reload setting). Off-High it is a no-op.
   - **Risks:**
     - Coverage gives only 5 levels at 4× MSAA.
     - The snow and season shader reads alpha above the pixel (`spriteLayer.js:74-76`). That is unaffected, but should be checked.
     - Depth writes stay per sample, which is fine.

2. **Clean edges in the bake: colour-bleed transparent texels, more padding or extrusion, optional premultiplied alpha**
   - **Change:**
     - Fill fully transparent texels with the nearest opaque colour (TexturePacker's "reduce border artifacts").
     - Raise `PADDING` from 3 to about 8, or pad to a multiple of 4–8 so mips 2–3 stay clean.
     - Or switch to premultiplied alpha (`texture.premultiplyAlpha = true`, `material.premultipliedAlpha = true`).
   - **Effort:** a day.
   - **Gain:** no dark fringes or bleed when zoomed out, steadier thin parts.
   - **Cost:** a little more atlas area from the padding, perhaps +2–4% pages. No runtime cost.
   - **Risks:**
     - The colour bleed changes the WebP bytes, so the e2e screenshots need re-baselining.
     - Premultiplied alpha must be consistent with `alphaTest` (test on alpha) and with the CustomBlending shadow material (`spriteLayer.js:117-121`).

3. **Stop uploading icon pages to the GPU; consider per-mode page subsets**
   - **Change:** give icons their own small atlas, or skip creating SpriteLayer materials for icon-only pages. Optionally load Conquest-only blue buildings, heroes and bandits (about 11% of standard texels) only in that mode.
   - **Effort:** a day.
   - **Gain:** none visually.
   - **Memory:** −16 MiB (standard) / −68 MiB (HD) with mips straight away, and more with mode subsets.
   - **Risk:** low. The HUD reads icons from `atlas.pages[f.page].source` (`spriteBaker.js:318`), so they must stay as images, not textures.

4. **Raise unit sprites from 56 to 72 ppu (elites 43 to 56)**
   - **Effort:** a constant change (`spriteCatalog.js:94`), then a re-bake.
   - **Gain:** units are the most magnified sprites (2.3× at max zoom on phones, 4.1× on retina desktops). At 72 ppu they become sharp up to zoom 2 on phones.
   - **Cost:** unit texels ×1.65, from about 20 M to about 33 M, so +3.3 pages in both sets: +53 MiB RGBA, +70 MiB with mips. That is affordable with option 5 or 3, risky on its own on iOS.
   - **Risk:** draw calls +1 to +2 (more unit pages).

5. **KTX2/Basis compressed atlases**
   - **Format choice:** UASTC for quality on ink lines and alpha, or ETC1S for size. The loader transcodes to ASTC 4×4 on phones and Apple, and BC7 on Windows.
   - **Effort:**
     - 2–4 days: add `basisu` or `toktx` to the bake, encode from the lossless cached sprites rather than from the WebP, write mips into the file, and use KTX2Loader in `loadPrebaked`.
     - A WebP fallback is needed for the rare device with no supported format, though the loader's RGBA32 fallback covers that.
   - **GPU memory:** 8 bpp for both ASTC 4×4 and BC7, against RGBA8's 32. That is about 4× less: standard 272 → about 68 MiB, HD 751 → about 188 MiB with mips. This is the only option that makes HD on phones realistic.
   - **Download:**
     - UASTC+RDO+zstd at about 4–6 bpp is roughly 27–40 MB (standard) and 74–111 MB (HD), against today's 6.8 and 11.1 MB.
     - ETC1S at 1–2 bpp is about 7–13 MB (standard), but has visible blocking on flat ink areas and lower-quality alpha.
   - **Other costs:** transcoding takes CPU time on load (a WebWorker in the loader) and a 527 KB wasm.
   - **Risks:**
     - Block compression may move the alpha cut, as the AVIF trial did (0.1% of edge pixels).
     - Edge-quality checks are needed.
     - The bake gets slower.
   - **Middle path:** UASTC only for the pages seen close up (buildings, walls), ETC1S for the rest, or compressed only on the HD set.

6. **Per-zoom atlas LOD: stream HD pages instead of a fixed set**
   - **Change:**
     - Always load standard.
     - When zoom passes the magnification threshold (about 1.8–2.0 on phones), fetch and upload HD pages for the groups in view.
     - Evict them when zooming out. Zoomed in, the view spans only about 8–17 units, so few distinct frames are visible.
   - **Effort:** about a week. It needs a two-set frame lookup in SpriteLayer, separate InstancedMeshes per set, async upload without hitches, and possibly repacking HD by group so walls and buildings need fewer pages.
   - **Gain:** HD sharpness on phones at close zoom.
   - **Memory:** a peak of standard plus the visible HD pages, not the whole HD set.
   - **Risks:**
     - Upload stalls: a 2048² RGBA upload plus mip generation on a phone is not free.
     - A visible sharpness pop.
     - The atlas is grouped by kind, not location, so a zoomed-in view of a walled base may still need most wall pages.

7. **A third @3x set (216 ppu)**
   - **Who needs it:** only DPR-2 desktops at max zoom, where HD reaches 1.59× magnification.
   - **Cost:** texels about ×2.25 HD, about 330 M, about 1.26 GiB RGBA (1.7 GiB with mips). Not viable without option 5 plus option 6.
   - **Cheaper alternative:** cap the max zoom so screen ppu stays at or below about 1.25 × sprite ppu (for example 2.8 on DPR-2 desktops).
   - **Value:** low.

8. **Ground: per-terrain detail textures and/or chunked high-res painting near the camera**
   - **Option a (detail textures):** extend `groundDetail.js` into a splat that picks the detail by terrain type (grass strokes, gravel, sand ripples, forest litter) from a low-res type map. It could also use the detail at 2 repeat scales to hide tiling.
     - Effort: 2–3 days.
     - Cost: 1–3 more texture fetches per ground pixel, and textures of 256–512² each.
     - Gain: a large perceived gain at zoom ≥ 1.3, with no memory risk.
   - **Option b (chunked painting):** keep the 32 px/tile base and repaint 8×8-tile chunks at 96–128 px/tile with `paintTerrain`'s detail stamps for the area around the camera when zoomed in. This is a cache of a few 1024² chunk textures, a light form of virtual texturing.
     - Effort: 1–2 weeks. The painter is CPU canvas code, so painting a chunk costs milliseconds and needs a worker or OffscreenCanvas.
     - Gain: true high-res ground close up.
   - **Avoid:** raising `GROUND_PX` globally. 64 px/tile on a Medium map is a 5120² texture (only 75% of Android devices support 8192, per web3dsurvey) and about 133 MiB with mips.

9. **Render-scale reconstruction: CAS after the 'auto' scale**
   - **Change:** instead of letting the browser stretch a 0.75× canvas, render to a target and upscale and sharpen with CAS in one full-screen pass at native size.
   - **Effort:** 2–3 days. It needs a render target, a pass, and keeping the HUD in the DOM.
   - **Gain:** noticeably crisper Low/Medium on phones.
   - **Cost:** one extra full-screen pass at about 2.4 Mpx, plus a render target of about 0.2–1.5 Mpx. The CSS colour grade could fold into that pass for free.
   - **Risks:**
     - CAS can ring on ink lines.
     - MSAA on a render target needs WebGL2 `samples`.
     - Bandwidth on low-end phones.

10. **Anti-aliasing: MSAA (keep) vs FXAA**
    - FXAA and similar post AA (SMAA) blur fine texture and line detail. For hand-inked sprites with 1.5–2 px lines that is the wrong trade.
    - MSAA plus alpha-to-coverage (option 1) is the fitting AA for alpha-tested sprites.
    - Today High pays for MSAA but gets little from it, since only live 3D meshes and the ground and cliff polygons benefit.

11. **Mip bias and filtering**
    - **Negative LOD bias** (`texture2D(map, uv, -0.5)` in the sprite shader, or sharper Kaiser/Lanczos mips generated offline, which requires shipping mips, as in option 5):
      - Gain: sharper zoomed-out sprites (zoom < 1, where sprites run 0.16–0.5×).
      - Risk: shimmer while panning.
    - **Anisotropy:** set it to 1 on sprite pages (no benefit, since the quads face the camera) and 2 on the ground.
    - **Bake downscale:** use a better filter (Lanczos, or `imageSmoothingQuality: 'high'`) for HD's 1.5:1 supersample downscale.
    - Each is small effort with a small gain.

12. **Exact device-pixel canvas**
    - **Change:** size the drawing buffer from `ResizeObserver` `devicePixelContentBoxSize` where available (Chrome/Edge), instead of `floor(css × dpr)`.
    - **Effort:** hours.
    - **Gain:** removes a possible whole-frame resample on fractional-DPR Android phones at native. This is unverified (see Q2 gaps).
    - **Risk:** low.

13. **Live 3D rendering of selected models at native resolution**
    - The baked look depends on bake-time ink (normal and depth renders plus CPU pixel code) and VSM shadows. Reproducing it live would need real-time edge-detection passes (two extra G-buffer passes) and live shadows. That is a large phone cost and effort (weeks), and it risks a style mismatch with the baked neighbours.
    - It is worthwhile only for one or two hero objects at max zoom, if at all.

14. **WebGPU (three.js WebGPURenderer)**
    - **Availability:** iOS 26 and Chrome Android 121+ (Android 12+, Qualcomm/ARM). Firefox Android is not yet available.
    - **Effort:** weeks. All `onBeforeCompile` patches would need porting to TSL or node materials, and a WebGL2 fallback kept.
    - **Gain for sharpness:** none in itself. Compressed textures, MSAA and alpha-to-coverage are all available in WebGL2 already.
    - **Value:** low for this goal.

### Inferences
- **Suggested order for the most visible gain per risk on phones:**
  1. Option 1 (alpha to coverage).
  2. Option 2 (edge colour and padding).
  3. Option 3 (drop icon pages).
  4. Option 8a (ground detail splat).
  5. Option 4 (unit ppu, ideally once option 5 lands).
  6. Then option 5 (KTX2) as the step that unlocks HD on phones, alone or with option 6 (streaming).
- **The download/memory trade-off in option 5 is the crux.** Our WebP pages are unusually small (0.55–0.88 bits per texel, since sprites are mostly flat inked colour plus transparent space). UASTC would grow the download about 5–7×. ETC1S stays near today's size but risks the ink-line quality. A per-page mix, or compressing only the HD set (desktop download cost is less critical), is the likely compromise.
- **Moving phones off the 'native' default** to a capped ratio (for example 2.0) with CAS would cut fragment cost by about 42% on a DPR-2.625 phone. With alpha-to-coverage it might look as sharp. That is unverified and needs an on-device comparison.

### Gaps
- No measured on-device numbers: frame time, memory, transcoding time, KTX2 file sizes for our actual pages. A trial encode of 2–3 pages (walls, units, buildings) with `basisu -uastc -uastc_rdo_l` and with ETC1S would pin down the download and quality figures.
- I could not read Ben Golus's article directly (HTTP 403). Its mip-sharpening details come from secondary summaries.
- I found no published case study of a pre-baked isometric web game shipping KTX2 sprite atlases, and no maintained three.js CAS pass.
- ASTC 4×4 / BC7 = 8 bits per texel is standard format knowledge (128-bit blocks over 16 texels). I did not cite it from a primary spec page in this note.
