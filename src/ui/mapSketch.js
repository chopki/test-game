import { T } from '../sim/terrain.js';

// An ink-and-wash sketch of a battlefield for the loading screen (after docs/reference/ui-menu.jpg): the map seen
// from the game's own angle (north-east at the top right), streams and the sea washed in blue, woods as little
// scribbled trees, rocks hatched, cliffs drawn with hachures, the hall and the fort in ink, and red arrows where the
// first wave will come from.

const INK = 'rgba(58, 40, 22, 0.85)';
const INK_SOFT = 'rgba(58, 40, 22, 0.35)';
const WASH = { water: 'rgba(118, 168, 196, 0.5)', sea: 'rgba(96, 146, 184, 0.55)', forest: 'rgba(120, 128, 60, 0.4)', rock: 'rgba(150, 140, 120, 0.45)', hill: 'rgba(170, 140, 90, 0.22)' };
const ARROW = 'rgba(176, 52, 32, 0.85)';

/** Which way along the screen each side's attack comes from, as a direction on the map (dx, dz) inwards. */
const INWARD = { north: [0, 1], south: [0, -1], west: [1, 0], east: [-1, 0] };

/**
 * Draw `world`'s map into `canvas` (sized to its CSS box at the device's pixel ratio), with arrows for `sides`.
 * Deterministic: the same map always gives the same drawing.
 */
