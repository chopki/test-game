import * as THREE from 'three';

/**
 * A tileable sheet of old paper for Realm's unseen land (see realmLayer.js): mottled cream with fibres, the faint
 * laid and chain lines of hand-made paper, foxing spots and a few tea stains, and a fine speckle. Drawn once on a
 * canvas (power-of-two, so it mipmaps and stays crisp at every zoom) and cached. `size` in pixels.
 */
let cached = null;

export function parchmentTexture(size = 1024) {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const range = (a, b) => a + rnd() * (b - a);
  // Draw `fn` at (x, y) and, near an edge, again on the far side, so the sheet tiles seamlessly.
  const wrapped = (x, y, r, fn) => {
    for (const ox of [0, -size, size]) {
      for (const oy of [0, -size, size]) {
        if (ox && (x + ox < -r || x + ox > size + r)) continue;
        if (oy && (y + oy < -r || y + oy > size + r)) continue;
        fn(x + ox, y + oy);
      }
    }
  };

  // The base: warm cream, mottled by soft blotches in lighter and darker tones.
  g.fillStyle = '#dcc9a2';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = range(40, 180);
    const light = rnd() < 0.5;
    const a = range(0.04, 0.1);
    wrapped(x, y, r, (px, py) => {
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, light ? `rgba(246, 234, 206, ${a})` : `rgba(150, 112, 68, ${a})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }

  // Laid lines (close, faint, across) and chain lines (wider apart, down), as in paper made on a mould.
  g.lineWidth = 1;
  for (let y = 0; y < size; y += 6) {
    g.strokeStyle = `rgba(120, 88, 50, ${range(0.02, 0.05)})`;
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(size, y + 0.5);
    g.stroke();
  }
  for (let x = 0; x < size; x += 64) {
    g.strokeStyle = 'rgba(120, 88, 50, 0.07)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + 1, 0);
    g.lineTo(x + 1, size);
    g.stroke();
  }

  // Fibres: short, fine, mostly along the sheet, some light and some dark.
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = range(6, 26);
    const a = range(-0.5, 0.5) + (rnd() < 0.3 ? Math.PI / 2 : 0);
    const light = rnd() < 0.55;
    g.strokeStyle = light ? `rgba(250, 242, 222, ${range(0.15, 0.35)})` : `rgba(110, 80, 46, ${range(0.08, 0.2)})`;
    g.lineWidth = range(0.5, 1.2);
    wrapped(x, y, len, (px, py) => {
      g.beginPath();
      g.moveTo(px, py);
      g.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + range(-2, 2), py + Math.sin(a) * len * 0.5 + range(-2, 2), px + Math.cos(a) * len, py + Math.sin(a) * len);
      g.stroke();
    });
  }

  // Foxing: little rust-brown spots, in clusters, and a few tea stains (a ring darker than its middle).
  for (let i = 0; i < 70; i++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const n = Math.floor(range(1, 7));
    for (let j = 0; j < n; j++) {
      const x = cx + range(-30, 30);
      const y = cy + range(-30, 30);
      const r = range(1.5, 7);
      wrapped(x, y, r, (px, py) => {
        const grad = g.createRadialGradient(px, py, 0, px, py, r);
        grad.addColorStop(0, `rgba(140, 82, 36, ${range(0.25, 0.5)})`);
        grad.addColorStop(1, 'rgba(140, 82, 36, 0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(px, py, r, 0, Math.PI * 2);
        g.fill();
      });
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = range(50, 110);
    wrapped(x, y, r, (px, py) => {
      const grad = g.createRadialGradient(px, py, r * 0.55, px, py, r);
      grad.addColorStop(0, 'rgba(150, 100, 50, 0.03)');
      grad.addColorStop(0.85, 'rgba(130, 84, 40, 0.14)');
      grad.addColorStop(1, 'rgba(130, 84, 40, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    });
  }

  // A fine speckle of grit.
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(90, 64, 36, ${range(0.1, 0.3)})` : `rgba(255, 248, 230, ${range(0.2, 0.4)})`;
    g.fillRect(rnd() * size, rnd() * size, range(0.6, 1.6), range(0.6, 1.6));
  }

  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  cached = texture;
  return texture;
}
