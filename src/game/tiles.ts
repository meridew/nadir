/**
 * Frame indices into Kenney's Tiny Dungeon packed tilesheet (12 cols x 11 rows, 16px, CC0).
 * public/assets/tilemap_packed.png
 */

export const TILE_SIZE = 16;
export const SHEET_KEY = 'tiles';

export const TILES = {
  /** Weighted floor variants — mostly plain, occasional speckle/crack. */
  floorVariants: [48, 48, 48, 48, 48, 50, 50, 49, 52, 51],
  /** Weighted wall variants — brick face, occasional alternate. */
  wallVariants: [57, 57, 57, 59],
  ladderDown: 63,
  player: 96,
  prizeClosed: 89,
  prizeOpen: 91,
} as const;

/** Deterministic per-cell variant pick so floors don't shimmer between rebuilds. */
export function variantAt(variants: readonly number[], x: number, y: number, salt = 0): number {
  const h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  return variants[Math.abs(h) % variants.length];
}
