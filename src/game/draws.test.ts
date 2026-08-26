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
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++)
        for (let dx = -1; dx <= 1 && !touches; dx++) {
          if (walk(c.x + dx, c.y + dy)) touches = true;
        }
      if (touches) expect(groundCells.has(`${c.x},${c.y}`), `wall (${c.x},${c.y})`).toBe(true);
    }
  });

  it('every collider cell also has a wall drawing', () => {
    const drawn = new Set(draws.walls.map((w) => `${w.x},${w.y}`));
    for (const c of draws.colliders) {
      expect(drawn.has(`${c.x},${c.y}`), `collider (${c.x},${c.y})`).toBe(true);
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
