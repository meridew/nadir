/**
 * Renders a hand-written ascii floor ('.'=floor, '#'=wall) through the real
 * draw pipeline (game/draws.ts) — for auditing the wall art on every
 * configuration at once, without hunting seeds.
 * Usage: npx vite-node scripts/render-ascii.ts <layout.txt> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Tile, type Floorplan } from '../src/dungeon/generate';
import { buildFloorDraws } from '../src/game/draws';
import { cmdsFromDraws, sortCmds } from './draw-json';

const [layoutPath, out = 'ascii-map.json'] = process.argv.slice(2);
const rows = readFileSync(layoutPath, 'utf8')
  .split(/\r?\n/)
  .filter((r) => r.trim().length > 0);

const size = Math.max(rows.length, ...rows.map((r) => r.length));
const tiles = new Uint8Array(size * size); // Void
for (let y = 0; y < rows.length; y++) {
  for (let x = 0; x < rows[y].length; x++) {
    if (rows[y][x] === '.') tiles[y * size + x] = Tile.Floor;
  }
}
// walls wrap floors exactly like generate() does
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    if (tiles[y * size + x] !== Tile.Void) continue;
    let touches = false;
    for (let dy = -1; dy <= 1 && !touches; dy++)
      for (let dx = -1; dx <= 1 && !touches; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        if (tiles[ny * size + nx] === Tile.Floor) touches = true;
      }
    if (touches) tiles[y * size + x] = Tile.Wall;
  }
}

const plan: Floorplan = {
  depth: 1,
  size,
  tiles,
  rooms: [],
  spawn: { x: 0, y: 0 },
  stairsDown: null,
  prize: null,
  isNadir: false,
};

const cmds = sortCmds(cmdsFromDraws(buildFloorDraws(plan)));
writeFileSync(out, JSON.stringify({ size, draws: cmds }));
console.log(`wrote ${out}: ${size}x${size}, ${cmds.length} draws`);
