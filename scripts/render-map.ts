/**
 * Offline map preview: converts the shared draw commands (game/draws.ts — the
 * same ones DungeonScene materializes) into JSON for compose-map.ps1.
 * Usage: npx vite-node scripts/render-map.ts <seed> <depth> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { generate } from '../src/dungeon/generate';
import { actorDepth, buildFloorDraws } from '../src/game/draws';
import { DTII_FRAMES } from '../src/game/dtii-frames';
import { TILE_SIZE } from '../src/game/tiles';
import { YSORT_LAYER, cmdsFromDraws, sortCmds } from './draw-json';

const seed = process.argv[2] ?? 'alpha';
const depth = Number(process.argv[3] ?? '1');
const out = process.argv[4] ?? 'map.json';

const plan = generate(seed, depth);
const cmds = cmdsFromDraws(buildFloorDraws(plan));

if (plan.stairsDown) {
  cmds.push({ x: plan.stairsDown.x, y: plan.stairsDown.y, s: DTII_FRAMES.floor_ladder, layer: 4 });
}
if (plan.prize) {
  cmds.push({
    x: plan.prize.x,
    y: plan.prize.y,
    sy: actorDepth((plan.prize.y + 1) * TILE_SIZE),
    s: DTII_FRAMES.chest_full_open_anim_f0,
    layer: YSORT_LAYER,
  });
}
cmds.push({
  x: plan.spawn.x,
  y: plan.spawn.y,
  dy: -12,
  sy: actorDepth((plan.spawn.y + 1) * TILE_SIZE),
  s: DTII_FRAMES.knight_m_idle_anim_f0,
  layer: YSORT_LAYER,
});

writeFileSync(out, JSON.stringify({ size: plan.size, draws: sortCmds(cmds) }));
console.log(`wrote ${out}: ${plan.size}x${plan.size}, ${cmds.length} draws`);
