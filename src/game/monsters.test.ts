import { describe, expect, it } from 'vitest';
import { Tile, generate, isWalkable, maxDepth, type Floorplan } from '../dungeon/generate';
import { MIN_SOLID } from './draws';
import {
  DANGER_BUDGET,
  MONSTER_SPECIES,
  placeMonsters,
  speciesForDepth,
} from './monsters';
import { PHYSICS_MIN_FPS, PLAYER_SPEED } from './physics';

/** Independent BFS oracle: path distance from the entry to every tile. */
function bfsDist(plan: Floorplan): Int32Array {
  const s = plan.size;
  const dist = new Int32Array(s * s).fill(-1);
  const queue = [plan.spawn.y * s + plan.spawn.x];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const x = idx % s;
    const y = Math.floor(idx / s);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= s || ny >= s) continue;
      const nIdx = ny * s + nx;
      if (dist[nIdx] === -1 && isWalkable(plan.tiles[nIdx])) {
        dist[nIdx] = dist[idx] + 1;
        queue.push(nIdx);
      }
    }
  }
  return dist;
}

describe('the species bench', () => {
  it('respects the anti-tunneling bound and stays outrunnable', () => {
    for (const def of Object.values(MONSTER_SPECIES)) {
      expect(def.speed / PHYSICS_MIN_FPS, def.id).toBeLessThan(MIN_SOLID);
      expect(def.speed, def.id).toBeLessThan(PLAYER_SPEED);
    }
  });

  it('every species is killable and takes at least one hit', () => {
    for (const def of Object.values(MONSTER_SPECIES)) {
      expect(def.hp, def.id).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(def.hp), def.id).toBe(true);
    }
  });

  it('bands cover every depth above the nadir', () => {
    for (let depth = 1; depth < maxDepth(); depth++) {
      const bench = speciesForDepth(depth);
      expect(bench.length).toBeGreaterThan(0);
      for (const id of bench) expect(MONSTER_SPECIES[id]).toBeDefined();
    }
  });
});

describe('placeMonsters', () => {
  it('is deterministic for the same seed and independent of call order', () => {
    const a = placeMonsters(generate('alpha', 2), 'alpha');
    const b = placeMonsters(generate('alpha', 2), 'alpha');
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('varies with the seed', () => {
    const a = placeMonsters(generate('alpha', 2), 'alpha');
    const b = placeMonsters(generate('beta', 2), 'beta');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('spawns the danger budget on room floor tiles, far from the entry, in band', () => {
    for (const seed of ['alpha', 'beta', 'gamma']) {
      for (const depth of [1, 2, 4, 6, 8]) {
        const plan = generate(seed, depth);
        const spawns = placeMonsters(plan, seed);
        const label = `${seed}:${depth}`;

        expect(spawns.length, label).toBeLessThanOrEqual(DANGER_BUDGET + 1);
        expect(spawns.length, label).toBeGreaterThan(0);
        // roomy floors afford the full budget — the shrink squeezes it, never inflates it
        if (depth <= 6) expect(spawns.length, label).toBeGreaterThanOrEqual(DANGER_BUDGET - 1);

        const dist = bfsDist(plan);
        const farthest = Math.max(...dist);
        const minDist = Math.min(10, Math.ceil(farthest / 2));
        const bench = speciesForDepth(depth);
        const taken = new Set<string>();
        for (const m of spawns) {
          const idx = m.y * plan.size + m.x;
          expect(plan.tiles[idx], `${label} tile`).toBe(Tile.Floor);
          expect(
            plan.rooms.some(
              (r) => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h,
            ),
            `${label} in a room`,
          ).toBe(true);
          expect(dist[idx], `${label} entry distance`).toBeGreaterThanOrEqual(minDist);
          expect(bench, `${label} band`).toContain(m.species);
          expect(taken.has(`${m.x},${m.y}`), `${label} unique tile`).toBe(false);
          taken.add(`${m.x},${m.y}`);
        }
      }
    }
  });

  it('leaves the nadir to its boss', () => {
    expect(placeMonsters(generate('alpha', maxDepth()), 'alpha')).toEqual([]);
  });
});
