import { describe, expect, it } from 'vitest';
import { Tile, generate, isWalkable } from '../dungeon/generate';
import { buildFloorDraws, wallBaseDepth } from './draws';

describe('buildFloorDraws', () => {
  const plan = generate('draws-seed', 5);
  const draws = buildFloorDraws(plan);

  it('draws one ground tile per walkable cell and one collider per wall', () => {
    let walkable = 0;
    let walls = 0;
    for (const t of plan.tiles) {
      if (isWalkable(t)) walkable++;
      else if (t === Tile.Wall) walls++;
    }
    expect(draws.ground).toHaveLength(walkable);
    expect(draws.colliders).toHaveLength(walls);
  });

  it('every collider cell also has a wall drawing', () => {
    const drawn = new Set(draws.walls.map((w) => `${w.x},${w.y}`));
    for (const c of draws.colliders) {
      expect(drawn.has(`${c.x},${c.y}`), `collider (${c.x},${c.y})`).toBe(true);
    }
  });

  it('every wall piece has a valid atlas cell and its base depth', () => {
    expect(draws.walls.length).toBeGreaterThan(0);
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
