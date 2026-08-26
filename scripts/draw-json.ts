/** Shared conversion: FloorDraws → compose-map.ps1 draw commands. */
import { wallFrameRect } from '../src/game/dtii-blob';
import type { FloorDraws } from '../src/game/draws';
import { DTII_FRAMES } from '../src/game/dtii-frames';

export interface DrawCmd {
  x: number;
  y: number;
  dy?: number; // extra dest offset in source pixels
  sy?: number; // sort key within a layer (walls/actors y-sort together)
  s: readonly [number, number, number, number];
  layer: number;
  sheet?: number; // 0 = main sheet (default), 1 = walls atlas
}

export const YSORT_LAYER = 5;

export function cmdsFromDraws(draws: FloorDraws): DrawCmd[] {
  const cmds: DrawCmd[] = [];
  for (const g of draws.ground) {
    cmds.push({ x: g.x, y: g.y, s: DTII_FRAMES[g.name], layer: 0 });
  }
  for (const w of draws.walls) {
    cmds.push({
      x: w.x,
      y: w.y,
      dy: -16, // 16x32 piece, bottom-anchored to its cell
      sy: w.depth,
      s: wallFrameRect(w.cell),
      layer: YSORT_LAYER,
      sheet: 1,
    });
  }
  return cmds;
}

export function sortCmds(cmds: DrawCmd[]): DrawCmd[] {
  return cmds.sort((a, b) => a.layer - b.layer || (a.sy ?? 0) - (b.sy ?? 0) || a.y - b.y);
}
