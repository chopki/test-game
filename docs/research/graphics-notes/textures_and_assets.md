# Texture and asset pipelines for high-res browser games (2024–2026)

Project context (measured locally, 2026-10-20, not from a web source): `public/sprites-hd/` holds **36 pages of 2048×2048 WebP** (11 MB on disk, 3,147 frames in `atlas.json`); `public/sprites/` (SD) holds **13 pages of 2048×2048 WebP** (6.6 MB). The memory figures below are worked out for these page counts.

## GPU texture compression in the browser (KTX2 + Basis Universal, transcoding, support, alpha, atlases)

### Takeaway
KTX2 with Basis Universal is the standard way to ship one GPU-compressed file that every device can use. **ETC1S** is small (about JPEG-sized, roughly 0.3–3 bpp on disk) but lower quality, and it handles UI and flat-colour art well. **UASTC** is near BC7 quality and larger on disk; it is the safer choice for detailed, high-contrast art with alpha. At runtime, Three.js's KTX2Loader transcodes UASTC to ASTC on phones (support is about 99.7–100% on iOS and Android) and to BC7/S3TC on Windows, where ASTC and ETC support is only about 2%.

### Cited Findings
**Codecs and bitrates**
- ETC1S runs at about 0.3–3 bpp ("low to medium quality"). UASTC LDR 4x4 is 8 bpp ("high-quality"). Basis Universal v2.5 (2026) adds XUASTC LDR at about 0.3–5.7 bpp (4x4 typically 1.15–3.5, about 2.25 bpp), ASTC LDR 4x4–12x12 at 0.89–8 bpp, and XUBC7. — [basis_universal README](https://github.com/BinomialLLC/basis_universal)
- Basis Universal can transcode to ASTC LDR, BC1–5, BC7, ETC1, ETC2 RGBA, EAC R11/RG11, PVRTC1/2, ATC, FXT1, and uncompressed 8888/565/4444. All modes support mipmaps, texture arrays and cubemaps. RDO (`-uastc_rdo_l`, default 1.0, suggested range 0.2–3.0) trades quality for smaller Zstd output. — [basis_universal README](https://github.com/BinomialLLC/basis_universal)
- ETC1S suits "large areas of solid colors or mostly monochromatic values" and non-PBR, toon and **interface** assets. It "doesn't produce quality results on complex textures" and struggles with saturated colours placed next to each other. UASTC "offers higher visual quality for high-contrast high-detail color textures". In the guide's lamp example, a high-variation base colour **with alpha** was switched from ETC1S to UASTC after review. — [Khronos KTX Artist Guide](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md)
- Khronos examples: the stained-glass lamp went from JPG+PNG (13 MB disk, **96 MB GPU**) to UASTC+ETC1S KTX2 (10 MB disk, **21 MB GPU**, about 22%). The duck went from PNG (118 KB disk, 1.5 MB GPU) to ETC1S (116 KB disk, 277 KB GPU). The settings used were ETC1S `--encode etc1s --clevel 4 --qlevel 255` and UASTC `--encode uastc --uastc_quality 4` plus RDO and `--zcmp 22`, with `--genmipmap`. — [Khronos KTX Artist Guide](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md)
- KHR_texture_basisu requires dimensions that are **multiples of 4**, even where NPOT is allowed. Blocks are 4×4, so aligning content to the 4×4 grid reduces artefacts. — [Khronos KTX Artist Guide](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md)
- On disk, ETC1S is "comparable to JPEG". With Zstd, UASTC KTX2 files are typically 1–2× the size of JPEG or ETC1S at the same resolution, and UASTC is still about 4× smaller than JPEG/PNG in GPU memory. ETC1S works poorly for normal maps. — [Don McCurdy, "Choosing texture formats for WebGL and WebGPU" (Feb 2024)](https://www.donmccurdy.com/2024/02/11/web-texture-formats/)

**Three.js KTX2Loader behaviour (current `dev` source)**
- Transcode target priority:
  - ETC1S: ETC2, then ETC1, then BC7, then S3TC, then PVRTC, then RGBA32. ETC1S never goes to ASTC.
  - UASTC: ASTC, then BC7, then ETC2, then ETC1, then S3TC, then PVRTC, then RGBA32.
  - UASTC HDR: BC6H, then RGBA half-float.

  — [three.js KTX2Loader.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/loaders/KTX2Loader.js)
- `detectSupport(renderer)` checks the `texture-compression-*` features on WebGPU, and `WEBGL_compressed_texture_astc/etc1/etc/s3tc`, `EXT_texture_compression_bptc` and PVRTC on WebGL. ASTC, ETC1 and ETC2 are **disabled on desktop Linux** because drivers may emulate them in software. `detectSupportAsync()` is deprecated. The loader uses a WorkerPool (`setWorkerLimit`). — [three.js KTX2Loader.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/loaders/KTX2Loader.js)
- `texture.premultipliedAlpha` is set from the KTX2 DFD flag `KHR_DF_FLAG_ALPHA_PREMULTIPLIED`, and colour space comes from the DFD primaries and transfer function (sRGB or linear). PVRTC needs power-of-two dimensions. The loader warns when base dimensions are not multiples of 4. Files with mipmaps get `LinearMipmapLinearFilter`, and files without get `LinearFilter` with `generateMipmaps = false`: runtime mip generation is impossible for compressed data. — [three.js KTX2Loader.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/loaders/KTX2Loader.js)

**Device support (web3dsurvey; the share of reports, undated pages, read Oct 2026)**
- `WEBGL_compressed_texture_astc` (WebGL2): **iOS 99.99%, Android 99.73%**, ChromeOS 98.04%, macOS 89.68%, Linux 82.76%, **Windows 1.8%**, 46.9% overall. — [web3dsurvey ASTC](https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_astc)
- `WEBGL_compressed_texture_etc` (ETC2/EAC): **iOS 99.95%, Android 99.79%**, ChromeOS 99.72%, Linux 90.95%, macOS 89.47%, **Windows 1.86%**. By browser: Safari 97.77%, Samsung Internet 99.47%. — [web3dsurvey ETC](https://web3dsurvey.com/webgl/extensions/WEBGL_compressed_texture_etc)

**Engine experience**
- PlayCanvas's Basis docs report a **6× VRAM reduction**, with download size falling from 202 KB to as little as 46 KB. — [PlayCanvas texture-compression manual (via search summary)](https://developer.playcanvas.com/user-manual/optimization/texture-compression/), [PlayCanvas blog: Basis arrives](https://blog.playcanvas.com/basis-texture-compression-arrives-in-playcanvas)
- In a PlayCanvas forum case, VRAM was 11.2 MB on desktop and **22.4 MB on iOS**, because the Basis transcoder chose ASTC (higher quality) over PVRTC, and ASTC 4x4 uses twice PVRTC's memory. — [PlayCanvas forum (via search summary)](https://forum.playcanvas.com/t/basis-compression-ios-android-issue/20317)
- PlayCanvas's 2016 demo used 528 MB VRAM as JPG+PNG, 87.7 MB as DXT or ETC1 and 66.8 MB as PVR. A 4096×2048 JPG of 1.81 MB costs 33.6 MB of VRAM uncompressed. — [PlayCanvas blog, Oct 2016](https://blog.playcanvas.com/webgl-texture-compression-made-easy)

**Atlases: padding, bleeding and mips**
- Unity rounds atlas padding up to a **multiple of 4** for compressed atlases because of block alignment. It also silently falls back to an uncompressed RGBA32 atlas when compressed inputs have mipmaps and padding > 0. — [Unity Texture2D.PackTextures docs](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/texture2d/packtextures)
- Mipmapped atlases need more extrusion, and shape padding should be at least the extrude width. Mips blend across sprite edges at distance and make bleeding worse, so either disable mips for fixed-size UI sprites or pad enough for the lowest mip used. — [FastPack extrude docs](https://www.mintlify.com/Hexeption/FastPack/packing/extrude); [bugnet guide (low authority)](https://bugnet.io/blog/how-to-fix-texture-bleeding-and-seams-in-an-atlas)

### Inferences
- For this project's sprite pages, which are painted art with alpha edges and saturated neighbouring colours, UASTC (with RDO and Zstd) is the likely quality choice. It becomes ASTC 4x4 on iPhone and Android, and BC7 on Windows when `EXT_texture_compression_bptc` is present (otherwise S3TC/DXT5). ETC1S would be about half the download, but the Khronos guidance suggests artefacts on detailed art with alpha. A cheap first test: run both on a few pages and compare at 1:1 zoom on a phone.
- Per the KTX2Loader priority list, an ETC1S file with alpha becomes ETC2 RGBA (8 bpp in GPU memory) on iOS and Android. So **ETC1S saves download size, not phone GPU memory**, compared with UASTC→ASTC 4x4; both are 8 bpp on the GPU when alpha is present.
- Sprite atlases at 2048² with 4×4 blocks: keep each frame's rect aligned to 4 px and padding at 4 px or more, so blocks never straddle two sprites. With mips, each level halves the padding (4 px of padding is 1 px at mip 2), so either cap the mip count (for example `maxLevel` or a minimum LOD) or pad more.
- Basis's own mip generation (`--genmipmap`) works on the whole page and does not know where sprites sit. Bleeding between frames at low mips is therefore governed only by padding, the same as with WebP plus `generateMipmaps`.

### Gaps
- I found no authoritative per-format PSNR comparison for sprite or UI art specifically. The basis_universal R-D graph exists only as an image.
- I did not confirm the exact `toktx`/`basisu` flag for marking premultiplied alpha in the DFD (Three.js reads the flag, but setting it depends on the encoder). Encoders typically premultiply inside the tool or expect pre-multiplied input. Check `toktx --help` before relying on it.
- flipY: compressed textures cannot be flipped at upload (well known in WebGL, but I did not fetch a primary source this session). Bake atlases in the orientation the shader expects, or flip UVs.
- web3dsurvey pages show no collection date and measure reports, not devices or users.

## GPU memory: the uncompressed cost of 2048² pages, mobile limits, effect of compression

### Takeaway
An uncompressed 2048² RGBA8 page costs 16 MiB, or about 21.3 MiB with a full mip chain. **36 such pages cost about 576 MiB, or about 768 MiB with mips**, which is far beyond what is safe in iOS Safari, where tabs get killed and reloaded without a JS error. 8-bpp GPU formats (ASTC 4x4, BC7, ETC2 RGBA) cut this 4×, to about 144 MiB (about 192 MiB with mips). Apple publishes no WebGL memory cap.

### Cited Findings
- Formula: width × height × 4 × 1.333 for an uncompressed texture with mips. **4096² with mips ≈ 90 MB**, whatever the file size. GPU formats cut memory 4–8× and make uploads 4–8× faster. — [Don McCurdy (2024)](https://www.donmccurdy.com/2024/02/11/web-texture-formats/)
- WebP, like PNG and JPEG, is fully decompressed to 4 bytes per pixel on the GPU, so it does not save VRAM. — [three.js forum: WebP vs KTX2](https://discourse.threejs.org/t/webp-vs-ktx2-for-web-textures/58651)
- **iOS reload loop:** WebKit bug 300782 (Oct 2025, iOS/Safari 18, status NEW) reports that WebGL- and texture-heavy pages are killed under iOS memory pressure and reloaded immediately, sometimes in a loop ending in "A problem repeatedly occurred". No OOM error reaches JS and no `webglcontextlost` fires first. It is easier to trigger on lower-memory devices. A WebKit engineer (Mar 2026) gave **no numeric budget** and called the reported 4–16× gap with Android "a bug" if reproducible. — [WebKit bug 300782](https://bugs.webkit.org/show_bug.cgi?id=300782)
- Older reports: memory climbs until the page freezes or reloads blank after context loss ([WebKit 229606](https://bugs.webkit.org/show_bug.cgi?id=229606)). One 2018 crash was attributed to about **900 MB used by WebGL**, mostly textures ([WebKit 190518](https://www2.webkit.org/show_bug.cgi?id=190518)).
- Unity WebGL developers report iOS tabs force-reloading as heap or memory grows past about 256 MB, and that **switching textures to ASTC reduced iPhone memory** and stopped reloads. These are anecdotal forum reports. — [Unity forum 1541942](https://discussions.unity.com/t/webgl-ios-unity-sometimes-reloads-after-startup/1541942); [Unity forum 894771](https://discussions.unity.com/t/webgl-memory-increment-issue-and-crash-on-ios/894771)
- An unverified game-dev tips page gives about 300–400 MB as a rough ceiling on older iPhones. — [abratabia iOS Safari gotchas (low authority)](https://abratabia.com/mobile-web-games/ios-safari-gotchas.php)
- CrazyGames **disables Unity games on iOS by default "due to memory-related crashes"** and forces DPR 1 on iOS and low-memory Android for Unity builds. — [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical/)

**Worked numbers** (arithmetic; bpp per format from the [basis_universal README](https://github.com/BinomialLLC/basis_universal); 1 MiB = 2²⁰ B; mips add one third):

| Format in GPU memory | bpp | One 2048² page | + mips | 13 pages (SD) + mips | 36 pages (HD) + mips |
|---|---|---|---|---|---|
| RGBA8 (from WebP/PNG) | 32 | 16 MiB | 21.3 MiB | 277 MiB | **768 MiB** |
| RGBA4444 / 565 (no-compression fallback) | 16 | 8 MiB | 10.7 MiB | 139 MiB | 384 MiB |
| ASTC 4x4 / BC7 / ETC2 RGBA / BC3 | 8 | 4 MiB | 5.3 MiB | 69 MiB | **192 MiB** |
| ASTC 6x6 | 3.56 | 1.8 MiB | 2.4 MiB | 31 MiB | 85 MiB |
| ETC2 RGB / BC1 / PVRTC 4bpp (no or 1-bit alpha) | 4 | 2 MiB | 2.7 MiB | 35 MiB | 96 MiB |
| ASTC 8x8 | 2 | 1 MiB | 1.3 MiB | 17 MiB | 48 MiB |

### Inferences
- Without compression, the current HD set (36 × 2048² WebP) puts about 576–768 MiB on the GPU if every page is resident. That is in the range where iOS Safari kills the tab, as in the 900 MB WebKit case and the Unity 256–400 MB reports. Even the SD set, at about 208–277 MiB, is borderline on older iPhones.
- WebGL may also keep a CPU-side copy or decoded ImageBitmap alive. That memory comes on top of the GPU memory, so after upload it is worth releasing references (`texture.source.data = null` or `ImageBitmap.close()`) once you are sure no re-upload is needed. Treat the effect as untested in this repo.
- Compressing to ASTC 4x4 (UASTC) brings HD to about 192 MiB. Lazy-loading pages (only the biome, unit and wall sets in view) or choosing ASTC 6x6 for less critical pages cuts further. Raw ASTC 6x6 can't be expressed through UASTC 4x4; it needs the newer XUASTC/ASTC-LDR modes in basis_universal v2.x, whose Three.js transcoder support I did not verify.

### Gaps
- No official Apple or WebKit per-tab or WebGL memory limit exists. All thresholds are anecdotal. Android Chrome limits were not found either; they depend on device RAM and the low-memory killer.
- There is no browser API to query a GPU memory budget; WebKit bug 300782 explicitly asks for one.

## Delivery: WebP/AVIF vs KTX2, decode cost, progressive loading, caching

### Takeaway
WebP and AVIF win on download size and first paint, but they decode on the CPU and still cost 4 B/px on the GPU. KTX2 is roughly JPEG-sized (ETC1S) or 1–2× JPEG (UASTC with Zstd), transcodes in workers, and uploads 4–8× faster. Portal budgets are tight: CrazyGames allows at most 20 MB of initial download for mobile homepage eligibility.

### Cited Findings
- Recommendations: WebP/AVIF for the fastest first contentful paint and simple visuals. KTX2/Basis for long sessions and heavy interactive loading. JPEG/PNG for compatibility. By default three.js decodes and uploads a texture on its first render; `renderer.initTexture()` uploads earlier, and `ImageBitmapLoader` moves decode off the main thread, reducing dropped frames "somewhat". — [Don McCurdy (2024)](https://www.donmccurdy.com/2024/02/11/web-texture-formats/)
- ImageBitmap moves PNG/JPG decode off the main thread, but the **upload of the decompressed texture still happens on the main thread**. Users report freezes of up to about 1 s per large image with both TextureLoader and ImageBitmapLoader. Forum advice: use KTX2 (transcoded in a worker, with a faster upload). — [three.js forum: Loader blocks main thread](https://discourse.threejs.org/t/loader-textureloader-imagebitmaploader-blocks-js-main-thread-causing-temporary-freeze/44579); [three.js forum: performance ideas](https://discourse.threejs.org/t/performance-ideas-loading-objects-in-workers-faster-texture-uploads-etc/25328)
- GLTFLoader uses ImageBitmapLoader on most browsers **except Safari and older Firefox**, according to a forum post. — [three.js forum](https://discourse.threejs.org/t/imagebitmaploader-during-runtime-once-with-await-async-and-once-with-callback/49933)
- A Pixi.js user saw `createImageBitmap` appear to block the main thread in Chrome's profiler. The WebGL Q&A says the browser already decodes images on a separate thread, so a worker adds little, and the only reliable anti-jank method is uploading part of the texture each frame (`texSubImage2D` by rows). — [webgl2fundamentals Q&A](https://webgl2fundamentals.org/webgl/lessons/webgl-qna-how-to-load-images-in-the-background-with-no-jank.html)
- **Portal budgets:**
  - **CrazyGames:** at most 250 MB total, at most 1,500 files, at most **50 MB initial download** (measured to the first `gameplayStart`), at most 20 s to gameplay for external loads, and at most **20 MB initial download for the mobile homepage**. — [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical/)
  - **Poki:** the official terms only say "aim to keep the initial and full file size … as small as possible" ([Poki deal terms](https://sdk.poki.com/deals)). The often-quoted 8 MB initial-download target comes from third-party guides ([cinevva guide](https://app.cinevva.com/guides/publish-game-poki)). A 2018 W3C games-workshop talk by a Poki engineer found that a 10 MB download corresponds to about 0.8 "conversion to play" (US, 174 desktop games). — [W3C workshop slides "Size matters"](https://www.w3.org/2018/12/games-workshop/slides/12-size-matters.pdf)
  - **Defold's Poki guide** suggests keeping files under 20 MB. — [Defold Poki best practices](https://defold.com/extension-poki-sdk/best-practices)

### Inferences
- The HD set (11 MB WebP) already exceeds the commonly quoted Poki 8 MB initial target on its own, but fits CrazyGames' 20 MB mobile cap. Streaming is the way through: load the SD set (6.6 MB) or a low-res KTX2 first, show gameplay, then swap pages to HD in the background, one page per frame or per idle callback, to spread the upload stalls.
- For hashed sprite assets: serve them with `Cache-Control: public, max-age=31536000, immutable`, since the content hash in the URL or atlas `sourceHash` busts the cache, and optionally precache with a service worker (Workbox). This is standard practice; I did not fetch a primary source this session.
- KTX2 transcoding needs the Basis WASM transcoder (about a few hundred KB; size not verified this session) and worker start-up. That one-off cost is easily repaid with 36 pages.

### Gaps
- I found no measured decode-time numbers (ms per 2048² WebP vs AVIF vs KTX2 transcode on a phone). This would need a local benchmark, best as an e2e or perf test in this repo.
- I did not get a primary source for AVIF decode cost or Safari's createImageBitmap options support.

## Resolution tiers: multiple asset sets, choosing per device, LOD, anisotropy

### Takeaway
Games ship SD and HD sets and pick one from DPR, device memory and a GPU tier. Every signal is coarse. `navigator.deviceMemory` is Chromium-only and bucketed. detect-gpu gives tiers 0–3 from gfxbench FPS data, which stopped updating in Dec 2025. Portals force DPR 1 on iOS and low-memory Android for heavy games.

### Cited Findings
- `navigator.deviceMemory` returns GB rounded to a power of 2 and clamped (example: 2, 4, 8, 16, 32). It requires HTTPS, is "Limited availability" (not in some major browsers; Safari and Firefox lack it per general knowledge, not confirmed on the page), and is also available as the `Sec-CH-Device-Memory` client hint. — [MDN deviceMemory](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory)
- detect-gpu tiers: 0 (no WebGL, blocklisted, or under 15 fps), 1 (≥15 fps), 2 (≥30), 3 (≥60), based on resolution-normalised gfxbench scores. It returns `{tier, isMobile, type, fps, gpu}`. The gfxbench source **stopped updating in Dec 2025**; maintainers are looking for alternatives. Benchmark data loads from UNPKG by default (self-host with `benchmarksURL`). ESM only. — [pmndrs/detect-gpu](https://github.com/pmndrs/detect-gpu)
- CrazyGames sets DPR 1 for Unity games on iOS and low-memory Android and uses `window.devicePixelRatio` elsewhere. — [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical/)

### Inferences
- A practical tier rule for this game: **HD** when (not iOS, or iOS on a recent device) and the KTX2 path is available and (`deviceMemory` ≥ 4 or unknown) and the detect-gpu tier is ≥ 2. Otherwise **SD**. Always store a user override in settings. On iOS, Apple GPUs report a generic "Apple GPU" renderer string, so detect-gpu can't tell models apart well (well known, not confirmed this session). Screen size and DPR are the main proxies there.
- Texture LOD: for a top-down sprite game at fixed zoom, the screen-size-to-texel ratio is known. Choosing the atlas tier so that one texel is about one device pixel at the default zoom avoids both wasted memory and blur. Mip bias and anisotropy matter little for screen-aligned sprites; anisotropic filtering (`texture.anisotropy = renderer.capabilities.getMaxAnisotropy()`) helps only on oblique ground textures.

### Gaps
- I found no primary data on what share of phones fall in each detect-gpu tier, or on how commercial web games choose tiers. No case study with numbers was found.
- No source covered mip bias (`textureLod`/`bias`) for sprite sharpness in Three.js.

## Text and UI crispness: SDF/MSDF fonts, DOM/SVG UI

### Takeaway
For text inside the WebGL scene, SDF (troika-three-text) or MSDF (three-msdf-text-utils) stays sharp at any scale with a small atlas. HUD and menu UI is usually crisper and cheaper as DOM/SVG over the canvas, because the browser renders text at native DPR.

### Cited Findings
- troika-three-text renders SDF text with derivative-based antialiasing. It parses .ttf/.otf/.woff at runtime and generates glyph SDFs on the fly (no pre-baked atlas), doing all font parsing, SDF generation and layout **in a web worker**. It patches any three.js material. The npm version is 0.52.4. It is SDF, not MSDF. — [troika-three-text README](https://cdn.jsdelivr.net/npm/troika-three-text@0.52.4/README.md); [three.js forum thread](https://discourse.threejs.org/t/troika-3d-text-library-for-sdf-text-rendering/15111)
- three-msdf-text-utils offers MSDF plus bitmap font rendering for three.js, including WebGPU (`MSDFTextNodeMaterial`) and runtime MSDF atlas generation from TTF. — [three-msdf-text-utils README](https://cdn.jsdelivr.net/npm/three-msdf-text-utils@1.5.0/README.md)

### Inferences
- The UI in this repo is DOM-based, so it already scales with DPR. Keep it that way. Use SDF text only for world-space labels (floating damage numbers, nameplates) that must sort with the 3D scene.
- SDF/MSDF atlases are single-channel or RGB distance fields, not colour art, so they should not be Basis-compressed with ETC1S. Block compression distorts distance values; keep them as uncompressed R8 or RGBA8 (they're small).

### Gaps
- I did not fetch Chlumsky's msdfgen docs for exact quality figures; no numeric comparison of SDF and MSDF memory or sharpness was gathered.
- No Babylon.js-specific docs were fetched. The Babylon forum mentions KTX2 for memory and WebP for transfer ([Babylon forum](https://forum.babylonjs.com/t/ktx2-support-for-babylon-native/60940)), but no numbers.
