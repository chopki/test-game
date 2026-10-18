import * as THREE from 'three';

// Arrows in flight drawn as ink strokes (Settings → Arrows): a thin dark shaft with a pale trail fading out behind
// it, both flat on the screen and laid along the direction of flight. A volley is three of them side by side,
// staggered a little, so a tower's fire reads as a flight of arrows. (Settings 'classic' keeps the 3D arrow.)

const SHAFT = { length: 0.42, width: 0.045 };
const TRAIL = { length: 1.1, width: 0.05 };
/** Where each arrow of a volley flies, relative to the real one: sideways and back along the flight (scene units). */
const VOLLEY = [[0, 0], [0.2, -0.22], [-0.2, -0.4]];

let shared = null;
function parts() {
  if (shared) return shared;
  // Both quads end at their local origin (the arrow's tip) and reach back along -x.
  const shaft = new THREE.PlaneGeometry(1, 1).translate(-0.5, 0, 0);
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(250,242,222,0)');
  grad.addColorStop(1, 'rgba(250,242,222,0.75)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 4);
  const fade = new THREE.CanvasTexture(c);
  shared = {
    shaft,
    shaftMat: new THREE.MeshBasicMaterial({ color: 0x2a1c10, depthWrite: false }),
    trailMat: new THREE.MeshBasicMaterial({ map: fade, transparent: true, depthWrite: false }),
  };
  return shared;
}

/** A group of `count` arrow streaks (1, or 3 for a volley), each a trail and a shaft. */
export function createArrowStreaks(count = 1) {
  const { shaft, shaftMat, trailMat } = parts();
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const [side, back] = VOLLEY[i];
    const arrow = new THREE.Group();
    arrow.userData.offset = { side, back };
    const trail = new THREE.Mesh(shaft, trailMat);
    trail.scale.set(TRAIL.length, TRAIL.width, 1);
    trail.position.x = -SHAFT.length * 0.6;
    const body = new THREE.Mesh(shaft, shaftMat);
    body.scale.set(SHAFT.length, SHAFT.width, 1);
    arrow.add(trail, body);
    g.add(arrow);
  }
  g.traverse((o) => (o.renderOrder = 3));
  return g;
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();

/**
 * Lay the streaks along `dir` (the way the arrow moved this frame, scene units), flat to the camera: their x along
 * the flight as seen on screen, facing the viewer.
 */
export function aimStreaks(group, dir, camera) {
  camera.getWorldDirection(_n).negate();
  _x.copy(dir).addScaledVector(_n, -dir.dot(_n));
  if (_x.lengthSq() < 1e-10) return;
  _x.normalize();
  _y.crossVectors(_n, _x);
  _m.makeBasis(_x, _y, _n);
  group.quaternion.setFromRotationMatrix(_m);
  for (const arrow of group.children) {
    const { side, back } = arrow.userData.offset;
    arrow.position.set(back, side, 0);
  }
}
