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

/** Minimum collider core thickness — part of the anti-tunneling invariant (game/physics.ts). */
export const MIN_SOLID = 8;

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
  // per-cell solid x-intervals, gathered for run-merging (colX → rowY → [l, r])
  const cellIntervals = new Map<number, Map<number, [number, number]>>();

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
        // Collide where the wall is VISIBLE: the art's transparent ground
        // margins (side-bar insets, stub flanks) stay walkable. An inset only
        // applies on sides that actually face floor — wall-facing sides fuse
        // to the cell edge.
        const [l0, t0, r0, b0] = WALL_CELL_INSETS[cell] ?? [0, 0, 0, 0];
        let l = walkableAt(x - 1, y) ? l0 : 0;
        let t = walkableAt(x, y - 1) ? t0 : 0;
        let r = walkableAt(x + 1, y) ? r0 : 0;
        let b = walkableAt(x, y + 1) ? b0 : 0;
        // DEPTH-MODEL INVARIANT: sprites may overlap wall art vertically (head
        // over faces, legs behind south caps) but NEVER horizontally over side
        // bars — per-cell base sorting cannot order that overlap for pieces
        // that join two structures (corners). Sprites overhang the feet box by
        // 3px, so stop the body 3px before the visible bar: the sprite lands
        // flush on the bar — zero gap, zero overlap.
        const SPRITE_MARGIN_X = 3;
        if (l > 0) l = Math.max(0, l - SPRITE_MARGIN_X);
        if (r > 0) r = Math.max(0, r - SPRITE_MARGIN_X);
        // Solver hardening: thin colliders invite Arcade separation artifacts
        // (direction flip-flops, push-embed pass-throughs). Guarantee a solid
        // core by narrowing floor margins when needed...
        while (16 - l - r < MIN_SOLID && l + r > 0) {
          if (l >= r) l--;
          else r--;
        }
        while (16 - t - b < MIN_SOLID && t + b > 0) {
          if (t >= b) t--;
          else b--;
        }
        if (t !== 0 || b !== 0) {
          // vertical insets (none in the current art) would fall back to a lone rect
          colliders.push({ px: x * 16 + l, py: y * 16 + t, w: 16 - l - r, h: 16 - t - b });
        } else {
          if (!cellIntervals.has(x)) cellIntervals.set(x, new Map());
          cellIntervals.get(x)!.set(y, [l, 16 - r]);
        }
      }
    }
  }

  // Merge cell colliders into maximal vertical rects. Stacked per-cell rects
  // with different insets create "ledge" seams where Arcade's one-shot
  // separation can scrum a sliding body between alternating pushes and ratchet
  // it through the wall (reproducible by wall-grinding). Splitting each
  // column-run at its inset cut points and fusing identical spans leaves no
  // internal ledge pairs: a wall line becomes one tall column plus flush lips.
  for (const [colX, rowMap] of cellIntervals) {
    const rows = [...rowMap.keys()].sort((a, b) => a - b);
    let runStart = 0;
    for (let i = 0; i <= rows.length; i++) {
      const runEnds = i === rows.length || (i > 0 && rows[i] !== rows[i - 1] + 1);
      if (!runEnds) continue;
      const run = rows.slice(runStart, i);
      runStart = i;
      const cuts = new Set<number>();
      for (const ry of run) {
        const [a, b] = rowMap.get(ry)!;
        cuts.add(a);
        cuts.add(b);
      }
      const bounds = [...cuts].sort((a, b) => a - b);
      for (let c = 0; c < bounds.length - 1; c++) {
        const a = bounds[c];
        const b = bounds[c + 1];
        let streak = -1;
        for (let ri = 0; ri <= run.length; ri++) {
          const solid =
            ri < run.length && rowMap.get(run[ri])![0] <= a && rowMap.get(run[ri])![1] >= b;
          if (solid && streak < 0) streak = ri;
          if (!solid && streak >= 0) {
            colliders.push({
              px: colX * 16 + a,
              py: run[streak] * 16,
              w: b - a,
              h: (ri - streak) * 16,
            });
            streak = -1;
          }
        }
      }
    }
  }

  // Seal diagonal pinches: where two wall cells meet only at a corner with
  // floor on the crossing diagonal, their floor-facing insets would open a
  // squeeze path that full-cell colliders never allowed. A small plug on the
  // shared corner restores impassability without touching approach feel.
  const PLUG_HALF = 4;
  for (let y = 0; y < s - 1; y++) {
    for (let x = 0; x < s - 1; x++) {
      const wallNW = !walkableAt(x, y);
      const wallNE = !walkableAt(x + 1, y);
      const wallSW = !walkableAt(x, y + 1);
      const wallSE = !walkableAt(x + 1, y + 1);
      const pinch = (wallNW && wallSE && !wallNE && !wallSW) || (wallNE && wallSW && !wallNW && !wallSE);
      if (pinch) {
        colliders.push({
          px: (x + 1) * 16 - PLUG_HALF,
          py: (y + 1) * 16 - PLUG_HALF,
          w: PLUG_HALF * 2,
          h: PLUG_HALF * 2,
        });
      }
    }
  }

  return { ground, walls, colliders };
}
