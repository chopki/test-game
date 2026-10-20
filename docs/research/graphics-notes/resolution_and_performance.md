# Render resolution, anti-aliasing, post-processing and performance for browser games (WebGL/WebGPU, focus on phones, state as of Oct 2026)

Note on method: about 25 searches and fetches. Primary sources were web.dev, the WebKit blog, the three.js docs and forum, the pmndrs/drei docs, the PlayCanvas manual, the Arm developer blog and the Imagination (PowerVR) docs. Some claims come only from secondary or SEO-style guides; each one is flagged where it appears. Repo context (Hold the Hall) is noted only under Inferences.

## 1. devicePixelRatio handling and dynamic/adaptive resolution

### Takeaway
Pixel count grows with the square of DPR. Native DPR on a phone (around 2.6 to 3x) means roughly 7 to 9 times the fragment work of DPR 1. Engines and the community handle this the same way: cap DPR (commonly at 1.5 to 2), choose it by device tier, or adjust it at runtime with a frame-rate controller that has a dead band (hysteresis) and a limit on oscillation. No official source gives a single "correct" cap.

### Cited Findings
- On three.js, `setPixelRatio(window.devicePixelRatio)` on iOS gave about 40 fps with a single mesh, and removing it restored 60 fps. The explanation in the thread is that DPR 2 renders at twice the resolution on each axis, and "even with simple scenes this can kill performance." — [three.js forum: Low fps on iOS with devicePixelRatio](https://discourse.threejs.org/t/low-fps-on-ios-mobile-with-pixel-ration-set-as-window-devicepixelratio/4963)
- Going from DPR 1 to 2 renders 4x the pixels. Fill-rate-bound scenes may default to a clamped DPR of about 1.5. Fractional ratios "give you a slightly blurred image" but "doesn't always look bad" on HiDPI screens. One developer had to clamp the total pixel count below 4K: with browser zoom, `innerWidth` reported 7200 at DPR 2, so the canvas was 14400 px wide. PR #31942 adds a manual section on limiting internal resolution, and issue #31943 traces zoom growth in the examples to a missing `setPixelRatio` call in their resize logic. — [three.js forum: HiDPI + fractional scaling pitfalls](https://discourse.threejs.org/t/hidpi-fractional-scaling-performance-pitfalls-and-best-practices/87114)
- A common community heuristic, not official: `Math.min(dpr, 1.5)` on mobile and `Math.min(dpr, 2)` on desktop. — [community skill file via search](https://agentskills.so/skills/ovachiever-droid-tings-threejs-graphics-optimizer) (low authority)
- **drei PerformanceMonitor** defaults: `ms: 250` (averaging window), `iterations: 10`, `threshold: 0.75`, `bounds: refreshrate => refreshrate > 90 ? [50, 90] : [50, 60]` (fps band in which neither callback fires, i.e. the hysteresis), `flipflops: Infinity` (after N incline/decline swings it calls `onFallback`), `factor: 0.5`, `step: 0.1`. Example: start at DPR 1.5, `onDecline` sets 1 and `onIncline` sets 2. The gradual version uses `onChange(({factor}) => setDpr(0.5 + 1.5*factor))`, clamped to 0.5 to 2. The docs say to change quality gradually so it settles inside the bounds. — [drei PerformanceMonitor docs](https://drei.docs.pmnd.rs/performances/performance-monitor)
- **PlayCanvas** sets this through `pc.GraphicsDevice#maxPixelRatio`, which can change at runtime. The manual's example uses `window.devicePixelRatio` on high-tier devices and 1 on low-tier ones. Tier comes from a short startup benchmark or `unmaskedRenderer` (the GPU name, which may be empty on some browsers). On the forum, people advise a cap between 1 and 2 and warn that 1 looks too blurry on iPhone X-class screens; one user found text blurry below 2. — [PlayCanvas manual: runtime devicePixelRatio](https://developer.playcanvas.com/user-manual/optimization/runtime-devicepixelratio/); [PlayCanvas forum](https://forum.playcanvas.com/t/solved-ui-is-blurry-on-mobile/12063)
- **Babylon SceneOptimizer** documentation (old wiki, about 2014 to 2017): `targetFrameRate` defaults to 60 and `trackerDuration` (measurement interval) to 2000 ms. It applies optimizations in priority order and stops once the target is reached. `HardwareScalingOptimization(priority, maxScale)` lowers render resolution, e.g. `new HardwareScalingOptimization(0, 4)`. — [Babylon SceneOptimizer wiki mirror](https://gitea.com/rfactor/Babylon.js/wiki/How-to-use-SceneOptimizer-tool) (old, so current defaults may differ)
- Imagination (PowerVR) recommends skipping anti-aliasing entirely on high-PPI displays and following a "good enough" principle. — [Imagination: MSAA performance](https://docs.imgtec.com/performance-guides/graphics-recommendations/html/topics/msaa-performance.html)

### Inferences
- At DPR 3 a 412x915 CSS-px phone (Pixel 7-class) is about 1236x2745, roughly 3.4 Mpx, which is close to 1440p desktop fill. A cap of 2 cuts that to about 1.5 Mpx (44%) and a cap of 1.5 to about 0.85 Mpx (25%). This is arithmetic from the square law cited above.
- A good controller combines (a) a frame-time average over hundreds of ms, (b) a dead band like drei's [50, 60], (c) small steps (around 0.1 to 0.25 DPR) and (d) a flip-flop limit that freezes the value after it oscillates.
- Repo context: Hold the Hall already has `src/render/dynamicResolution.js`. `AUTO_RESOLUTION = { min: 0.5, max: 2, startTouch: 0.75, startDesktop: 1 }` (`src/render/graphicsSettings.js:122`), with max clamped to `window.devicePixelRatio`. The high preset uses `'native'`. So "sharper on phones" probably means raising `startTouch` and `max` on capable devices, or upscaling with sharpening (section 3), rather than building a new controller.

### Gaps
- I found no published benchmarks of fps against DPR cap (1.5 vs 2 vs 3) on specific phones.
- I did not fetch Unity WebGL's resolution guidance or the current Babylon docs; the old wiki may be outdated.
- `devicePixelContentBoxSize` / ResizeObserver for exact device-pixel canvas sizing was not covered by the sources I read.

## 2. Anti-aliasing options (MSAA, FXAA, SMAA, TAA, alpha-to-coverage)

### Takeaway
On tile-based mobile GPUs, 4x MSAA is cheap in bandwidth because samples are resolved on-chip. The cost appears in more tiles to process (vertex/tiler work), in blended edges, and in WebGL's case in extra render targets when post-processing is used. 2x is "virtually free" on PowerVR, while 4x "noticeably" costs there. At DPR of 2 or more, many vendors and engines treat AA as optional. Alpha-to-coverage needs an MSAA context and is the standard fix for alpha-tested foliage and sprites.

### Cited Findings
- PowerVR: "2x MSAA is virtually free on most PowerVR graphics cores (Rogue and Volcanic onwards)"; "4x MSAA+ will noticeably impact performance." Higher sample counts shrink tiles from 32x32 to 32x16 to 16x16 pixels, which means more tiles and more tiler/vertex cost. Blending on edges is costly because "the blending is performed for each sample by a shader in software." MSAA resolves in on-chip memory before write-out. — [Imagination: MSAA performance](https://docs.imgtec.com/performance-guides/graphics-recommendations/html/topics/msaa-performance.html)
- Arm/Khronos Vulkan sample (via search summary; the page returned 403 when fetched): 4x MSAA is efficient on tilers when the multisampled attachment is resolved in tile memory and kept transient. It added about 3% bandwidth in the sample's measurements. A separate explicit resolve (`vkCmdResolveImage`) is "extremely expensive" bad practice. Sample-rate shading turns MSAA into much costlier supersampling. — [Vulkan Samples: MSAA](https://docs.vulkan.org/samples/latest/samples/performance/msaa/README.html) (secondhand)
- A forum report says 4x MSAA on Mali-G72 had essentially no performance impact (anecdotal). — [Arm community forum](https://community.arm.com/support-forums/f/cn-discussions/9263/shader-mali-g72-4xmsaa)
- three.js `Material.alphaToCoverage` works only in MSAA-enabled contexts (`antialias: true`) and smooths alphaTest-clipped edges, which makes it the fit for dense foliage and cutout sprites. `alphaHash` is a sort-free stochastic alternative that adds grain and needs TAA (e.g. `TAARenderPass`) to look clean. The alpha-hash proposal suggests a hash scale of 0.1 to 0.5 with MSAA and 1.0 without. — [three.js Material docs (mirror)](https://neofixer.arizona.edu/css/CSSOrbit/asteroidJS/three/docs/api/en/materials/Material.html); [three.js forum: alpha test vs alpha hash](https://discourse.threejs.org/t/alpha-test-vs-alpha-hash/44493); [three.js forum: alphaHash vs transparent](https://discourse.threejs.org/t/how-to-make-alphahash-material-transparency-visually-same-as-transparent-property-has/53350); [Wikipedia: Alpha to coverage](https://en.wikipedia.org/wiki/Alpha_to_coverage)

### Inferences
- With WebGL, `antialias: true` gives MSAA only on the default framebuffer. Once the scene goes through a post-processing render target, MSAA needs a multisampled render target (`samples: 4` in three.js) plus a blit/resolve, which on tilers can mean exactly the costly extra resolve the Arm sample warns about. This comes from general WebGL2 knowledge; I did not find a direct source in this session.
- For pre-baked sprite billboards (Hold the Hall's battlefield), geometric edges are mostly quads, and aliasing comes from alpha cutouts and texture minification. Alpha-to-coverage (with MSAA) or premultiplied-alpha blending with good mipmaps matters more than FXAA/SMAA. FXAA would blur the inked sprite art.
- Supersampling for screenshots: render to an offscreen target at 2 to 4x and downsample. This is standard practice; no specific source was fetched.

### Gaps
- I found no measured mobile-browser numbers comparing FXAA, SMAA and TAA (ms per frame at phone resolutions).
- Pixel-art-specific guidance (nearest sampling, integer scaling) was not researched in depth.
- I found no Apple GPU (A-series) MSAA guidance in this pass; Apple GPUs are also tile-based (TBDR).

## 3. Upscaling and sharpening (FSR1, CAS), lower-res 3D with native UI

### Takeaway
three.js now ships an official FSR 1 (EASU + RCAS) node for its TSL/WebGPURenderer pipeline. Its docs say to use it only when fragment-bound, because it adds overhead. The cheap, standard alternative is to render the 3D canvas at reduced DPR and keep text and UI as DOM at native resolution. That keeps UI sharp while the 3D layer is upscaled by the browser compositor (bilinear) or by a sharpening pass.

### Cited Findings
- `FSR1Node` (three.js addon, `three/addons/tsl/display/fsr1/FSR1Node.js`): EASU takes 12 taps in a cross pattern to find edge direction and shapes a Lanczos2-like kernel into an edge-aligned ellipse. RCAS uses a 5-tap cross with per-pixel limiting. `sharpness` defaults to 0.2 (0 is maximum, 2 is none) and `denoise` to false; output size is set with `setSize(w, h)`. Docs: use only when the application is fragment-shader bound and can't afford full resolution, because simple scenes render faster at native resolution; it needs an anti-aliased input. It is TSL-based, so practically it belongs to the WebGPURenderer/node pipeline (which can still run on its WebGL2 backend). — [three.js docs: FSR1Node](https://threejs.org/docs/pages/FSR1Node.html)
- AMD guidance: put FSR1 after anti-aliased rendering and tone mapping, and before noise-introducing post (film grain etc.). RCAS input must not be negative, or it outputs NaN. The official repo targets DX12/Vulkan, with no WebGL target. — [AMD GPUOpen FSR1](https://gpuopen.com/?p=69665); [FidelityFX-FSR v1.0.2](https://github.com/GPUOpen-Effects/FidelityFX-FSR/releases/tag/v1.0.2)
- PlayCanvas forum users report that UI and text look blurry when maxPixelRatio is below about 2 on phones, which is the problem that putting the UI in the DOM avoids. — [PlayCanvas forum: UI blurry on mobile](https://forum.playcanvas.com/t/solved-ui-is-blurry-on-mobile/12063)

### Inferences
- For a classic WebGLRenderer project like this repo, porting RCAS alone is the cheapest option: a single 5-tap full-screen pass, on top of a canvas rendered at, say, 0.75 to 1.5x DPR. It is a small GLSL shader. EASU's 12 taps are more expensive, and on phones the bilinear compositor upscale plus RCAS is likely most of the benefit. This is not benchmarked.
- Any upscale or sharpen pass is an extra full-screen pass, which costs bandwidth on tilers (section 4). It pays off only if it lets the internal resolution drop by enough. Rough break-even: at 1.5 vs 2 DPR, the scene pass shades 44% fewer pixels; the sharpen pass reads and writes the output resolution once.

### Gaps
- I found no standalone WebGL1/2 FSR1 or CAS ports with benchmarks; Shadertoy-style ports exist anecdotally but were not verified.
- I found no mobile numbers for FSR1Node cost.

## 4. Post-processing cost on mobile (tile-based GPUs, formats, CSS filters)

### Takeaway
On tile-based GPUs (Mali, Adreno, PowerVR, Apple), most of the cost of a full-screen pass is DRAM bandwidth: writing the scene out, then reading it back. Rules: clear every attachment at the start, invalidate depth/stencil (and MSAA buffers) at the end, never rebind a render target mid-frame, and fold effects such as grading, vignette and sharpening into one pass or into the material shaders. CSS filters on the canvas run in the browser compositor on the GPU, and old evidence says they hurt on mobile.

### Cited Findings
- Arm (Mali): call `glClear` on every attachment at the start of each render target's sequence, clearing the whole surface, not a scissored part, so the old contents aren't read back. Call `glInvalidateFramebuffer` for transient attachments (depth in most 3D) at the end of the FBO's rendering, before unbinding, in the same frame, because next frame is "too late." Binding, unbinding and rebinding an FBO within a frame (incremental rendering) costs an estimated "+400% bandwidth penalty" (32-bpp color, D24S8) compared with a single pass. — [Arm: Mali performance 2, how to correctly handle framebuffers](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/mali-performance-2-how-to-correctly-handle-framebuffers)
- Arm 2025 best-practice talk: optimize render-pass load/store ops and avoid storing MSAA data to DRAM. — [Vulkanised 2025, Pete Harris (Arm): Mobile best practices](https://www.vulkan.org/user/pages/09.events/vulkanised-2025/T18-Pete-Harris-Arm-MobileBestPractices.pdf); [Arm Mali best practices guide](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/arm-mali-best-practices)
- Chromium applies CSS filters on WebGL/canvas layers in the GPU compositor. Older docs say the GPU path is used for animated filters only while they animate. — [Chromium: Filter Effects design doc](https://www.chromium.org/developers/design-documents/image-filters/) (old)
- A developer found CSS filters with animation fine on desktop but poor on mobile. — [A Faster Web: CSS filters and mobile performance (2016)](https://www.afasterweb.com/2016/01/31/css-filters-and-mobile-performance/) (old)

### Inferences
- For a phone, prefer color grading baked into the sprite atlas or applied in the sprite/material fragment shader (zero extra passes) over either a full-screen grading pass or a CSS `filter` on the canvas. A CSS filter forces the compositor to run an extra filter over the canvas texture every frame at full device resolution. That size is not reduced by the canvas's internal DPR, because the filter runs on the composited layer, though the exact behavior depends on the browser.
- If post is needed, use a single combined uber-pass. An RGBA8 render target is enough without HDR bloom; half-float (RGBA16F) doubles bandwidth per pixel (8 vs 4 bytes) and needs `EXT_color_buffer_half_float` / `EXT_color_buffer_float` in WebGL2. This comes from general knowledge, not fetched this session.
- WebGL exposes `gl.invalidateFramebuffer` (WebGL2). three.js does not call it automatically for every render target as far as I know (unverified); a custom pipeline can.

### Gaps
- I found no recent (2024 to 2026) measurements of CSS filter compositing cost on Chrome Android or iOS Safari.
- I found no measured per-pass ms cost at phone resolutions on specific Adreno/Mali/Apple GPUs.
- I did not fetch the Qualcomm Adreno or Apple Metal TBDR guides; Arm and PowerVR are representative but not exhaustive.

## 5. WebGPU in 2026: availability, Three.js maturity, real gains, fallbacks

### Takeaway
As of late 2025 WebGPU ships in all major engines: Chrome/Edge desktop (113+), Chrome Android (121+, Android 12+, Qualcomm/Arm GPUs), Safari 26 on macOS, iOS, iPadOS and visionOS, and Firefox on Windows (141+) and Apple-silicon macOS (145+). It is still missing on Firefox Android, Linux, and older or unsupported Android GPUs, so a WebGL2 fallback remains mandatory. Gains are real for CPU/draw-call-bound scenes (hundreds to thousands of draw calls) and for compute, and marginal for fill-bound scenes with few draw calls.

### Cited Findings
- web.dev (25 Nov 2025): Chrome/Edge 113+ on Windows (D3D12), macOS and ChromeOS; Chrome 121+ on Android 12+ with Qualcomm or Arm GPUs; Firefox 141+ on Windows; Firefox 145+ on macOS Tahoe 26 ARM64; Linux, Android and Intel Macs in progress for Firefox; Safari 26 on macOS, iOS, iPadOS and visionOS 26. Three.js and Babylon.js support WebGPU. Babylon Snapshot Rendering (GPU render bundles) "can help render scenes approximately 10 times faster." — [web.dev: WebGPU is now supported in major browsers](https://web.dev/blog/webgpu-supported-major-browsers)
- WebKit (WWDC25): WebGPU "supersedes WebGL" on Apple platforms and is recommended for new sites. It maps closely to Metal, while WebGL has translation overhead. Validation was streamlined to reduce overhead. Babylon.js, Three.js, Unity, PlayCanvas, Transformers.js and ONNX Runtime "all work great" in Safari 26. — [WebKit blog: News from WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- A secondary source says Firefox Android is targeted for late 2026 (unverified). — [cinevva guide](https://app.cinevva.com/guides/webgpu-vs-webgl-games) (low authority)
- three.js `WebGPURenderer` (`three/webgpu`) falls back to a WebGL2 backend automatically. Compute and some features don't work on the fallback. GitHub issue #31950 reports render-target copy failing on the WebGL fallback. It must `await renderer.init()` (async init), or a black canvas results, as reported on Firefox Linux. Maturity claims vary by blog ("production-ready since r171"; "the recommended path as of r185"), with no single official statement found. — [three.js forum: R3F WebGPU, WebGL2 fallback](https://discourse.threejs.org/t/r3f-webgpu-webgl2-fallback-tree-shaking/87188); [three.js issue #31950](https://github.com/mrdoob/three.js/issues/31950); [Utsubo migration guide 2026](https://www.utsubo.com/blog/webgpu-threejs-migration-guide); [buildmvpfast: Firefox caveat](https://www.buildmvpfast.com/blog/threejs-webgl-to-webgpu-renderer-migration-2026) (blogs)
- Benchmarks: ICS Media (MacBook Air M1, Chrome 113) at 10,000 draw calls measured WebGL about 30 fps and WebGPU about 50 fps. The GL2GPU paper (WWW 2025), a WebGL-to-WebGPU translation layer, reports a 45.05% average frame-time reduction across devices on three benchmarks. Secondary guides say differences are marginal below about 100 draw calls and meaningful at 500 or more (unverified). — [ICS Media: WebGPU beyond WebGL](https://ics.media/en/entry/230426/); [GL2GPU, WWW 2025](https://chatpaper.com/paper/129919); [cinevva guide](https://app.cinevva.com/guides/webgpu-vs-webgl-games)

### Inferences
- For a sprite-heavy game already batched with instancing (low draw-call count) and mostly fill-bound on phones, switching to WebGPU will likely bring little fps gain. Lower DPR, less overdraw and fewer passes matter more. WebGPU's value would be render bundles, compute (e.g. GPU culling or particles) and lower CPU overhead on iOS.
- Migrating to `WebGPURenderer` means rewriting ShaderMaterial/onBeforeCompile code in TSL, and the WebGL2 fallback path has to be tested (bugs like #31950).

### Gaps
- I found no reliable three.js-specific mobile WebGPU vs WebGL benchmarks.
- The three.js manual page for WebGPURenderer returned 404 at the URL tried, so the official maturity wording was not confirmed.
- The Chrome Android device-coverage share (what fraction of Android phones get WebGPU) was not found.

## 6. Frame pacing, power, thermal, OffscreenCanvas

### Takeaway
Browsers control the rAF rate. Chrome follows the display (90/120 Hz on many phones), Safari historically pins to 60 Hz, and iOS throttles rAF to 30 fps in Low Power Mode and in cross-origin iframes until the user interacts. A software fps cap (skip frames by timestamp inside rAF) is the only portable way to save battery and heat. OffscreenCanvas plus worker rendering is supported everywhere since Safari 16.4, but there are Safari jank reports and it complicates input and DOM work.

### Cited Findings
- iOS throttles rAF to 30 fps in Low Power Mode and in cross-origin iframes; the iframe cap clears after user interaction. — [Popmotion: When iOS throttles requestAnimationFrame to 30fps](https://popmotion.io/blog/20180104-when-ios-throttles-requestanimationframe) (2018)
- In low power mode rAF drops to about 30 fps and there is no way to override it. — [GreenSock forum](https://greensock.com/forums/topic/26826-any-way-to-keep-gsap-running-at-60fps-while-mobile-device-is-in-low-power-mode/)
- Chrome runs rAF at the hardware refresh rate and Safari at 60 Hz. For a fixed cap, accumulate delta time and render only once 1/60 s (or 1/30 s) has elapsed. — [Babylon forum: FPS capping at 30 or 60](https://forum.babylonjs.com/t/fps-capping-at-30-or-60-fps/50578)
- Unity's mobile guidance: leave about 35% frame idle time to limit heat. 60 fps drains the battery about twice as fast as 30 fps. — [Unity: Best practices for profiling game performance](https://unity.com/how-to/best-practices-for-profiling-game-performance)
- Android native (ADPF Game Mode): throttling 60 to 30 or 40 fps can cut GPU power by up to 50% (native, not browser). — [Android developers: FPS throttling](https://developer.android.com/games/optimize/adpf/gamemode/fps-throttling)
- OffscreenCanvas is supported from Safari 16.4. Worker rAF is vsync-bound. — [web.dev: OffscreenCanvas](https://web.dev/articles/offscreen-canvas); [Chromium Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/hRZ_P2o-aEk/m/oPEmHWFLAwAJ). A WebKit bug (Nov 2023, Safari 17.1) reports janky rAF-driven WebGL on both the main thread and OffscreenCanvas; I saw no resolution. — [WebKit bug 265038](https://bugs.webkit.org/show_bug.cgi?id=265038)

### Inferences
- On 120 Hz Android phones, an uncapped loop renders twice the frames of a 60 Hz iPhone, so a default cap of 60 on touch devices (with a 30 option) is the sensible battery and thermal choice. Repo context: the low/medium presets already set `fpsCap: 30/60`, and high is uncapped.
- Dynamic resolution and an fps cap interact. With a 60 cap, the resolution controller should measure GPU/CPU frame time (work time), not the capped interval, or it will never raise DPR. This is design reasoning, not sourced.
- Thermal throttling tends to show up after minutes of play, so a controller that only steps DPR down without ever stepping up can stay low after the device cools. Hysteresis with periodic re-probing (drei's incline) fixes this.

### Gaps
- I found no authoritative data on mobile browser rAF behavior at 120 Hz in Safari 26 (ProMotion) as of 2026.
- I found no web-specific measurements of battery savings from fps caps.
- I found no current status for WebKit bug 265038.

## 7. Sprite-heavy rendering: instancing, texture arrays, draw calls, overdraw, premultiplied alpha

### Takeaway
I gathered little primary-source material on this question in this session. What I found: blended (transparent) pixels are expensive on tilers, especially at MSAA edges. Opaque geometry should go first, and alpha-tested or alpha-to-coverage cutouts avoid sorting. WebGPU mainly helps when draw calls are in the hundreds to thousands.

### Cited Findings
- Use blending sparingly, and submit all opaque geometry first. Blending at MSAA edges is per-sample in software on PowerVR. — [Imagination: MSAA performance](https://docs.imgtec.com/performance-guides/graphics-recommendations/html/topics/msaa-performance.html)
- `alphaHash` avoids sorting problems of `transparent` at the cost of noise, and `alphaToCoverage` gives smooth alpha-test edges with MSAA. — [three.js forum: alpha test vs alpha hash](https://discourse.threejs.org/t/alpha-test-vs-alpha-hash/44493)
- Draw-call ranges: WebGL is fine up to about 1,000 to 3,000 per frame, and WebGPU is said to handle 10,000 to 50,000 (unbacked secondary claim). At 10,000 draw calls on M1, WebGL ran about 30 fps vs WebGPU about 50 fps. — [cinevva guide](https://app.cinevva.com/guides/webgpu-vs-webgl-games) (low authority); [ICS Media](https://ics.media/en/entry/230426/)

### Inferences
- For mobile WebGL, a widely used rule of thumb is to keep draw calls in the low hundreds per frame. No primary source was found for this, so treat it as unverified. Hold the Hall's e2e suite already enforces a draw-call budget.
- Overdraw from large transparent sprite quads (fog, clouds, effects) is usually the main fill cost at high DPR. Trimming quads to the opaque hull, or using alpha-test where blending isn't needed, cuts it.
- Premultiplied alpha (blend `ONE, ONE_MINUS_SRC_ALPHA`) avoids dark fringes when mipmapping or bilinear-filtering sprite atlases, and it is required for correct compositing with `premultipliedAlpha: true` canvases. This is general knowledge, not sourced here.

### Gaps
- I found no primary sources this session for WebGL2 texture arrays vs atlases (performance on mobile), mobile draw-call budgets, or premultiplied-alpha guidance (e.g. the WebGL Fundamentals, Arm or Apple guides). Further research is needed for numbers.
