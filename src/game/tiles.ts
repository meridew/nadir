/** Art bindings for 0x72 DungeonTileset II: texture keys and frame helpers. */
import { DTII_FRAMES, SHEET_COLS, type DtiiFrameName } from './dtii-frames';

export const TILE_SIZE = 16;
/** World-pixel center of a tile coordinate. */
export const tileCenter = (t: number) => t * TILE_SIZE + TILE_SIZE / 2;

export const TILES_KEY = 'dtii_tiles'; // spritesheet view of the main sheet, for tilemap layers
export const ATLAS_KEY = 'dtii'; // atlas view of the main sheet, for sprites & animations
export const WALLS_KEY = 'dtii_walls'; // 16x32 blob wall atlas (see game/dtii-blob.ts)
export const SHEET_URL = 'assets/dtii/dungeon_sheet.png';
export const ATLAS_URL = 'assets/dtii/atlas.json';
export const WALLS_URL = 'assets/dtii/walls_high.png';

/** Whether a frame can be used as a tilemap tile (16x16 and on the sheet's 16px grid). */
export function isGridTile(name: DtiiFrameName): boolean {
  const [x, y, w, h] = DTII_FRAMES[name];
  return w === TILE_SIZE && h === TILE_SIZE && x % TILE_SIZE === 0 && y % TILE_SIZE === 0;
}

/** Tilemap index of a grid-aligned 16x16 frame. */
export function tileIndex(name: DtiiFrameName): number {
  if (!isGridTile(name)) {
    // e.g. the wall_edge_* family sits at y%16==8 in the sheet — render those as images.
    throw new Error(`${name} is not a grid-aligned 16x16 tile`);
  }
  const [x, y] = DTII_FRAMES[name];
  return (y / TILE_SIZE) * SHEET_COLS + x / TILE_SIZE;
}

/** Deterministic per-cell pick so floors don't shimmer between rebuilds. */
export function variantAt<T>(variants: readonly T[], x: number, y: number, salt = 0): T {
  const h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  return variants[Math.abs(h) % variants.length];
}

const FLOORS: readonly DtiiFrameName[] = [
  ...Array.from({ length: 17 }, () => 'floor_1' as const),
  'floor_2',
  'floor_3',
  'floor_4',
  'floor_7',
  'floor_8',
];

export function floorFrameAt(x: number, y: number, salt = 0): DtiiFrameName {
  return variantAt(FLOORS, x, y, salt);
}
