# Why the battlefield stays baked sprites, not live 3D models

Every building, wall, tree and soldier on the battlefield is a three.js model, rendered once at bake time into a
sprite. A natural question when chasing sharpness is: why not draw those models live, so they are sharp at any zoom
and need no atlas? This note measures what that would cost. In short, live models would cost about **280× the
triangles and about 250× the draw calls of today's frame**, and they would lose the ink look or pay for it every
frame. What they would buy (less GPU memory, no atlas download) can be had more cheaply with compressed textures.

Measured on 20 October 2026: model sizes come from `spriteSpecs()` (every model the bake renders), and scene counts
come from the production build on the default Medium map at a Pixel 7's 412 × 839 CSS px and 2.625× density.

## What a frame draws today

| | Today (sprites) |
|---|---|
| Sprites drawn at the start of a game | 1,271 (1,082 scenery, 124 cliff faces, 29 walls, the fort, flags) |
| Draw calls | 21–24 (budget: 28 on desktop, checked by the e2e smoke set) |
| Triangles | ~9,000 (two per sprite, plus the ground, water and effects) |

The sprite layer draws the whole map every frame. It is still cheap because each sprite is one instanced quad, and
everything on an atlas page shares one draw call.

## What the same scene costs as live models

Triangles and meshes per model, sampled from the catalogue:

| Model | Triangles | Meshes | Materials |
|---|---|---|---|
| Town Hall | 24,900 | 19 | 19 |
| Buildings built into walls (gatehouse etc.) | 9,600–15,700 | 16–27 | 16–25 |
| Other buildings | 500–10,500 | 6–23 | 6–23 |
| Wall segment | 1,100–2,100 | 9–13 | 9–13 |
| Tree / rock / scenery | 160–2,450 | 2–5 | 2–5 |
| Cliff face | 5,080 | 10 | 10 |
| Soldier (swordsman, archer, pikeman, knight) | 2,500–3,200 | 15–21 | 7–9 |
| Ram / mangonel | 6,900–10,500 | 38–39 | 12–13 |

Multiplied out for the opening scene, plus a late battle: a wave-20 budget is ~240 threat, mostly 1-threat
infantry, so assume about 150 soldiers on screen with your own troops.

| | Live models | vs today |
|---|---|---|
| Scenery (1,082 × ~1,200 tris) | ~1.3 M triangles | |
| Cliffs (124 × 5,080) | ~0.63 M | |
| Fort, walls, buildings | ~0.1 M | |
| 150 soldiers × ~3,000 | ~0.45 M | |
| **Total** | **~2.5 M triangles a frame** | **~280×** |
| Meshes (≈ draw calls before any merging) | **~6,000–7,000** | **~250×** |

Phone budgets for a 60 fps game are usually given as a few hundred thousand triangles and a few hundred draw calls.
WebGL adds CPU cost per call on top of native. Instancing would merge the static scenery to a few dozen calls. But
soldiers animate part by part (8 directions × walk/attack frames today), so they would need per-part instancing or
skinning, plus a level-of-detail system. A far-zoom level of detail for small, numerous objects is an
**impostor**, a pre-rendered picture of the model on a quad, which is exactly what the sprites already are.

## The look would be lost or paid for every frame

The hand-drawn style is not in the models. It is applied by the bake (`inkStyle.js`):

- **Ink lines** come from an edge detector run over three renders of each sprite (colour, view-space normals,
  depth), at 1.5–2× supersampling, and then downscaled. Live, that means rendering a normal and a depth buffer every
  frame and running a full-screen edge pass, at 2.4 Mpx on a Pixel 7. That pass cannot afford supersampling, so the
  lines would alias and **shimmer as soldiers move**. Baked frames are stable, because each one was antialiased once.
- **Banded shading, warm shadows and hatching** are per-pixel passes over the baked colour. They would become more
  full-screen shader work.
- **Soft ground shadows** are baked with a filtered (VSM) shadow map sized per sprite. Live, the map would need a
  shadow map covering 52 tiles, redrawn whenever anything moves, and it would be blurrier per object at the same
  memory.

All the sprite-specific effects would also need rewriting for meshes: damage (soot, cracks, knocked-out pieces),
seasons (autumn leaves, snow on top edges), tree sway, and the per-sprite e2e checks.

## What live models would buy, and the cheaper way to get it

| Live models would give | Cheaper route (see 11-high-res-graphics.md) |
|---|---|
| No atlas in GPU memory: today ~325 MiB standard / ~1,010 MiB HD uncompressed with mips (since the sharper soldiers and heroes), of which ~5 / ~50 MiB of icon pages now stay off the GPU | KTX2/Basis atlases: ~75% less (standard ≈ 80 MiB) |
| No 7.5 MB / 15 MB atlas download | KTX2 ETC1S pages are small; HD pages can be streamed by zoom |
| Sharp at any zoom | Units 56 → 72 px per tile (affordable after KTX2); stream HD pages near the camera |
| Smooth turning instead of 8 directions | Not needed for a fixed isometric camera |

The memory argument is the one real case for live models. It is better met by compressing the atlases, which keeps
the look, the frame budget and every existing effect.

## When live 3D would be the right call

- If the camera had to rotate freely. A fixed isometric view is a design choice here, so it doesn't.
- For a single close-up subject, such as a hero portrait or an inspect view: one model at a time, where per-frame ink
  is affordable. That's worth trying later for hero cards, not for the battlefield.
- If the models were rebuilt as flat-shaded low-poly (a few hundred triangles each, one material), as live-3D web
  strategy games do. That would be a different art style, not the inked look in `docs/reference/art-style.jpg`.
