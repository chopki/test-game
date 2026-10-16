import { blocksMovement, isBuildableTerrain, T } from './terrain.js';

// Tile occupancy grid. Each cell holds the id of the building covering it, or null. `terrain` holds what each
// tile is made of (see terrain.js); it's fixed for the whole game.
// Coordinates: x runs west→east, z runs north→south, both in [0, size).
export class Grid {
  constructor(width, height, spawnMargin = 0) {
    this.width = width;
    this.height = height;
    this.spawnMargin = spawnMargin;
    this.cells = new Array(width * height).fill(null);
    this.terrain = new Uint8Array(width * height);
  }

  terrainAt(x, z) {
    return this.inBounds(x, z) ? this.terrain[this.index(x, z)] : T.open;
  }

  /** Terrain enemies can't walk through (water, rock, forest). */
  isBlocked(x, z) {
    return this.inBounds(x, z) && blocksMovement(this.terrain[this.index(x, z)]);
  }

  isBuildable(x, z) {
    return this.inBounds(x, z) && isBuildableTerrain(this.terrain[this.index(x, z)]);
  }

  inBounds(x, z) {
    return x >= 0 && z >= 0 && x < this.width && z < this.height;
  }

  index(x, z) {
    return z * this.width + x;
  }

  get(x, z) {
    return this.inBounds(x, z) ? this.cells[this.index(x, z)] : null;
  }

  isInSpawnZone(x, z) {
    const m = this.spawnMargin;
    return x < m || z < m || x >= this.width - m || z >= this.height - m;
  }

  *footprint(x, z, size) {
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) yield [x + dx, z + dz];
    }
  }

  isAreaFree(x, z, size) {
    for (const [tx, tz] of this.footprint(x, z, size)) {
      if (!this.isBuildable(tx, tz) || this.cells[this.index(tx, tz)] !== null) return false;
    }
    return true;
  }

  fill(x, z, size, id) {
    for (const [tx, tz] of this.footprint(x, z, size)) this.cells[this.index(tx, tz)] = id;
  }
}
