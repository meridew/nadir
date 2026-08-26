/**
 * Renders a hand-written ascii floor ('.'=floor, '#'=wall) through the real
 * draw pipeline (game/draws.ts) — for auditing the wall art on every
 * configuration at once, without hunting seeds.
 * Usage: npx vite-node scripts/render-ascii.ts <layout.txt> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { planFromAscii } from '../src/dungeon/ascii';
import { buildFloorDraws } from '../src/game/draws';
import { cmdsFromDraws, sortCmds } from './draw-json';

const [layoutPath, out = 'ascii-map.json'] = process.argv.slice(2);
const rows = readFileSync(layoutPath, 'utf8')
  .split(/\r?\n/)
  .filter((r) => r.trim().length > 0);

const plan = planFromAscii(rows);
const cmds = sortCmds(cmdsFromDraws(buildFloorDraws(plan)));
writeFileSync(out, JSON.stringify({ size: plan.size, draws: cmds }));
console.log(`wrote ${out}: ${plan.size}x${plan.size}, ${cmds.length} draws`);
