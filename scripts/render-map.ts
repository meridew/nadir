/**
 * Offline map preview: emits the exact DTII draw commands the DungeonScene would
 * issue, as JSON, so compose-map.ps1 can composite a PNG without a browser.
 * Usage: npx vite-node scripts/render-map.ts <seed> <depth> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { Tile, generate, isWalkable } from '../src/dungeon/generate';
import { DTII_FRAMES, type DtiiFrameName } from '../src/game/dtii-frames';
import { WALL_LAYER_OFFSET, floorFrameAt, wallPlacements } from '../src/game/tiles';

const seed = process.argv[2] ?? 'alpha';
const depth = Number(process.argv[3] ?? '1');
const out = process.argv[4] ?? 'map.json';

const plan = generate(seed, depth);
const s = plan.size;
const walkableAt = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < s && y < s && isWalkable(plan.tiles[y * s + x]);

interface DrawCmd {
  x: number;
  y: number;
  dy?: number; // extra dest offset in source pixels
  s: readonly [number, number, number, number];
  layer: number;
}

const WALL_LAYER_Z = { capsS: 1, capsN: 2, faces: 3 } as const;
const draws: DrawCmd[] = [];
const push = (name: DtiiFrameName, x: number, y: number, layer: number, dy = 0) =>
  draws.push({ x, y, dy: dy || undefined, s: DTII_FRAMES[name], layer });

for (let y = 0; y < s; y++) {
  for (let x = 0; x < s; x++) {
    const t = plan.tiles[y * s + x];
    if (isWalkable(t)) {
      push(floorFrameAt(x, y, depth), x, y, 0);
    } else if (t === Tile.Wall) {
      for (const p of wallPlacements(walkableAt, x, y)) {
        push(p.name, p.x, p.y, WALL_LAYER_Z[p.layer], WALL_LAYER_OFFSET[p.layer]);
      }
    }
  }
}

if (plan.stairsDown) push('floor_ladder', plan.stairsDown.x, plan.stairsDown.y, 4);
if (plan.prize) push('chest_full_open_anim_f0', plan.prize.x, plan.prize.y, 4);
push('knight_m_idle_anim_f0', plan.spawn.x, plan.spawn.y, 5, -12);

draws.sort((a, b) => a.layer - b.layer || a.y - b.y);
writeFileSync(out, JSON.stringify({ size: s, draws }));
console.log(`wrote ${out}: ${s}x${s}, ${draws.length} draws`);
