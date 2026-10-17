import { ENEMIES, WAVES } from './config.js';

export const SIDES = ['north', 'east', 'south', 'west'];

/**
 * Builds the spawn list for wave `n`. Waves are filled with squads (several men of one type, or a siege engine
 * with its escort) up to a "threat budget" that grows with the wave number; enemies attack from more sides over
 * time and every few waves a squad of elite Knights joins in. Each entry carries its `squad` number: the World
 * lines a squad's men up side by side on the edge. Attacks come only from the sides in `from` (not the sea).
 */
export function generateWave(n, rng, from = SIDES) {
  const sideCount = Math.min(from.length, n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4);
  const sides = rng.shuffle(from).slice(0, sideCount);
  const budget = Math.round(WAVES.budgetBase + n * WAVES.budgetPerWave + n * n * WAVES.budgetQuadratic);
  const hpMult = 1 + WAVES.hpGrowthPerWave * (n - 1);
  const [firstGap, minGap] = WAVES.squadGap;
  const squadGap = Math.max(minGap, firstGap - (n - 1) * 0.15);

  const pool = Object.entries(ENEMIES).filter(([, def]) => def.minWave <= n);
  const cost = (def, count) => def.threat * count + (def.escort ? ENEMIES[def.escort.type].threat * def.escort.count : 0);
  const entries = [];
  let squad = 0;
  const addSquad = (members, side, elite = false) => {
    members.forEach((type, i) => {
      const delay = i === 0 ? squadGap * rng.range(0.7, 1.3) : WAVES.memberGap;
      entries.push({ type, side, squad, delay, hpMult: elite ? hpMult * WAVES.bossHpMultiplier : hpMult, elite });
    });
    squad++;
  };
  let remaining = budget;
  while (remaining > 0) {
    const options = pool.filter(([, def]) => cost(def, def.squad[0]) <= remaining);
    if (options.length === 0) break;
    const type = weightedPick(rng, options);
    const def = ENEMIES[type];
    let count = def.squad[0];
    while (count < def.squad[1] && cost(def, count + 1) <= remaining && rng.next() < 0.6) count++;
    const members = Array(count).fill(type);
    // An escort marches in front of its siege engine.
    if (def.escort) members.unshift(...Array(def.escort.count).fill(def.escort.type));
    addSquad(members, rng.pick(sides));
    remaining -= cost(def, count);
  }

  if (n % WAVES.bossEvery === 0) addSquad(Array(n / WAVES.bossEvery).fill(WAVES.bossType), rng.pick(sides), true);

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
  return Object.entries(counts).map(([type, count]) => ({ type, name: count > 1 ? ENEMIES[type].plural : ENEMIES[type].name, count }));
}

export class WaveManager {
  /** `sides`: the map edges enemies can come from (all four, less any coast). */
  constructor(rng, sides = SIDES) {
    this.rng = rng;
    this.sides = sides;
    this.wave = 0;
    this.queue = [];
    this.timer = 0;
    this.current = null;
    this.next = generateWave(1, rng, sides);
  }

  start() {
    this.current = this.next;
    this.wave = this.current.wave;
    this.queue = [...this.current.entries];
    this.timer = this.queue.length ? this.queue[0].delay : 0;
    this.next = generateWave(this.wave + 1, this.rng, this.sides);
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
