/** Art bindings for 0x72 DungeonTileset II: texture keys, tile indices, wall grammar. */
import { DTII_FRAMES, SHEET_COLS, type DtiiFrameName } from './dtii-frames';

export const TILE_SIZE = 16;
export const TILES_KEY = 'dtii_tiles'; // spritesheet view of the sheet, for tilemap layers
export const ATLAS_KEY = 'dtii'; // atlas view of the same sheet, for sprites & animations
export const SHEET_URL = 'assets/dtii/dungeon_sheet.png';
export const ATLAS_URL = 'assets/dtii/atlas.json';

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

/**
 * Wall grammar, matching 0x72's own sample composition:
 * - wall with floor SOUTH (north wall band): brick face, stone cap in the cell above;
 * - wall with floor NORTH (south boundary): brick face, stone cap tucked under it
 *   (the capsS layer is shifted +6px so the cap hugs the face's bottom edge);
 * - wall beside floor: thin stone edge strip on the floor side;
 * - diagonal-only floor contact: corner join pieces;
 * - deeper wall mass: darkness (no tile).
 */
export type WallLayerName = 'faces' | 'capsN' | 'capsS';

/** Vertical pixel offset per wall layer (capsS tucks caps under south-boundary faces). */
export const WALL_LAYER_OFFSET: Record<WallLayerName, number> = {
  faces: 0,
  capsN: 0,
  capsS: 6,
};

export interface WallPlacement {
  layer: WallLayerName;
  x: number;
  y: number;
  name: DtiiFrameName;
}

export function wallPlacements(
  walkable: (x: number, y: number) => boolean,
  x: number,
  y: number,
): WallPlacement[] {
  const n = walkable(x, y - 1);
  const s = walkable(x, y + 1);
  const w = walkable(x - 1, y);
  const e = walkable(x + 1, y);
  const face: DtiiFrameName = w ? 'wall_left' : e ? 'wall_right' : 'wall_mid';
  const cap: DtiiFrameName = w ? 'wall_top_left' : e ? 'wall_top_right' : 'wall_top_mid';

  if (s) {
    return [
      { layer: 'faces', x, y, name: face },
      { layer: 'capsN', x, y: y - 1, name: cap },
    ];
  }
  if (n) {
    return [
      { layer: 'faces', x, y, name: face },
      { layer: 'capsS', x, y, name: cap },
    ];
  }
  // Edge-piece names say where the stone strip sits on the tile ("left" = strip
  // on the tile's left side), so the strip goes on the side that touches floor.
  if (w && e) {
    // one-tile vertical divider: strips on both sides via two layers
    return [
      { layer: 'faces', x, y, name: 'wall_edge_mid_left' },
      { layer: 'capsN', x, y, name: 'wall_edge_mid_right' },
    ];
  }
  if (e) return [{ layer: 'faces', x, y, name: 'wall_edge_mid_right' }]; // strip on its east side
  if (w) return [{ layer: 'faces', x, y, name: 'wall_edge_mid_left' }]; // strip on its west side

  const se = walkable(x + 1, y + 1);
  const sw = walkable(x - 1, y + 1);
  const ne = walkable(x + 1, y - 1);
  const nw = walkable(x - 1, y - 1);
  if (se) return [{ layer: 'faces', x, y, name: 'wall_edge_top_right' }];
  if (sw) return [{ layer: 'faces', x, y, name: 'wall_edge_top_left' }];
  if (ne) return [{ layer: 'faces', x, y, name: 'wall_edge_bottom_right' }];
  if (nw) return [{ layer: 'faces', x, y, name: 'wall_edge_bottom_left' }];
  return [];
}
