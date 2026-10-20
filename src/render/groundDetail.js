import * as THREE from 'three';

/**
 * Close-up detail on the painted ground (level of detail zoomed in): the painted ground has GROUND_PX pixels a tile,
 * which stretch when the camera is close, so a fine tiling texture of grass strokes and mottling (grey round
 * mid-tone, multiplied in at 2×) fades in as it zooms in. Kept off water by the painted water mask. Shared by the
 * flat ground and the raised plateau tops.
 */

/** Zoom (camera.zoom) where the detail starts to show, where it's at full strength, and how strong that is. */
export const GROUND_DETAIL_ZOOM = { from: 1.3, to: 2.4, strength: 0.55 };
/** Tiles each repeat of the detail texture covers. */
const REPEAT_TILES = 2;

let cachedTexture = null;

/** The tiling detail texture: soft mottling, then short grass strokes in light and dark (grey = no change). */
export function groundDetailTexture() {
  if (cachedTexture) return cachedTexture;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, S, S);
  let seed = 9173;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // Draw each mark nine times, offset by the texture's size, so it tiles without seams.
  const wrap = (draw) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) draw(ox, oy);
  };
  for (let i = 0; i < 90; i++) {
    const [x, y, r] = [rnd() * S, rnd() * S, 8 + rnd() * 22];
    const v = rnd() < 0.5 ? 96 : 156;
    wrap((ox, oy) => {
      const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grad.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
      grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = grad;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }
  g.lineCap = 'round';
  // (Bold enough to survive the camera's slant: seen at an angle the texture is sampled a level or two down.)
  for (let i = 0; i < 420; i++) {
    const [x, y] = [rnd() * S, rnd() * S];
    const len = 4 + rnd() * 7;
    const lean = (rnd() - 0.5) * 0.9;
    const dark = rnd() < 0.62;
    const v = dark ? 30 + rnd() * 30 : 200 + rnd() * 30;
    g.strokeStyle = `rgba(${v},${v},${v},${dark ? 0.8 : 0.65})`;
    g.lineWidth = 1.6 + rnd() * 1.2;
    wrap((ox, oy) => {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + lean * len, y + oy - len);
      g.stroke();
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 2; // the ground is squashed about 1.6:1 on screen (see Renderer's ground texture)
  cachedTexture = tex;
  return tex;
}

/**
 * Add the detail to a ground material (a MeshBasicMaterial with the painted ground as `map`). `uniforms` is shared
 * by every material it's added to, so one `strength` value fades them all: { detail, waterMask, strength }.
 * Keeps any onBeforeCompile the material already has (see pushDepth in hills.js).
 */
export function addGroundDetail(material, uniforms) {
  const before = material.onBeforeCompile;
  const beforeKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    Object.assign(shader.uniforms, { uDetail: uniforms.detail, uWaterMask: uniforms.waterMask, uDetailStrength: uniforms.strength });
    shader.vertexShader = `varying vec2 vDetailUv;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n  vDetailUv = (modelMatrix * vec4(transformed, 1.0)).xz / ${REPEAT_TILES.toFixed(1)};`,
    );
    shader.fragmentShader = `uniform sampler2D uDetail;\nuniform sampler2D uWaterMask;\nuniform float uDetailStrength;\nvarying vec2 vDetailUv;\n${shader.fragmentShader}`.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
  if (uDetailStrength > 0.0) {
    float dry = 1.0 - texture2D(uWaterMask, vMapUv).r;
    vec3 d = texture2D(uDetail, vDetailUv).rgb * 2.0;
    diffuseColor.rgb *= mix(vec3(1.0), d, uDetailStrength * dry);
  }`,
    );
  };
  material.customProgramCacheKey = () => `groundDetail:${beforeKey ? beforeKey.call(material) : ''}`;
  return material;
}

/** The detail's strength at camera zoom `zoom` (0 below GROUND_DETAIL_ZOOM.from). */
export function groundDetailStrength(zoom) {
  const { from, to, strength } = GROUND_DETAIL_ZOOM;
  const t = Math.min(1, Math.max(0, (zoom - from) / (to - from)));
  return t * t * (3 - 2 * t) * strength;
}
