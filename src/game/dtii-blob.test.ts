import { describe, expect, it } from 'vitest';
import { BLOB_CELL, blobReduce, wallAtlasCell } from './dtii-blob';

describe('blob autotile oracle', () => {
  it('reduction of all 256 neighborhoods yields exactly the 47 canonical classes', () => {
    const classes = new Set<number>();
    for (let m = 0; m < 256; m++) classes.add(blobReduce(m));
    expect(classes.size).toBe(47);
  });

  it('reduction is idempotent', () => {
    for (let m = 0; m < 256; m++) {
      expect(blobReduce(blobReduce(m))).toBe(blobReduce(m));
    }
  });

  it('the table covers every canonical class exactly, with distinct cells', () => {
    const classes = new Set<number>();
    for (let m = 0; m < 256; m++) classes.add(blobReduce(m));
    const cells = new Set<number>();
    for (const cls of classes) {
      const cell = BLOB_CELL[cls];
      expect(cell, `class ${cls}`).toBeTypeOf('number');
      expect(cells.has(cell), `cell ${cell} reused`).toBe(false);
      cells.add(cell);
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(48);
      expect(cell).not.toBe(22); // the template's blank cell
    }
    expect(Object.keys(BLOB_CELL)).toHaveLength(47);
  });

  it('template cells map through the 24-column physical sheet', async () => {
    const { wallSheetFrame, wallFrameRect } = await import('./dtii-blob');
    expect(wallSheetFrame(0)).toBe(0);
    expect(wallSheetFrame(11)).toBe(11);
    expect(wallSheetFrame(12)).toBe(24); // template row 1 starts at physical frame 24
    expect(wallSheetFrame(33)).toBe(9 + 2 * 24);
    expect(wallSheetFrame(47)).toBe(11 + 3 * 24);
    expect(wallFrameRect(12)).toEqual([0, 32, 16, 32]);
    expect(wallFrameRect(47)).toEqual([11 * 16, 3 * 32, 16, 32]);
  });

  it('spot checks against the template', () => {
    expect(BLOB_CELL[16]).toBe(0); // south-only: top end of a vertical run
    expect(BLOB_CELL[255]).toBe(33); // fully interior
    expect(BLOB_CELL[0]).toBe(36); // isolated pillar
    expect(BLOB_CELL[17]).toBe(12); // north+south: vertical run
  });

  it('wallAtlasCell resolves neighborhoods (donut north wall)', () => {
    const rows = ['###', '#.#', '###'];
    // wall-like = anything that is not the centre floor (out of bounds included)
    const wallish = (x: number, y: number) => rows[y]?.[x] !== '.';
    // north wall cell (1,0): everything around is wall except floor to the south
    // raw mask = N+NE+E+W+NW (+SE/SW dropped by reduction since S is floor) = 199
    expect(wallAtlasCell(wallish, 1, 0)).toBe(BLOB_CELL[199]);
    // side wall (0,1): floor to the east only
    expect(wallAtlasCell(wallish, 0, 1)).toBe(BLOB_CELL[blobReduce(255 - 4 - 2 - 8)]);
  });
});
