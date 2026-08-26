/** Build a Floorplan from ascii rows ('.'=floor, '#'=wall/void) — for tests & tooling. */
import { Tile, type Floorplan } from './generate';

export function planFromAscii(rows: string[]): Floorplan {
  const size = Math.max(rows.length, ...rows.map((r) => r.length));
  const tiles = new Uint8Array(size * size); // Void
  let spawn: { x: number; y: number } | null = null;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] === '.') {
        tiles[y * size + x] = Tile.Floor;
        spawn = spawn ?? { x, y };
      }
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
  return {
    depth: 1,
    size,
    tiles,
    rooms: [],
    spawn: spawn ?? { x: 0, y: 0 },
    stairsDown: null,
    prize: null,
    isNadir: false,
  };
}