export function drawMapSketch(canvas, world, sides = []) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth || 400;
  const ch = canvas.clientHeight || 240;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cw, ch);

  const grid = world.grid;
  const W = grid.width;
  const H = grid.height;
  // Isometric: a tile step east goes right and down, a step south goes left and down.
  const s = Math.min((cw * 0.92) / (W + H), (ch * 0.92 * 2) / (W + H));
  const ox = cw / 2 - ((W - H) / 2) * s;
  const oy = ch / 2 - ((W + H) / 4) * s;
  const P = (x, z) => [ox + (x - z) * s, oy + (x + z) * s * 0.5];
  let seed = world.seed % 2147483647 || 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const at = (x, z) => (grid.inBounds(x, z) ? grid.terrain[z * W + x] : -1);
  const tile = (x, z) => {
    g.beginPath();
    g.moveTo(...P(x, z));
    g.lineTo(...P(x + 1, z));
    g.lineTo(...P(x + 1, z + 1));
    g.lineTo(...P(x, z + 1));
    g.closePath();
  };

  // The ground: a faint wash and a grid every other tile.
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = 'rgba(214, 190, 140, 0.25)';
  g.beginPath();
  g.moveTo(...P(0, 0));
  g.lineTo(...P(W, 0));
  g.lineTo(...P(W, H));
  g.lineTo(...P(0, H));
  g.closePath();
  g.fill();
  g.strokeStyle = INK_SOFT;
  g.lineWidth = 0.5;
  for (let i = 0; i <= W; i += 2) line(g, P(i, 0), P(i, H));
  for (let i = 0; i <= H; i += 2) line(g, P(0, i), P(W, i));

  // Washes: raised ground, water and sea, woods and rock.
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const t = at(x, z);
      const wash =
        t === T.sea ? WASH.sea : t === T.water || t === T.ford ? WASH.water : t === T.rock ? WASH.rock : t === T.forest ? WASH.forest : grid.levelAt(x, z) > 0 ? WASH.hill : null;
      if (!wash) continue;
      g.fillStyle = wash;
      tile(x, z);
      g.fill();
    }
  }

  // Ink: shore lines where water meets land, cliff edges with hachures.
  const wet = (t) => t === T.water || t === T.ford || t === T.sea;
  g.strokeStyle = INK;
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const t = at(x, z);
      const edges = [
        [x + 1, z, P(x + 1, z), P(x + 1, z + 1)],
        [x, z + 1, P(x, z + 1), P(x + 1, z + 1)],
      ];
      for (const [nx, nz, a, b] of edges) {
        const u = at(nx, nz);
        if (u === -1) continue;
        if (wet(t) !== wet(u)) {
          g.lineWidth = 1.1;
          line(g, wobble(a, rnd, s * 0.08), wobble(b, rnd, s * 0.08));
        }
        const dl = grid.levelAt(x, z) - grid.levelAt(nx, nz);
        if (dl !== 0 && (t === T.cliff || u === T.cliff)) {
          g.lineWidth = 0.9;
          line(g, a, b);
          // Hachures running down the slope, on the lower side.
          const down = dl > 0 ? [nx - x, nz - z] : [x - nx, z - nz];
          for (let k = 0.2; k < 1; k += 0.3) {
            const m = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
            const d = P(down[0] * 0.35, down[1] * 0.35);
            const o = P(0, 0);
            line(g, m, [m[0] + d[0] - o[0], m[1] + d[1] - o[1]]);
          }
        }
      }
      if (t === T.ford) {
        // Stepping-stone dashes across the ford.
        const [cx, cy] = P(x + 0.5, z + 0.5);
        g.fillStyle = INK_SOFT;
        g.fillRect(cx - s * 0.15, cy - s * 0.05, s * 0.3, s * 0.1);
      }
    }
  }

  // Woods: a little scribbled tree on most forest tiles; rocks: a hatched lump.
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const t = at(x, z);
      if (t === T.forest && rnd() < 0.55) tree(g, P(x + 0.5 + (rnd() - 0.5) * 0.4, z + 0.5 + (rnd() - 0.5) * 0.4), s, rnd);
      else if (t === T.rock && rnd() < 0.7) rock(g, P(x + 0.5, z + 0.5), s);
    }
  }

  // The player's buildings: walls as ink strokes, towers as small blocks, the hall as a little castle.
  for (const b of world.buildings.values()) {
    const size = b.def.size;
    if (b.type === 'townHall') continue;
    g.fillStyle = b.type === 'wall' ? 'rgba(70, 48, 26, 0.75)' : 'rgba(110, 70, 40, 0.85)';
    g.beginPath();
    const [ax, ay] = P(b.x, b.z);
    const [bx, by] = P(b.x + size, b.z);
    const [cx, cy] = P(b.x + size, b.z + size);
    const [dx, dy] = P(b.x, b.z + size);
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.lineTo(cx, cy);
    g.lineTo(dx, dy);
    g.closePath();
    g.fill();
  }
  const hall = world.townHall;
  castle(g, P(hall.cx, hall.cz), s);

  // The first wave's approaches: dashed red arrows from beyond the edge towards the hall.
  for (const side of sides) {
    const [dx, dz] = INWARD[side];
    const from = side === 'north' ? [hall.cx, -3] : side === 'south' ? [hall.cx, H + 3] : side === 'west' ? [-3, hall.cz] : [W + 3, hall.cz];
    const to = [from[0] + dx * (W * 0.32 + 3), from[1] + dz * (H * 0.32 + 3)];
    arrow(g, P(...from), P(...to), s);
  }
}

function line(g, a, b) {
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.stroke();
}

const wobble = ([x, y], rnd, amount) => [x + (rnd() - 0.5) * amount, y + (rnd() - 0.5) * amount];

function tree(g, [x, y], s, rnd) {
  const r = s * (0.32 + rnd() * 0.12);
  g.fillStyle = rnd() < 0.5 ? 'rgba(112, 124, 54, 0.85)' : 'rgba(92, 108, 48, 0.85)';
  g.strokeStyle = INK;
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(x, y - r * 2.1);
  g.lineTo(x + r, y - r * 0.2);
  g.lineTo(x - r, y - r * 0.2);
  g.closePath();
  g.fill();
  g.stroke();
  line(g, [x, y - r * 0.2], [x, y + r * 0.2]);
}

