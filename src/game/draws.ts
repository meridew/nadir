/**
 * The single source of truth for how a Floorplan becomes draw commands.
 * Both DungeonScene (live Phaser objects) and the offline preview scripts
 * consume this, so live and offline rendering can never drift apart.
 */
import { Tile, isWalkable, type Floorplan } from '../dungeon/generate';
import { wallAtlasCell } from './dtii-blob';
import type { DtiiFrameName } from './dtii-frames';
import { floorFrameAt } from './tiles';

/** Actors (player, chest, monsters) and wall pieces share one depth space. */
export const ACTOR_DEPTH = 1000;
/** Depth for an actor whose feet are at world-y `feetY`. */
export const actorDepth = (feetY: number) => ACTOR_DEPTH + feetY;
/** Depth for a wall structure standing in tile row `cellY` (base = row bottom). */
export const wallBaseDepth = (cellY: number) => ACTOR_DEPTH + (cellY + 1) * 16;

export interface GroundDraw {
  x: number;
  y: number;
  name: DtiiFrameName;
}

/** One 16x32 blob wall piece, bottom-anchored to its cell, y-sorted by base. */
export interface WallDraw {
  x: number;
  y: number;
  cell: number; // atlas cell index (see dtii-blob.ts)
  depth: number;
}

export interface FloorDraws {
  ground: GroundDraw[];
  walls: WallDraw[];
  colliders: { x: number; y: number }[];
}

export function buildFloorDraws(plan: Floorplan): FloorDraws {
  const s = plan.size;
  const walkableAt = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < s && y < s && isWalkable(plan.tiles[y * s + x]);
  const wallish = (x: number, y: number) => !walkableAt(x, y);

  const ground: GroundDraw[] = [];
  const walls: WallDraw[] = [];
  const colliders: { x: number; y: number }[] = [];

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (walkableAt(x, y)) {
        ground.push({ x, y, name: floorFrameAt(x, y, plan.depth) });
        continue;
      }
      if (plan.tiles[y * s + x] === Tile.Wall) colliders.push({ x, y });

      // The dungeon is carved into solid rock (matching 0x72's own sample
      // composition): EVERY non-walkable cell gets its blob piece, so there is
      // no bare blackness inside the map — the mask-255 interior tile fills
      // deep mass. The tall-wall art is authored to sit ON ground (transparent
      // margins show the floor a wall stands on), so pave under wall cells
      // that touch floor.
      let touchesFloor = false;
      for (let dy = -1; dy <= 1 && !touchesFloor; dy++) {
        for (let dx = -1; dx <= 1 && !touchesFloor; dx++) {
          if (walkableAt(x + dx, y + dy)) touchesFloor = true;
        }
      }
      if (touchesFloor) ground.push({ x, y, name: floorFrameAt(x, y, plan.depth) });
      walls.push({ x, y, cell: wallAtlasCell(wallish, x, y), depth: wallBaseDepth(y) });
    }
  }

  return { ground, walls, colliders };
}
