import { describe, expect, it } from 'vitest';
import { Tile, generate, isWalkable } from '../dungeon/generate';
import { buildFloorDraws, wallBaseDepth } from './draws';

describe('buildFloorDraws', () => {
  const plan = generate('draws-seed', 5);
  const draws = buildFloorDraws(plan);

  it('paves ground under every walkable cell and one collider per wall', () => {
    let walkable = 0;
    let walls = 0;
    for (const t of plan.tiles) {
      if (isWalkable(t)) walkable++;
      else if (t === Tile.Wall) walls++;
    }
    const groundCells = new Set(draws.ground.map((g) => `${g.x},${g.y}`));
    for (let y = 0; y < plan.size; y++) {
      for (let x = 0; x < plan.size; x++) {
        if (isWalkable(plan.tiles[y * plan.size + x])) {
          expect(groundCells.has(`${x},${y}`), `floor (${x},${y})`).toBe(true);
        }
      }
    }
    // walls standing beside floor are paved underneath (their art shows ground)
    expect(draws.ground.length).toBeGreaterThan(walkable);
    // run-merging fuses per-cell rects, so there are fewer colliders than walls
    expect(draws.colliders.length).toBeGreaterThan(0);
    expect(draws.colliders.length).toBeLessThanOrEqual(walls);
  });

  it('paves ground under every wall cell that touches floor', () => {
    const groundCells = new Set(draws.ground.map((g) => `${g.x},${g.y}`));
    const walk = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < plan.size && y < plan.size && isWalkable(plan.tiles[y * plan.size + x]);
    for (let ty = 0; ty < plan.size; ty++) {
      for (let tx = 0; tx < plan.size; tx++) {
        if (plan.tiles[ty * plan.size + tx] !== Tile.Wall) continue;
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy++)
          for (let dx = -1; dx <= 1 && !touches; dx++) {
            if (walk(tx + dx, ty + dy)) touches = true;
          }
        if (touches) expect(groundCells.has(`${tx},${ty}`), `wall (${tx},${ty})`).toBe(true);
      }
    }
  });

  const isPlug = (c: { w: number; h: number; px: number; py: number }) =>
    c.w === 8 && c.h === 8 && (c.px + 4) % 16 === 0 && (c.py + 4) % 16 === 0;

  it('no collider ever intrudes into a walkable cell', () => {
    const walk = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < plan.size && y < plan.size && isWalkable(plan.tiles[y * plan.size + x]);
    for (const c of draws.colliders) {
      if (isPlug(c)) continue; // pinch plugs intentionally clip floor corners
      const tx0 = Math.floor(c.px / 16);
      const ty0 = Math.floor(c.py / 16);
      const tx1 = Math.floor((c.px + c.w - 1) / 16);
      const ty1 = Math.floor((c.py + c.h - 1) / 16);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          expect(walk(tx, ty), `collider intrudes into walkable (${tx},${ty})`).toBe(false);
        }
      }
    }
  });

  it('every wall cell keeps a contiguous solid core of at least MIN_SOLID', () => {
    for (let ty = 0; ty < plan.size; ty++) {
      for (let tx = 0; tx < plan.size; tx++) {
        if (plan.tiles[ty * plan.size + tx] !== Tile.Wall) continue;
        for (const sampleY of [ty * 16 + 2, ty * 16 + 8, ty * 16 + 13]) {
          const covered: boolean[] = Array.from({ length: 16 }, () => false);
          for (const c of draws.colliders) {
            if (sampleY < c.py || sampleY >= c.py + c.h) continue;
            for (let px = 0; px < 16; px++) {
              const wx = tx * 16 + px;
              if (wx >= c.px && wx < c.px + c.w) covered[px] = true;
            }
          }
          let best = 0;
          let cur = 0;
          for (const v of covered) {
            cur = v ? cur + 1 : 0;
            best = Math.max(best, cur);
          }
          expect(best, `wall (${tx},${ty}) row ${sampleY}`).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });

  it('every diagonal pinch is sealed by a corner plug', () => {
    const walk = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < plan.size && y < plan.size && isWalkable(plan.tiles[y * plan.size + x]);
    const plugs = new Set(
      draws.colliders.filter(isPlug).map((c) => `${c.px + 4},${c.py + 4}`),
    );
    let pinches = 0;
    for (let y = 0; y < plan.size - 1; y++) {
      for (let x = 0; x < plan.size - 1; x++) {
        const nw = !walk(x, y);
        const ne = !walk(x + 1, y);
        const sw = !walk(x, y + 1);
        const se = !walk(x + 1, y + 1);
        if ((nw && se && !ne && !sw) || (ne && sw && !nw && !se)) {
          pinches++;
          expect(plugs.has(`${(x + 1) * 16},${(y + 1) * 16}`), `pinch at (${x},${y})`).toBe(true);
        }
      }
    }
    expect(plugs.size).toBe(pinches);
  });

  it('fills every non-walkable cell with a valid piece at its base depth', () => {
    let nonWalkable = 0;
    for (const t of plan.tiles) if (!isWalkable(t)) nonWalkable++;
    expect(draws.walls).toHaveLength(nonWalkable);
    for (const w of draws.walls) {
      expect(w.cell).toBeGreaterThanOrEqual(0);
      expect(w.cell).toBeLessThan(48);
      expect(w.cell).not.toBe(22);
      expect(w.depth).toBe(wallBaseDepth(w.y));
    }
  });

  it('is deterministic for the same plan', () => {
    const again = buildFloorDraws(generate('draws-seed', 5));
    expect(again).toEqual(draws);
  });
});
