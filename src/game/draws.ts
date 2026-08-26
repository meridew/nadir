/**
 * The single source of truth for how a Floorplan becomes draw commands.
 * Both DungeonScene (live Phaser objects) and the offline preview scripts
 * consume this, so live and offline rendering can never drift apart.
 */
import { Tile, isWalkable, type Floorplan } from '../dungeon/generate';
import { wallAtlasCell } from './dtii-blob';
import type { DtiiFrameName } from './dtii-frames';
import { WALL_CELL_INSETS } from './dtii-wall-insets';
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

/** A wall collider rect in world pixels, shrunk to the piece's visible art. */
export interface ColliderRect {
  px: number;
  py: number;
  w: number;
  h: number;
}

export interface FloorDraws {
  ground: GroundDraw[];
  walls: WallDraw[];
  colliders: ColliderRect[];
}

export function buildFloorDraws(plan: Floorplan): FloorDraws {
  const s = plan.size;
  const walkableAt = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < s && y < s && isWalkable(plan.tiles[y * s + x]);
  const wallish = (x: number, y: number) => !walkableAt(x, y);

  const ground: GroundDraw[] = [];
  const walls: WallDraw[] = [];
  const colliders: ColliderRect[] = [];

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (walkableAt(x, y)) {
        ground.push({ x, y, name: floorFrameAt(x, y, plan.depth) });
        continue;
      }

      // The dungeon is carved into solid rock (matching 0x72's own sample
      // composition): EVERY non-walkable cell gets its blob piece, so there is
      // no bare blackness inside the map — the mask-255 interior tile fills
      // deep mass. The tall-wall art is authored to sit ON ground (transparent
      // margins show the floor a wall stands on), so pave under wall cells
      // that touch floor.
      const cell = wallAtlasCell(wallish, x, y);
      let touchesFloor = false;
      for (let dy = -1; dy <= 1 && !touchesFloor; dy++) {
        for (let dx = -1; dx <= 1 && !touchesFloor; dx++) {
          if (walkableAt(x + dx, y + dy)) touchesFloor = true;
        }
      }
      if (touchesFloor) ground.push({ x, y, name: floorFrameAt(x, y, plan.depth) });
      walls.push({ x, y, cell, depth: wallBaseDepth(y) });

      if (plan.tiles[y * s + x] === Tile.Wall) {
        // collide where the wall is VISIBLE: the art's transparent ground
        // margins (side-bar insets, stub flanks) stay walkable.
        const [l, t, r, b] = WALL_CELL_INSETS[cell] ?? [0, 0, 0, 0];
        colliders.push({ px: x * 16 + l, py: y * 16 + t, w: 16 - l - r, h: 16 - t - b });
      }
    }
  }

  return { ground, walls, colliders };
}
