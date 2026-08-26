import { describe, expect, it } from 'vitest';
import { BLOB_CELL } from './dtii-blob';
import { WALL_CELL_INSETS } from './dtii-wall-insets';

describe('wall collider insets (measured from walls_high.png)', () => {
  it('covers every blob cell with a non-degenerate footprint', () => {
    expect(Object.keys(WALL_CELL_INSETS)).toHaveLength(47);
    for (const cell of Object.values(BLOB_CELL)) {
      const insets = WALL_CELL_INSETS[cell];
      expect(insets, `cell ${cell}`).toBeDefined();
      const [l, t, r, b] = insets;
      for (const v of [l, t, r, b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(15);
      }
      expect(16 - l - r, `cell ${cell} width`).toBeGreaterThanOrEqual(1);
      expect(16 - t - b, `cell ${cell} height`).toBeGreaterThanOrEqual(1);
    }
  });

  it('matches hand-measured reference pieces', () => {
    expect(WALL_CELL_INSETS[0]).toEqual([5, 0, 5, 0]); // top end-cap: 6px stub
    expect(WALL_CELL_INSETS[12]).toEqual([5, 0, 5, 0]); // vertical run: centered bar
    expect(WALL_CELL_INSETS[24]).toEqual([5, 0, 5, 0]); // bottom end-cap
    expect(WALL_CELL_INSETS[35]).toEqual([0, 0, 5, 0]); // west room wall: ground margin east
    expect(WALL_CELL_INSETS[20]).toEqual([5, 0, 0, 0]); // east room wall: ground margin west
    expect(WALL_CELL_INSETS[45]).toEqual([0, 0, 0, 0]); // north-wall face: full cell
    expect(WALL_CELL_INSETS[10]).toEqual([0, 0, 0, 0]); // south-boundary run: full cell
  });
});
