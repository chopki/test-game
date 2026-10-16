import * as THREE from 'three';

/**
 * The fixed isometric view, shared by the game camera and the sprite baker so baked sprites line up
 * exactly with the world. Azimuth 45° puts the tile grid on the diagonal, like the art reference.
 */
export const ISO = {
  azimuth: Math.PI / 4,
  elevation: THREE.MathUtils.degToRad(38),
};

/** Unit vector from the look-at point towards the camera. */
export function isoDirection(out = new THREE.Vector3()) {
  const { azimuth: a, elevation: e } = ISO;
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

/** The camera orientation for the iso view (same for every camera that uses it). */
export const ISO_QUATERNION = (() => {
  // A camera, not a plain Object3D: cameras look down -Z, so lookAt() orients them the other way round.
  const cam = new THREE.PerspectiveCamera();
  cam.position.copy(isoDirection());
  cam.lookAt(0, 0, 0);
  return cam.quaternion.clone();
})();

/** Screen-right and screen-up directions in world space for the iso view. */
export const ISO_RIGHT = new THREE.Vector3(1, 0, 0).applyQuaternion(ISO_QUATERNION);
export const ISO_UP = new THREE.Vector3(0, 1, 0).applyQuaternion(ISO_QUATERNION);

/** Sun direction used when baking sprites (points from the scene towards the sun). */
export const SUN_DIRECTION = new THREE.Vector3(-0.55, 1, 0.25).normalize();
