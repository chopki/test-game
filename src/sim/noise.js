// Seeded 2D value noise and fractal (fBm) noise, for terrain generation. Values are in [0, 1).

export function createNoise(rng) {
  const SIZE = 256;
  const values = Float32Array.from({ length: SIZE }, () => rng.next());
  const perm = Uint8Array.from(rng.shuffle([...Array(SIZE).keys()]));
  const lattice = (x, z) => values[perm[(perm[x & 255] + z) & 255]];
  const fade = (t) => t * t * (3 - 2 * t);

  const value = (x, z) => {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = fade(x - x0);
    const fz = fade(z - z0);
    const a = lattice(x0, z0);
    const b = lattice(x0 + 1, z0);
    const c = lattice(x0, z0 + 1);
    const d = lattice(x0 + 1, z0 + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };

  /** Fractal noise: `octaves` layers of value noise, each at double frequency and half the weight. */
  const fbm = (x, z, octaves = 3) => {
    let sum = 0;
    let weight = 0.5;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      sum += value(x, z) * weight;
      total += weight;
      x = x * 2 + 17.3;
      z = z * 2 + 9.1;
      weight *= 0.5;
    }
    return sum / total;
  };

  return { value, fbm };
}