function rock(g, [x, y], s) {
  const r = s * 0.4;
  g.fillStyle = 'rgba(196, 184, 160, 0.9)';
  g.strokeStyle = INK;
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(x - r, y);
  g.lineTo(x - r * 0.5, y - r * 0.8);
  g.lineTo(x + r * 0.4, y - r * 0.9);
  g.lineTo(x + r, y - r * 0.1);
  g.lineTo(x + r * 0.3, y + r * 0.35);
  g.closePath();
  g.fill();
  g.stroke();
  line(g, [x - r * 0.2, y - r * 0.6], [x + r * 0.1, y + r * 0.2]);
}

function castle(g, [x, y], s) {
  const w = s * 4.2;
  const h = s * 2.9;
  g.fillStyle = 'rgba(226, 204, 160, 0.95)';
  g.strokeStyle = INK;
  g.lineWidth = 1.1;
  // Keep with crenellations, and a tower each side.
  const crenels = (left, top, width, n) => {
    g.beginPath();
    g.moveTo(left, top + h * 0.15);
    for (let i = 0; i < n; i++) {
      const a = left + (i / n) * width;
      const b = left + ((i + 0.5) / n) * width;
      g.lineTo(a, top);
      g.lineTo(b, top);
      g.lineTo(b, top + h * 0.15);
      g.lineTo(left + ((i + 1) / n) * width, top + h * 0.15);
    }
    g.lineTo(left + width, top + h * 1.2);
    g.lineTo(left, top + h * 1.2);
    g.closePath();
    g.fill();
    g.stroke();
  };
  crenels(x - w / 2, y - h * 0.9, w * 0.28, 2);
  crenels(x + w / 2 - w * 0.28, y - h * 0.9, w * 0.28, 2);
  crenels(x - w * 0.24, y - h * 1.3, w * 0.48, 3);
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x, y + h * 0.05, s * 0.28, Math.PI, 0);
  g.lineTo(x + s * 0.28, y + h * 0.25);
  g.lineTo(x - s * 0.28, y + h * 0.25);
  g.fill();
  // The banner.
  g.strokeStyle = INK;
  line(g, [x, y - h * 1.3], [x, y - h * 1.85]);
  g.fillStyle = ARROW;
  g.beginPath();
  g.moveTo(x, y - h * 1.85);
  g.lineTo(x + s * 0.7, y - h * 1.7);
  g.lineTo(x, y - h * 1.55);
  g.fill();
}

function arrow(g, [ax, ay], [bx, by], s) {
  g.strokeStyle = ARROW;
  g.fillStyle = ARROW;
  g.lineWidth = Math.max(1.5, s * 0.22);
  g.setLineDash([s * 0.7, s * 0.45]);
  line(g, [ax, ay], [bx, by]);
  g.setLineDash([]);
  const a = Math.atan2(by - ay, bx - ax);
  const L = s * 1.4;
  g.beginPath();
  g.moveTo(bx + Math.cos(a) * L * 0.5, by + Math.sin(a) * L * 0.5);
  g.lineTo(bx + Math.cos(a + 2.5) * L, by + Math.sin(a + 2.5) * L);
  g.lineTo(bx + Math.cos(a - 2.5) * L, by + Math.sin(a - 2.5) * L);
  g.closePath();
  g.fill();
}

/** A name for the battleground, from what's on the map. */
export function battlegroundName(world) {
  const t = world.grid.terrain;
  const count = (type) => t.reduce((n, v) => n + (v === type), 0);
  if (world.coast) return 'The Coast Road';
  if (count(T.ford) > 0) return 'The River Crossing';
  if (world.hills) return 'The High Ground';
  if (count(T.water) > 0) return 'The Lakeside';
  if (count(T.forest) > t.length * 0.3) return 'The Wildwood';
  if (count(T.rock) > t.length * 0.06) return 'The Stony Fields';
  return 'The Open Fields';
}
