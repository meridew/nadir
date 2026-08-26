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
    expect(draws.colliders).toHaveLength(walls);
  });

  it('paves ground under every wall cell that touches floor', () => {
    const groundCells = new Set(draws.ground.map((g) => `${g.x},${g.y}`));
    const walk = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < plan.size && y < plan.size && isWalkable(plan.tiles[y * plan.size + x]);
    for (const c of draws.colliders) {
      const tx = Math.floor(c.px / 16);
      const ty = Math.floor(c.py / 16);
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++)
        for (let dx = -1; dx <= 1 && !touches; dx++) {
          if (walk(tx + dx, ty + dy)) touches = true;
        }
      if (touches) expect(groundCells.has(`${tx},${ty}`), `wall (${tx},${ty})`).toBe(true);
    }
  });

  it('collider rects stay inside their cell and match a wall drawing', () => {
    const drawn = new Set(draws.walls.map((w) => `${w.x},${w.y}`));
    for (const c of draws.colliders) {
      const tx = Math.floor(c.px / 16);
      const ty = Math.floor(c.py / 16);
      expect(drawn.has(`${tx},${ty}`), `collider (${tx},${ty})`).toBe(true);
      expect(c.w).toBeGreaterThanOrEqual(1);
      expect(c.h).toBeGreaterThanOrEqual(1);
      expect(c.px + c.w).toBeLessThanOrEqual((tx + 1) * 16);
      expect(c.py + c.h).toBeLessThanOrEqual((ty + 1) * 16);
    }
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
