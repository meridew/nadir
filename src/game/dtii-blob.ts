/**
 * Blob autotiling for DTII's 16x32 tall-wall atlas (public/assets/dtii/walls_high.png).
 *
 * The atlas follows the Godot "3x3 minimal" autotile template (the pack README
 * links godot-docs issue #3316). BLOB_CELL was machine-extracted from the
 * official template marker image (godot-docs `autotile_template_3x3_minimal.png`)
 * and validated exhaustively: the template's 48 cells decode to exactly the 47
 * canonical neighbor classes with no duplicates or gaps (cell 22 is the
 * template's blank cell). See dtii-blob.test.ts for the standing proof.
 *
 * Mask bits (cr31 blob convention): N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64,
 * NW=128. A bit is set when that neighbor is wall-like (wall, void, or out of
 * bounds). Corner bits only count when both adjacent edge bits are set.
 */

export const WALL_ATLAS_COLS = 12;
export const WALL_TILE_W = 16;
export const WALL_TILE_H = 32;

/** Canonical corner reduction: corners only matter when both adjacent edges are set. */
export function blobReduce(mask: number): number {
  const n = mask & 1;
  const e = mask & 4;
  const s = mask & 16;
  const w = mask & 64;
  let out = n | e | s | w;
  if (n && e && mask & 2) out |= 2;
  if (s && e && mask & 8) out |= 8;
  if (s && w && mask & 32) out |= 32;
  if (n && w && mask & 128) out |= 128;
  return out;
}

/** Reduced mask → atlas cell index (row-major in a 12-column atlas). */
export const BLOB_CELL: Readonly<Record<number, number>> = {
  0: 36,
  1: 24,
  4: 37,
  5: 25,
  7: 44,
  16: 0,
  17: 12,
  20: 1,
  21: 13,
  23: 28,
  28: 8,
  29: 16,
  31: 20,
  64: 39,
  65: 27,
  68: 38,
  69: 26,
  71: 41,
  80: 3,
  81: 15,
  84: 2,
  85: 14,
  87: 7,
  92: 5,
  93: 43,
  95: 32,
  112: 11,
  113: 19,
  116: 6,
  117: 40,
  119: 21,
  124: 10,
  125: 9,
  127: 17,
  193: 47,
  197: 42,
  199: 45,
  209: 31,
  213: 4,
  215: 46,
  221: 34,
  223: 29,
  241: 35,
  245: 23,
  247: 30,
  253: 18,
  255: 33,
};

/**
 * Atlas cell for the wall structure at (x, y), given a lookup that reports
 * whether a coordinate is wall-like (wall, void, or out of bounds).
 */
export function wallAtlasCell(
  wallish: (x: number, y: number) => boolean,
  x: number,
  y: number,
): number {
  let mask = 0;
  if (wallish(x, y - 1)) mask |= 1;
  if (wallish(x + 1, y - 1)) mask |= 2;
  if (wallish(x + 1, y)) mask |= 4;
  if (wallish(x + 1, y + 1)) mask |= 8;
  if (wallish(x, y + 1)) mask |= 16;
  if (wallish(x - 1, y + 1)) mask |= 32;
  if (wallish(x - 1, y)) mask |= 64;
  if (wallish(x - 1, y - 1)) mask |= 128;
  const cell = BLOB_CELL[blobReduce(mask)];
  if (cell === undefined) {
    throw new Error(`no blob cell for mask ${mask} (reduced ${blobReduce(mask)})`);
  }
  return cell;
}
