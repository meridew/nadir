import { describe, expect, it } from 'vitest';
import { planFromAscii } from '../dungeon/ascii';
import { Tile, generate, type Floorplan } from '../dungeon/generate';
import { MIN_SOLID, buildFloorDraws, type ColliderRect } from './draws';
import { PHYSICS_MIN_FPS, PLAYER_SPEED } from './physics';

/** The player's feet box (see entities/Player). */
const BODY_W = 10;
const BODY_H = 4;

/**
 * Geometric leak detector: flood-fill every 1px position the feet box can
 * occupy without intersecting a collider, starting from spawn. Reaching a
 * position whose center lies in a VOID cell requires fully crossing a wall
 * line — i.e., a hole in the collision geometry.
 */
function findLeaks(
  plan: Floorplan,
  start: { x: number; y: number } = plan.spawn,
  reachableTiles?: number,
): { x: number; y: number }[] {
  const stats = { explored: 0 };
  const s = plan.size;
  const W = s * 16;
  const draws = buildFloorDraws(plan);

  const bins: ColliderRect[][] = Array.from({ length: s * s }, () => []);
  for (const c of draws.colliders) {
    const tx0 = Math.max(0, Math.floor(c.px / 16));
    const ty0 = Math.max(0, Math.floor(c.py / 16));
    const tx1 = Math.min(s - 1, Math.floor((c.px + c.w - 1) / 16));
    const ty1 = Math.min(s - 1, Math.floor((c.py + c.h - 1) / 16));
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) bins[ty * s + tx].push(c);
  }

  const free = (px: number, py: number): boolean => {
    if (px < 0 || py < 0 || px + BODY_W > W || py + BODY_H > W) return false;
    const tx0 = Math.floor(px / 16);
    const ty0 = Math.floor(py / 16);
    const tx1 = Math.floor((px + BODY_W - 1) / 16);
    const ty1 = Math.floor((py + BODY_H - 1) / 16);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        for (const c of bins[ty * s + tx]) {
          if (px < c.px + c.w && px + BODY_W > c.px && py < c.py + c.h && py + BODY_H > c.py) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const startX = start.x * 16 + 8 - BODY_W / 2;
  const startY = start.y * 16 + 8 - BODY_H / 2;
  expect(free(startX, startY), 'start position must be free').toBe(true);

  const visited = new Uint8Array(W * W);
  const leaks: { x: number; y: number }[] = [];
  const leakTiles = new Set<string>();
  const queue: number[] = [startY * W + startX];
  visited[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    stats.explored++;
    const pos = queue[head];
    const px = pos % W;
    const py = Math.floor(pos / W);
    const cx = Math.floor((px + BODY_W / 2) / 16);
    const cy = Math.floor((py + BODY_H / 2) / 16);
    if (plan.tiles[cy * s + cx] === Tile.Void) {
      const key = `${cx},${cy}`;
      if (!leakTiles.has(key)) {
        leakTiles.add(key);
        leaks.push({ x: cx, y: cy });
      }
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || ny < 0) continue;
      const nPos = ny * W + nx;
      if (!visited[nPos] && free(nx, ny)) {
        visited[nPos] = 1;
        queue.push(nPos);
      }
    }
  }
  // the sweep must have covered its reachable region (loose floor of positions
  // per open tile — guards against a trivially-green detector)
  if (reachableTiles !== undefined) {
    expect(stats.explored).toBeGreaterThan(reachableTiles * 50);
  }
  return leaks;
}

/** Sweep every disconnected walkable region of the plan. */
function findLeaksAllRegions(plan: Floorplan): { x: number; y: number }[] {
  const s = plan.size;
  const walkable = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < s && y < s && plan.tiles[y * s + x] !== Tile.Void && plan.tiles[y * s + x] !== Tile.Wall;
  const seen = new Uint8Array(s * s);
  const leaks: { x: number; y: number }[] = [];
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (!walkable(x, y) || seen[y * s + x]) continue;
      // flood this tile component to size it, marking seen
      const queue = [y * s + x];
      seen[y * s + x] = 1;
      for (let head = 0; head < queue.length; head++) {
        const idx = queue[head];
        const ix = idx % s;
        const iy = Math.floor(idx / s);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = ix + dx;
          const ny = iy + dy;
          if (walkable(nx, ny) && !seen[ny * s + nx]) {
            seen[ny * s + nx] = 1;
            queue.push(ny * s + nx);
          }
        }
      }
      leaks.push(...findLeaks(plan, { x, y }, queue.length));
    }
  }
  return leaks;
}

describe('anti-tunneling invariant', () => {
  it('no actor can cross the thinnest collider in one clamped physics step', () => {
    const maxStepSeconds = 1 / PHYSICS_MIN_FPS;
    expect(PLAYER_SPEED * maxStepSeconds).toBeLessThan(MIN_SOLID);
  });
});

describe('collision geometry has no through-wall paths for the feet box', () => {
  it('generated floor, depth 3', () => {
    expect(findLeaksAllRegions(generate('alpha', 3))).toEqual([]);
  });

  it('generated floor, depth 5 (different seed)', () => {
    expect(findLeaksAllRegions(generate('seed-2', 5))).toEqual([]);
  });

  it('audit layout: thin walls, stubs, pillars, corners, tight bands', () => {
    const plan = planFromAscii([
      '##############################',
      '##############################',
      '##.......#.........##......###',
      '##.......#.........##......###',
      '##.......#....#....##......###',
      '##.......#.........##......###',
      '##.......#.........##......###',
      '###############..#############',
      '###############..#############',
      '##..........................##',
      '##..........................##',
      '##...###....................##',
      '##...###....................##',
      '##..........................##',
      '##############.###############',
      '##############.###############',
      '##############.###############',
      '##..........................##',
      '##..........................##',
      '##..........................##',
      '##############################',
      '##############################',
    ]);
    expect(findLeaksAllRegions(plan)).toEqual([]);
  });
});
