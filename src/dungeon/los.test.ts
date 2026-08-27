import { describe, expect, it } from 'vitest';
import { lineOfSight } from './los';

/** '.' = walkable, '#' = wall; out of bounds is wall. */
const grid = (rows: string[]) => (tx: number, ty: number) =>
  ty >= 0 && ty < rows.length && tx >= 0 && tx < rows[ty].length && rows[ty][tx] === '.';

const center = (t: number) => t + 0.5;

describe('lineOfSight', () => {
  it('sees across an open room, in both directions', () => {
    const walk = grid(['.....', '.....', '.....']);
    expect(lineOfSight(walk, center(0), center(0), center(4), center(2))).toBe(true);
    expect(lineOfSight(walk, center(4), center(2), center(0), center(0))).toBe(true);
  });

  it('sees within the same tile and along straight corridors', () => {
    const walk = grid(['#####', '.....', '#####']);
    expect(lineOfSight(walk, 1.2, 1.4, 1.8, 1.6)).toBe(true);
    expect(lineOfSight(walk, center(0), center(1), center(4), center(1))).toBe(true);
  });

  it('is blocked by a wall column between the endpoints', () => {
    const walk = grid(['..#..', '..#..', '..#..']);
    expect(lineOfSight(walk, center(0), center(1), center(4), center(1))).toBe(false);
    expect(lineOfSight(walk, center(1), center(0), center(3), center(2))).toBe(false);
  });

  it('cannot see around a corridor bend', () => {
    const walk = grid([
      '####.',
      '####.',
      '.....',
    ]);
    expect(lineOfSight(walk, center(0), center(2), center(4), center(0))).toBe(false);
    // but sees the bend tile itself
    expect(lineOfSight(walk, center(0), center(2), center(4), center(2))).toBe(true);
  });

  it('never squeezes through an exact diagonal wall pinch', () => {
    const pinched = grid(['.#', '#.']);
    expect(lineOfSight(pinched, center(0), center(0), center(1), center(1))).toBe(false);
    const open = grid(['..', '..']);
    expect(lineOfSight(open, center(0), center(0), center(1), center(1))).toBe(true);
  });

  it('fails when either endpoint stands in a wall', () => {
    const walk = grid(['.#.']);
    expect(lineOfSight(walk, center(1), center(0), center(2), center(0))).toBe(false);
    expect(lineOfSight(walk, center(0), center(0), center(1), center(0))).toBe(false);
  });

  it('handles fractional endpoints crossing many tiles', () => {
    const walk = grid(['........', '...##...', '........']);
    // grazes under the wall pair — the ray from (0,2.9) to (7,2.9)-ish stays in row 2
    expect(lineOfSight(walk, 0.5, 2.9, 7.5, 2.1)).toBe(true);
    // through the wall pair
    expect(lineOfSight(walk, 0.5, 0.5, 7.5, 2.5)).toBe(false);
  });
});
