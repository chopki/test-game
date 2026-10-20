# Case studies: browser games and web 3D admired for graphics quality (2018–2026)

Scope note: about 30 searches and fetches. Primary sources were found for PlayCanvas/Arm Seemore, Bruno Simon's folio-2025 asset pipeline, Unity's web memory docs, the Vampire Survivors engine move, and practitioner optimisation guides. Several named targets (Krunker.io, Hordes.io, Venge.io, Lusion, Active Theory, Shell Shockers' renderer, Abeto's Messenger) have **no published technical write-up that I could find**. Their entries record only what is verifiable, and the gaps are listed. Medium (Bruno Simon's 2019 case study) and Codrops article pages returned HTTP 403 to the fetcher, so their contents are known only from search snippets.

## Q1. What did each example do to look high-res and polished?

### Takeaway
The admired web 3D pieces get their "expensive" look mostly offline. They bake lighting, AO and shadows into textures or lightmaps, use matcaps or palette textures in place of real-time lights, and rely on prefiltered environment maps for reflections. The runtime then carries few lights, few draw calls and compressed textures. Content and UI stay crisp because they live in the DOM, with WebGL behind them for atmosphere.

### Cited Findings

**Bruno Simon: portfolio (2019) and folio-2025 (Three.js)**
- folio-2025's README describes a Three.js renderer with a "palette texture" set directly on Three.js materials. Blender exports go out with the palette node muted and no compression, then `npm run compress` runs gltf-transform on GLBs — [brunosimon/folio-2025 README](https://github.com/brunosimon/folio-2025)
- folio-2025 texture pipeline: textures embedded in GLBs are compressed with Basis `etc1s --quality 255` ("lossy, GPU friendly"), and standalone PNG/JPG with `--encode etc1s --qlevel 255` through KTX-Software `toktx`. UI images are converted to WebP. Compressed output goes to new files, so the originals are kept — [folio-2025 README](https://github.com/brunosimon/folio-2025)
- folio-2025's game loop names its world systems: Lighting, DayCycles, YearCycles, Weather, Fog, Wind, Grass, Foliage, Leaves, Snow, RainLines, Lightnings, WaterSurface, Terrain, Tracks and VisualTornado. Much of the polish comes from many cheap procedural ambient systems rather than from heavy assets — [folio-2025 README](https://github.com/brunosimon/folio-2025)
- One three.js forum user says Bruno Simon's work uses procedural materials rather than baked lightmaps. This is a single unverified forum claim — [three.js forum](https://discourse.threejs.org/t/how-to-bake-light-with-textures/52076)

**Bruno Simon: "My Room in 3D" (2021, Three.js)**
- The room was modelled in Blender and shown with WebGL and Three.js. Its debug panel has a "baked" group whose `uNightMix` changes the brightness of the whole room and whose `uNaturalMix` (as the article spells it) switches colour. The lighting is therefore pre-baked textures blended in a shader, not real-time lights. Source code is at brunosimon/my-room-in-3d — [Gigazine](https://gigazine.net/gsc_news/en/20210913-my-room-in-3d)

**Three.js Journey (Bruno Simon's course): baking workflow**
- The course teaches baking a good-looking Blender render into a texture and applying it to geometry in Three.js. Preparation steps: UV-unwrap everything, unlink duplicates (linked duplicates share UVs and bake twice to the same spot), delete hidden faces, fix flipped normals (they bake black and are culled in Three.js), and apply scale before auto-unwrap so texel density stays even — [Three.js Journey: Baking and exporting the scene](https://threejs-journey.com/lessons/baking-and-exporting-the-scene)
- Colour management: Blender 4.0+ defaults to AgX rather than Filmic, and the two differ mainly in how they handle overexposed areas. Bake settings: "View From: Active Camera" and Margin type "Extend" — [Three.js Journey](https://threejs-journey.com/lessons/baking-and-exporting-the-scene)
- Forum users call this the most complete baking tutorial. They say UV unwrapping is the hard part, and that a compositor step for sRGB/Filmic output made a large visual difference — [three.js forum](https://discourse.threejs.org/t/how-to-bake-light-with-textures/52076)
- In 2025–26 Three.js Journey added a WebGPU and TSL course (21 lessons, 23 h). TSL shaders compile to both WebGPU and WebGL — [Three.js Journey WebGPU/TSL](https://threejs-journey.com/webgpu-tsl)

**Matcaps as baked lighting**
- With matcaps "you don't have to worry about placing lights or tweaking PBR options", because lighting and reflections are baked into the matcap image. Packing all matcaps into one image means the GPU is updated only once — [Offscreen Canvas: Beautiful demos with matcaps](https://offscreencanvas.com/issues/beautiful-demos-with-matcaps)

**PlayCanvas + Arm "Seemore" (2015 GDC; rebuilt and open-sourced 2019)**
- Goal: "console quality graphics on mobile" in the browser, with nothing to install, targeting Arm Mali GPUs — [PlayCanvas: The Making of Seemore](https://blog.playcanvas.com/the-making-of-seemore-webgl)
- Prefiltered cubemaps: each mip level stores reflections at a different roughness, pre-blurred on the GPU by importance sampling. Where `EXT_shader_texture_lod` is missing, the mips are stored as separate textures and interpolated manually. Box-projected (AABB) cubemaps give local, parallax-correct reflections, and refraction reuses the same code with a different ray — [The Making of Seemore](https://blog.playcanvas.com/the-making-of-seemore-webgl)
- Cheap substitutes for expensive effects: dual baked AO maps (plant mouth open and closed) interpolated at runtime, and fake foliage translucency from attenuated emission. Plant and tentacle animation is procedural, in the vertex shader — [The Making of Seemore](https://blog.playcanvas.com/the-making-of-seemore-webgl)
- The 2019 rebuild's feature list: PBR with image-based lighting, box-projected cubemaps, refraction, HDR lightmaps, interpolated pre-baked shadow maps (a "fast substitute for real-time shadow mapping"), draw-call batching, fully GPU-driven mesh animation, ETC2 textures and WebGL 2 — [PlayCanvas: Arm and PlayCanvas open source Seemore](https://blog.playcanvas.com/arm-and-playcanvas-open-source-seemore-webgl-demo)
- PlayCanvas's runtime lightmapper bakes lightmaps at app start rather than downloading them. The engine's Sponza test runs lightmapped at 60 fps on a MacBook Pro or on a Nexus 5 / iPhone 6. This is an old benchmark — [PlayCanvas: runtime lightmap generation](https://blog.playcanvas.com/runtime-lightmap-generation-for-webgl)

**Shopify Spring '26 Edition (Codrops write-up, 2026)**
- The visuals form a small rendering system on one unified canvas with many nested framebuffers, advanced by scroll. The DOM handles content and interaction, and WebGL does atmosphere, point clouds, volumetric light and scroll transitions. Video was preprocessed into KTX2 array textures for the volumetric light. Only the intro was readable: the page returned 403 to the fetcher — [Codrops: Engineering the Web Experience Behind Shopify's Spring '26 Edition](https://tympanus.net/codrops/?p=116711)
- A repost of the team's social thread (secondary, origin unverified) says they used Three.js with R3F, Rive for interactive animations and Lenis for smooth scroll. Active scenes render offscreen, and a GLSL pass composites them into the background — [rattibha thread](https://en.rattibha.com/thread/2069804262062752183)

**Active Theory v4 site (Awwwards SOTM, Jan 2018)**
- Layered effects: colour grading, depth of field, volumetric lighting, RGB shift and rain, plus a 5×5 grid of videos so switching between work pieces is instant — [Awwwards](https://awwwards.com/active-theory-v4-wins-january-2018-site-of-the-month.html)

**Lusion (Awwwards SOTM)**
- An Awwwards case study exists, but its technical content was not retrievable — [Awwwards](https://awwwards.com/case-study-for-lusion-by-lusion-winner-of-site-of-the-month-may.html)
- A third-party reverse-engineering post claims a custom GLSL refraction shader, DOM-to-canvas layout to avoid layout thrashing, and fractal-noise camera motion. These are unverified hypotheses from one author — [dev.to feed (ddw-x)](https://dev.to/feed/ddw-x)

**Abeto "Messenger" (Sept 2025, Three.js)**
- A free browser game by Vicente Lucendo and Michael Sungaila: deliver mail on a tiny spherical planet, with multiplayer interaction limited to 3D emoji. It is built with WebGL and Three.js, and models were made in Houdini and Blender. It was an Awwwards Site of the Day, and reviewers say it runs smoothly on desktop and mobile — [TechEnclave](https://techenclave.com/t/a-cool-little-browser-game-messenger/429835); [Korben](https://korben.info/ja/messenger-abeto-postman-mini-planet.html); [80.lv](https://80.lv/articles/deliver-mail-on-tiny-colorful-planet-in-this-relaxing-web-game)
- 80.lv gives no rendering details beyond "a simple web-based game made with WebGL and Three.js" — [80.lv](https://80.lv/articles/deliver-mail-on-tiny-colorful-planet-in-this-relaxing-web-game)

**Shell Shockers (Blue Wizard Digital, Babylon.js, 2017)**
- Built on Babylon.js and released on 1 Sep 2017. It had almost 40 M players by mid-2019 according to a wiki mirror; treat that figure as approximate. Its iOS/Android versions were shut down in 2024 — [Wikipedia: Shell Shockers](https://en.wikipedia.org/wiki/Shell_Shockers)

**Venge.io (PlayCanvas)**
- PlayCanvas lists it as a showcase multiplayer shooter. PlayCanvas claims "incredible performance, even on devices such as the iPhone 6 and Chromebooks", which is a vendor claim — [PlayCanvas](https://playcanvas.com/vr); [PlayCanvas forum](https://forum.playcanvas.com/t/released-lets-craft/10838)

**Kingdom Rush (Ironhide, Flash, 2011)**
- Ironhide was founded in 2010 by Álvaro Azofra, Pablo Realini and Gonzalo Sande (artist). They made several minor Flash games first, and released Kingdom Rush as a free Flash browser game on Armor Games in July 2011 — [Wikipedia: Kingdom Rush](https://en.wikipedia.org/wiki/Kingdom_Rush)
- Kingdom Rush: Frontiers' Flash version went free on Armor Games in Nov 2013 — [Triple Point PR](https://pressreleases.triplepointpr.com/2013/11/22/browser-based-kingdom-rush-frontiers-free-today-via-armor-games/)

**Vampire Survivors (Phaser, then Unity)**
- It started as a Phaser (HTML5/JS) game shipped through Electron. The developers moved to Unity on 17 Aug 2023, citing cross-platform support, "big performance improvements" and local co-op — [GamingOnLinux](https://gamingonlinux.com/2023/07/vampire-survivors-switching-to-new-game-engine-on-august-17)
- In 2022 they described the port as fixing "various performance problems" and making use of more than one CPU core — [GamingOnLinux 2022](https://gamingonlinux.com/2022/09/vampire-survivors-10-coming-october-20th-seems-a-linux-port-is-still-planned)
- Phaser's creator backed the move: JavaScript is hard to get onto consoles, and multiple codebases are a burden — [Phaser Dev Report, July 2023](https://phaser.io/devlogs/279)
- One player reports a solid 60 fps on Steam Deck through a 30-minute run on the new engine. This is anecdotal — [Tildes](https://tildes.net/~games/19ha/vampire_survivors_version_1_6_new_engine_and_local_co_op)

### Inferences
- The recurring recipe is to move lighting cost offline: baked textures (Bruno Simon, Three.js Journey), matcaps, HDR lightmaps and pre-baked shadow maps (Seemore), and palette textures (folio-2025). The runtime then spends its budget on cheap ambient motion such as wind, grass, weather and day cycles, which reads as "alive and polished" more than geometric detail does.
- Text and UI are kept out of WebGL (Shopify: DOM for content, WebGL for atmosphere). That keeps them pin-sharp at any DPR while the 3D layer can run at lower internal resolution.
- Vampire Survivors shows the ceiling for a JS 2D game. Its art never needed more fidelity; the engine move was driven by thousands of entities on screen and by console ports.

### Gaps
- **Krunker.io**: no reliable source on its renderer (Three.js is widely assumed) or its developer techniques. Search results were AI prompt pages and cheat scripts.
- **Hordes.io**: only that it is a one-developer project ("Dek") — [MMOGames](https://www.mmogames.com/articles/archives/hordes-io-preview-new-io-on-the-block). No engine or rendering details found.
- **Venge.io**: no postmortem found.
- **Shell Shockers**: no rendering write-up found (asset sizes, toon shading and so on).
- **Townscaper / Islanders**: no web ports found or confirmed.
- Not researched for lack of tool budget: Coastal World, Needle Engine showcases, Spline showcases, Pixi.js and Phaser showcase games, Google experiments, Space Pirate Trainer (it is a native VR game; no Babylon link found), PlayCanvas "After the Flood".
- Bruno Simon's 2019 Medium case study, which covers the matcaps-plus-baked-shadow floor and cannon.js physics, returned 403. Its contents are not cited here.
- Whether folio-2025 uses WebGPURenderer/TSL is not stated in its README. That is unverified.
- Seemore's total download is about 190 MB according to one archive listing — [FF Apps Archive](https://ffapps.danielherr.software/app/seemore/). The source is unverified, and it is unclear which version it refers to.

## Q2. Asset budgets, load-time tricks, adaptive quality and mobile handling

### Takeaway
Practitioner budgets cluster around roughly 100 draw calls and 100k vertices on mobile, textures at 2048 px or below in KTX2/Basis, DPR capped at 2, three or fewer dynamic lights, and small shadow maps. Unity WebGL's fixed memory overhead (around 200 MB for an empty project) is the main reason it struggles on phones compared with lean JS engines.

### Cited Findings
- **Draw calls / vertices:** budget about 100 per frame on mobile, while desktop handles several hundred to low thousands. Don McCurdy's rule of thumb is "<100 draw calls and <100,000 vertices if you can" — [Utsubo: 100 Three.js tips (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- **Texture VRAM:** a 4096² RGBA texture is 64 MiB (about 85 MiB with mips). A 200 KB PNG at 2048² becomes about 21 MiB of VRAM with mips. Keep textures at 2048 px or below unless they are hero assets. KTX2 typically uses 4–8× less GPU memory; UASTC is better for normal and ORM maps, ETC1S gives smaller files with artifacts — [Utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- KTX2 files are about 3–5× smaller than JPG/PNG and can use "sometimes 10× less GPU memory", because they stay compressed on the GPU. A typical module's asset bundle is under 1.5 MB, with targets of 60 fps on a mid-range Android and first paint under 1.5 s — [Svilenkovic: KTX2 textures](https://svilenkovic.com/3d/ktx2-textures)
- KTX 2.0 with Basis Universal supercompression is Khronos's GPU-texture format for glTF and is meant to complement Draco geometry compression — [Khronos press release](https://www.khronos.org/news/press/khronos-ktx-2-0-textures-enable-compact-visually-rich-gltf-3d-assets)
- **Geometry:** Draco cuts geometry by about 95% in many cases (87–89% on Cesium samples). Meshopt decodes faster and is the `gltf-transform optimize` default. Quantising vertices saves 35–50% — [Utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips). Draco leaves animation and morph targets untouched, so Meshopt is preferred for animated characters — [Cinevva guide](https://app.cinevva.com/guides/optimize-glb-for-web)
- **Lights and shadows:** start with 3 or fewer dynamic lights. Each PointLight shadow renders the scene 6 times. Shadow maps: 512–1024 on mobile, 1024–2048 on desktop. CSM: 2 cascades on mobile, 4 on desktop — [Utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- **Resolution:** cap with `Math.min(devicePixelRatio, 2)`, since DPR 3 means 9× the pixels of DPR 1. Half-resolution post-processing can roughly double the frame rate in fill-bound scenes. Adaptive DPR example: start at 1.5, go to 2 when frame rate rises and 1 when it drops, with a flip-flop limit of 3. `mediump` can be up to 2× faster on Adreno fragment shaders (per Qualcomm) — [Utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- **Device tiers and loading:** detect low, medium and high tiers before the first scene loads, giving weaker devices fewer particles and simpler shaders. Lazy-load with IntersectionObserver, pause the render loop when off-screen, and provide a static no-WebGL fallback. Target Lighthouse mobile 85+ and FCP under 1.5 s — [Svilenkovic: how to optimise a 3D website](https://svilenkovic.com/3d/how-to-optimize-3d-website)
- **Streaming:** the Seemore rebuild's asynchronous asset streaming made it load "in seconds", about 5× faster than the original, and ETC2 kept detailed textures small in memory — [PlayCanvas](https://blog.playcanvas.com/arm-and-playcanvas-open-source-seemore-webgl-demo)
- Runtime lightmap generation trades download size for start-up compute, because the lightmaps are generated on load instead of downloaded — [PlayCanvas](https://blog.playcanvas.com/runtime-lightmap-generation-for-webgl)
- **Unity WebGL on mobile:** an empty Unity 6 (6000.0.41f1) web build measured about 200 MB of memory in Edge, about 38.5 MB of it render textures. This is a forum anecdote — [Unity Discussions](https://discussions.unity.com/t/web-build-memory-consumption-on-unity-6/1613334)
- A developer advises targeting about 400 MiB on mobile, because iOS devices with 2–3 GiB RAM can crash above roughly 500 MiB. Textures, more than models, drive memory, and mobile and desktop often need different texture compression — [Unity Discussions](https://discussions.unity.com/t/webgl-build-setting-unity-6/1541471)
- Unity's manual: the default memory settings suit desktop, and mobile needs advanced tuning. The heap can grow to 2 GB, but auto-resizing can crash if no contiguous block is free. The `.data` file (all scenes and assets) stays uncompressed in memory during play, and AssetBundles are recommended to cut that — [Unity 6.3 manual: Web memory](https://docs.unity3d.com/Manual/webgl-memory.html)
- Brotli is generally preferred over gzip for Unity web builds — [GitNation talk](https://gitnation.com/contents/boost-the-performance-of-your-webgl-unity-games)
- A roughly 30 MB PlayCanvas test build loaded slowly on an old iPad. Compressing textures and images is the suggested fix (anecdotal and dated) — [PlayCanvas forum](https://forum.playcanvas.com/t/what-is-a-safe-maximum-memory-size-for-webgl-playcanvas-builds/2987)
- **Portal rules (Poki):** games must fill the screen on mobile in portrait and/or landscape, work in incognito mode (wrap localStorage in try/catch), and expect most external requests to be blocked — [Poki SDK requirements](https://sdk.poki.com/new-requirements)
- **WebGPU (2025–26):** Three.js WebGPURenderer needs async init (without it, rendering fails silently, per one guide) and falls back to WebGL 2 automatically. Safari 26 shipped WebGPU in Sept 2025. Global support is put at about 87%, and Chrome for Android has it from v121 on Android 12+ — [Utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips); [Svilenkovic: WebGPU + three.js](https://www.svilenkovic.com/3d/webgpu-three-js). Cited WebGPU showcases: a 1M-particle fluid installation (Hokusai, Expo 2025), and Segments.ai reporting a 100× improvement after migrating — [Utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- Sources disagree on WebGPU readiness: one calls it production-ready for most uses, another says WebGL is still the safer choice for shipping everywhere — [OpenReplay](https://blog.openreplay.com/webgpu-vs-webgl-industry-moving/); [Svilenkovic](https://www.svilenkovic.com/3d/webgpu-three-js)

### Inferences
- Texture VRAM, not download size, is usually the binding mobile constraint, because PNG/JPG expand to raw RGBA on the GPU. KTX2 (ETC1S for colour atlases, UASTC for normal maps and fine detail) is the standard fix. Bruno Simon's folio-2025 uses ETC1S at maximum quality for everything.
- A sensible phone tier based on these sources: DPR at most 2 (often 1.5), around 100 draw calls, shadow maps of 1024 or less (or baked), post-processing at half resolution, and an adaptive-DPR loop with hysteresis.
- WebGPU in 2026 matters mostly for compute (particles, simulations). The admired "beautiful" sites are still essentially WebGL-class techniques, with a WebGL 2 fallback path kept.

### Gaps
- No primary download-size figures were found for Bruno Simon's portfolio, Messenger, Krunker, Shell Shockers or Venge.
- No Poki file-size cap was found in the requirements page excerpt.
- No ETC1S-vs-UASTC numeric quality comparison was found beyond qualitative guidance.

## Q3. Sprite and 2D-isometric browser games: crisp art at varying zoom

### Takeaway
The standard practice is to ship multiple atlas resolutions (@1x and @2x, sometimes @0.5x), pick one by devicePixelRatio and zoom, use mipmaps with linear filtering for smooth zoom-out, and keep pixel art on integer or power-of-two scales. Flash-era vector games such as Kingdom Rush were resolution-independent at runtime. Their later HTML5 and mobile successors had to bake that vector art to rasters.

### Cited Findings
- **Multi-resolution atlases:** packers such as FastPack export @1x and @2x from one source set and record the scale in metadata. The app loads the variant matching devicePixelRatio through `PIXI.Assets`, and PixiJS scales sprites from that metadata — [FastPack: multi-resolution](https://www.mintlify.com/Hexeption/FastPack/packing/multi-resolution)
- PixiJS historically read a texture's resolution from an "@2x" filename suffix (v2-era behaviour; check against the current version) — [html5gamedevs: Pixi resolution questions](https://www.html5gamedevs.com/topic/16060-pixi-resolution-questions/)
- **Mipmaps:** enabling mipmaps helps downscaled sprites, "might look better or worse". In older Pixi, mipmaps needed power-of-two textures; on WebGL 2, mipmaps work at any size — [html5gamedevs: crisp sprites at non-source resolution](https://html5gamedevs.com/topic/45121-how-to-make-sprites-look-crisp-in-non-source-resolution)
- Scaling by multiples of 2 keeps pixels aligned, which suits pixel art but looks poor for smooth artwork. One user found large sprites still looked crisp at about 1% scale — [html5gamedevs: sharpness when downscaling](https://html5gamedevs.com/topic/43947-maintaining-sharpness-while-downscaling-large-sprites)
- Provide smaller or multiple-resolution atlas variants for sprites shown only at small sizes, to avoid loading unnecessary detail — [Abratabia: PixiJS sprites and textures](https://abratabia.com/pixijs/sprites-and-textures.php)
- GPU-compressed textures for Pixi (DDS/PVR/ETC/ASTC loaders) exist as a plugin — [pixi-compressed-textures](https://www.npmjs.org/package/pixi-compressed-textures)
- HiDPI resize problems (the canvas backing store not matching DPR) are a recurring forum topic — [html5gamedevs: resize HiDPI issues](https://html5gamedevs.com/topic/27548-resize-hidpi-issues); content-scale factor with retina and non-retina atlases — [html5gamedevs](https://html5gamedevs.com/topic/11267-content-scale-factor-with-retinanon-retina-texture-atlas)

### Inferences
- A game drawing pre-baked sprites into a 3D-camera world (as this project does) would face the same problem as Pixi games at variable zoom. The equivalent solution is at least two atlas scales (a regular and an HD atlas), a selection rule based on screen pixels per world unit (zoom × DPR), and mipmapped linear sampling for zoom-out.
- Kingdom Rush's Flash origin explains its crisp look at any size: Flash rendered vectors at runtime. Today's equivalents are high-resolution baked atlases or runtime vector rasterisation into atlases (vector to raster at load, at the needed scale).

### Gaps
- No primary Ironhide source on how the Flash vector art was converted for HTML5 and mobile.
- No Phaser- or Pixi-official docs fetched on `roundPixels`, `pixelArt` and resolution handling (tool budget).
- No source found on runtime SVG-to-atlas rasterisation in a shipped browser game.

## Q4. Lessons and pitfalls reported by developers

### Takeaway
Most of the reported pain is in content preparation (UV unwrapping, normals, colour management for bakes), in mobile memory (textures and the Unity heap), and in performance scaling when entity counts grow, which pushed Vampire Survivors off JS. Few studios publish detailed postmortems. Practitioner guides and engine blogs are the main written record.

### Cited Findings
- Baking pitfalls: flipped faces bake black and are culled; linked duplicates double-bake into the same UVs; unapplied scale gives uneven texel density; removing faces after unwrapping causes problems — [Three.js Journey](https://threejs-journey.com/lessons/baking-and-exporting-the-scene)
- UV unwrapping is "the hard part", and correct colour-managed (Filmic/sRGB) output makes a large visual difference — [three.js forum](https://discourse.threejs.org/t/how-to-bake-light-with-textures/52076). One tutorial estimates 4–8 h per scene for baking (single-site estimate) — [Svilenkovic: how to bake lighting](https://svilenkovic.com/3d/how-to-bake-lighting-for-web)
- A glTF exported from Blender often does not match Blender's render without baking, a common complaint — [three.js forum](https://discourse.threejs.org/t/the-glb-format-exported-by-blender-cannot-achieve-the-rendering-effect-of-blender-after-uploading/47976)
- PointLight shadows silently multiply draw calls: 2 PointLights on 10 objects add 120 draws — [Utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- Unity web: auto heap growth can crash when no contiguous memory block is available, and mobile needs manual memory tuning — [Unity manual](https://docs.unity3d.com/Manual/webgl-memory.html)
- Vampire Survivors: the JS/Electron build hit performance limits and console-port barriers, which led to the Unity rewrite — [GamingOnLinux](https://gamingonlinux.com/2023/07/vampire-survivors-switching-to-new-game-engine-on-august-17); [Phaser devlog](https://phaser.io/devlogs/279). The developer later said they would not return to Unity after its pricing controversy — [Shazoo](https://shazoo.ru/2023/09/27/148148/razrabotcik-vampire-survivors-ne-budet-vozvrashhatsia-na-unity)
- Shell Shockers' early performance was described as "horrible" by players (informal) — [Wikipedia mirror / search snippet](https://en.wikipedia.org/wiki/Shell_Shockers)
- Seemore: without `EXT_shader_texture_lod`, prefiltered reflections need a manual fallback. Feature-detect and degrade rather than assume — [PlayCanvas](https://blog.playcanvas.com/the-making-of-seemore-webgl)
- Folio-2025 keeps uncompressed originals and writes compressed copies, so it can re-run compression with different settings — [folio-2025 README](https://github.com/brunosimon/folio-2025)

### Inferences
- For a sprite-baked game, the analogue of "bake in Blender, ship a texture" is already in place. The lessons that carry over are colour management consistency between the bake and the runtime, keeping the source art uncompressed so it can be re-baked, and budgeting VRAM rather than download size.
- Strong visuals plus phone performance come from controlling counts (draw calls, lights, DPR) more than from asset fidelity.

### Gaps
- No first-party postmortems found for Krunker, Hordes.io, Venge.io, Shell Shockers, Messenger or Lusion and Active Theory projects.
- GDC and JSConf talks on browser game graphics were not located (tool budget).
