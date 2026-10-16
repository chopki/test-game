import { ENEMIES, WAVES } from './config.js';

export const SIDES = ['north', 'east', 'south', 'west'];

/**
 * Builds the spawn list for wave `n`. Waves are filled up to a "threat budget"
 * that grows with the wave number; enemies attack from more sides over time
 * and every few waves a group of elite Ogres joins in.
 */
export function generateWave(n, rng) {
  const sideCount = n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
  const sides = rng.shuffle(SIDES).slice(0, sideCount);
  const budget = Math.round(WAVES.budgetBase + n * WAVES.budgetPerWave + n * n * WAVES.budgetQuadratic);
  const hpMult = 1 + WAVES.hpGrowthPerWave * (n - 1);
  const gap = Math.max(0.2, 1.0 - n * 0.04);

  const pool = Object.entries(ENEMIES).filter(([, def]) => def.minWave <= n);
  const entries = [];
  let remaining = budget;
  while (remaining > 0) {
    const options = pool.filter(([, def]) => def.threat <= remaining);
    if (options.length === 0) break;
    const type = weightedPick(rng, options);
    entries.push({ type, side: rng.pick(sides), delay: gap * rng.range(0.6, 1.4), hpMult, elite: false });
    remaining -= ENEMIES[type].threat;
  }

  if (n % WAVES.bossEvery === 0) {
    const count = n / WAVES.bossEvery;
    for (let i = 0; i < count; i++) {
      entries.push({ type: 'brute', side: rng.pick(sides), delay: 1.5, hpMult: hpMult * WAVES.bossHpMultiplier, elite: true });
    }
  }

  if (entries.length > 0) entries[0].delay = 0;
  return { wave: n, sides, entries };
}

function weightedPick(rng, options) {
  const total = options.reduce((sum, [, def]) => sum + def.weight, 0);
  let roll = rng.next() * total;
  for (const [type, def] of options) {
    roll -= def.weight;
    if (roll <= 0) return type;
  }
  return options[options.length - 1][0];
}

export function summarizeWave(plan) {
  const counts = {};
  for (const e of plan.entries) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return Object.entries(counts).map(([type, count]) => ({ type, name: ENEMIES[type].name, count }));
}

export class WaveManager {
  constructor(rng) {
    this.rng = rng;
    this.wave = 0;
    this.queue = [];
    this.timer = 0;
    this.current = null;
    this.next = generateWave(1, rng);
  }

  start() {
    this.current = this.next;
    this.wave = this.current.wave;
    this.queue = [...this.current.entries];
    this.timer = this.queue.length ? this.queue[0].delay : 0;
    this.next = generateWave(this.wave + 1, this.rng);
    return this.current;
  }

  /** Returns the spawn entries due this tick. */
  update(dt) {
    const due = [];
    this.timer -= dt;
    while (this.queue.length > 0 && this.timer <= 0) {
      due.push(this.queue.shift());
      if (this.queue.length > 0) this.timer += this.queue[0].delay;
    }
    return due;
  }

  isSpawningDone() {
    return this.queue.length === 0;
  }
}
