import { describe, expect, it } from 'vitest';
import {
  MIN_SIZE,
  Tile,
  generate,
  isWalkable,
  maxDepth,
  sizeForDepth,
} from './generate';

const DEPTHS = Array.from({ length: maxDepth() }, (_, i) => i + 1);
const SEEDS = Array.from({ length: 30 }, (_, i) => `seed-${i}`);

describe('sizeForDepth', () => {
  it('shrinks monotonically to MIN_SIZE at the nadir', () => {
    for (let d = 2; d <= maxDepth(); d++) {
      expect(sizeForDepth(d)).toBeLessThanOrEqual(sizeForDepth(d - 1));
    }
    expect(sizeForDepth(1)).toBeGreaterThan(MIN_SIZE);
    expect(sizeForDepth(maxDepth())).toBe(MIN_SIZE);
  });
});

describe('generate', () => {
  it('is deterministic for the same seed and depth', () => {
    const a = generate('repeatable', 3);
    const b = generate('repeatable', 3);
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(a.spawn).toEqual(b.spawn);
    expect(a.stairsDown).toEqual(b.stairsDown);
  });

  it('every walkable tile is reachable from spawn, at every depth, for many seeds', () => {
    for (const seed of SEEDS) {
      for (const depth of DEPTHS) {
        const plan = generate(seed, depth);
        const { size, tiles, spawn } = plan;
        const seen = new Set<number>([spawn.y * size + spawn.x]);
        const queue = [spawn.y * size + spawn.x];
        while (queue.length > 0) {
          const idx = queue.pop()!;
          const x = idx % size;
          const y = Math.floor(idx / size);
          for (const [nx, ny] of [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
          ]) {
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            const nIdx = ny * size + nx;
            if (!seen.has(nIdx) && isWalkable(tiles[nIdx])) {
              seen.add(nIdx);
              queue.push(nIdx);
            }
          }
        }
        let walkableCount = 0;
        for (const t of tiles) if (isWalkable(t)) walkableCount++;
        expect(seen.size, `seed=${seed} depth=${depth}`).toBe(walkableCount);
      }
    }
  });

  it('places stairs on every floor except the nadir, which gets the prize', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const depth of DEPTHS) {
        const plan = generate(seed, depth);
        if (plan.isNadir) {
          expect(plan.prize).not.toBeNull();
          expect(plan.stairsDown).toBeNull();
          expect(plan.tiles[plan.prize!.y * plan.size + plan.prize!.x]).toBe(Tile.Prize);
        } else {
          expect(plan.stairsDown).not.toBeNull();
          expect(plan.prize).toBeNull();
          expect(
            plan.tiles[plan.stairsDown!.y * plan.size + plan.stairsDown!.x],
          ).toBe(Tile.StairsDown);
        }
      }
    }
  });

  it('never places walkable tiles on the border', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const depth of DEPTHS) {
        const { size, tiles } = generate(seed, depth);
        for (let i = 0; i < size; i++) {
          expect(isWalkable(tiles[i])).toBe(false); // top row
          expect(isWalkable(tiles[(size - 1) * size + i])).toBe(false); // bottom row
          expect(isWalkable(tiles[i * size])).toBe(false); // left col
          expect(isWalkable(tiles[i * size + size - 1])).toBe(false); // right col
        }
      }
    }
  });

  it('the stairs are a meaningful distance from spawn', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const plan = generate(seed, 1);
      const s = plan.spawn;
      const t = plan.stairsDown!;
      const manhattan = Math.abs(s.x - t.x) + Math.abs(s.y - t.y);
      expect(manhattan).toBeGreaterThan(5);
    }
  });
});
