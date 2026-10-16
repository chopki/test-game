import * as THREE from 'three';
import { createBuildingModel } from './models.js';

/**
 * Portrait icons of buildings for the UI (tower cards, the Engineer's Codex), rendered once from the real
 * 3D models so they always match the game. Uses a small throwaway WebGL context that's released straight
 * afterwards, so it doesn't add to the game's GPU load. Returns { type: dataURL }; empty if WebGL fails.
 */
export function renderBuildingIcons(types, size = 128) {
  const icons = {};
  let renderer = null;
  try {
    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a3a, 1.6));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
    sun.position.set(4, 8, 6);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

    for (const type of types) {
      const model = createBuildingModel(type, type === 'wall' ? { connections: { e: true, w: true } } : undefined);
      scene.add(model);
      // Frame the model from a three-quarter view, like the in-game camera.
      const box = new THREE.Box3().setFromObject(model);
      const centre = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2;
      const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.92;
      camera.position.copy(centre).add(new THREE.Vector3(0.75, 0.62, 1).normalize().multiplyScalar(dist));
      camera.lookAt(centre);
      renderer.render(scene, camera);
      icons[type] = canvas.toDataURL('image/png');
      scene.remove(model);
    }
  } catch (err) {
    console.warn('Could not render building icons', err);
  } finally {
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
  return icons;
}
