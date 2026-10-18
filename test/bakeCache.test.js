import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { spriteFingerprint } from '../src/render/spriteBaker.js';

// A small model: a box and a cone, as the models are built (fresh geometry and shared materials each time).
const RED = new THREE.MeshStandardMaterial({ color: 0xb02a22 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x8a5a34 });
function model({ coneY = 1, coneMaterial = RED, hidden = null } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), WOOD));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 8), coneMaterial);
  cone.position.y = coneY;
  g.add(cone);
  if (hidden) {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), RED);
    flag.position.y = hidden;
    flag.visible = false;
    g.add(flag);
  }
  return g;
}
const spec = { key: 'test', shadow: true };
const print = (m, s = spec, salt = 'baker') => spriteFingerprint(m, s, salt);

describe('sprite fingerprints (the incremental bake)', () => {
  it('are the same for the same model built again', () => {
    expect(print(model())).toBe(print(model()));
    expect(print(model())).toMatch(/^[0-9a-f]{16}$/);
  });

  it('change when a part moves, changes material or colour, or the geometry changes', () => {
    const base = print(model());
    expect(print(model({ coneY: 1.1 }))).not.toBe(base);
    expect(print(model({ coneMaterial: WOOD }))).not.toBe(base);
    expect(print(model({ coneMaterial: new THREE.MeshStandardMaterial({ color: 0x35508e }) }))).not.toBe(base);
    const wide = model();
    wide.children[0].geometry = new THREE.BoxGeometry(1.2, 1, 1);
    expect(print(wide)).not.toBe(base);
  });

  it("change with the sprite's bake options and the baker (salt), not with parts that aren't drawn", () => {
    const base = print(model());
    expect(print(model(), { ...spec, shadow: false })).not.toBe(base);
    expect(print(model(), { ...spec, pxPerUnit: 56 })).not.toBe(base);
    expect(print(model(), spec, 'other baker')).not.toBe(base);
    expect(print(model({ hidden: 2 }))).toBe(base);
    expect(print(model({ hidden: 3 }))).toBe(base);
  });
});
