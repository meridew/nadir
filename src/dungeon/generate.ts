import { Rng } from '../core/rng';

/** Pure dungeon generation — no Phaser imports, fully unit-testable. */

export const Tile = {
  Void: 0,
  Floor: 1,
  Wall: 2,
  StairsDown: 3,
  Prize: 4,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Floorplan {
  depth: number;
  size: number;
  tiles: Uint8Array; // size * size, row-major
  rooms: Room[];
  spawn: Point;
  stairsDown: Point | null; // null on the nadir floor
  prize: Point | null; // only on the nadir floor
  isNadir: boolean;
}

export const BASE_SIZE = 64;
export const SHRINK = 0.78;
export const MIN_SIZE = 9;

/** Floor side length at a given depth: shrinks geometrically toward MIN_SIZE. */
export function sizeForDepth(depth: number): number {
  return Math.max(MIN_SIZE, Math.round(BASE_SIZE * SHRINK ** (depth - 1)));
}

/** The deepest floor — the nadir — is the first depth whose size bottoms out at MIN_SIZE. */
export function maxDepth(): number {
  let d = 1;
  while (sizeForDepth(d) > MIN_SIZE) d++;
  return d;
}

export function isWalkable(t: number): boolean {
  return t === Tile.Floor || t === Tile.StairsDown || t === Tile.Prize;
}

function roomCenter(r: Room): Point {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

function overlapsWithGap(a: Room, b: Room): boolean {
  return (
    a.x - 1 < b.x + b.w &&
    a.x + a.w + 1 > b.x &&
    a.y - 1 < b.y + b.h &&
    a.y + a.h + 1 > b.y
  );
}

export function generate(seed: string, depth: number): Floorplan {
  const size = sizeForDepth(depth);
  const isNadir = depth >= maxDepth();
  const rng = new Rng(`${seed}:${depth}`);
  const tiles = new Uint8Array(size * size); // all Void

  const at = (x: number, y: number) => tiles[y * size + x];
  const set = (x: number, y: number, t: TileId) => {
    tiles[y * size + x] = t;
  };
  const carve = (x: number, y: number) => {
    if (x > 0 && y > 0 && x < size - 1 && y < size - 1) set(x, y, Tile.Floor);
  };
  const carveLine = (a: Point, b: Point) => {
    // axis-aligned only: one of x/y matches between a and b
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++)
      for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) carve(x, y);
  };

  const rooms: Room[] = [];

  if (isNadir) {
    // The nadir: a single room filling the floor. One space, one confrontation.
    const room: Room = { x: 2, y: 2, w: size - 4, h: size - 4 };
    rooms.push(room);
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) carve(x, y);
  } else {
    const area = size * size;
    const targetRooms = Math.min(12, Math.max(3, Math.round(area / 300)));
    const maxRoomSize = Math.min(9, size - 4);

    for (let attempt = 0; attempt < 250 && rooms.length < targetRooms; attempt++) {
      const w = rng.int(3, maxRoomSize);
      const h = rng.int(3, maxRoomSize);
      const x = rng.int(1, size - w - 1);
      const y = rng.int(1, size - h - 1);
      const candidate: Room = { x, y, w, h };
      if (rooms.some((r) => overlapsWithGap(r, candidate))) continue;
      rooms.push(candidate);
      for (let ry = y; ry < y + h; ry++)
        for (let rx = x; rx < x + w; rx++) carve(rx, ry);
    }

    // Fallback: guarantee at least one room even on a hostile seed.
    if (rooms.length === 0) {
      const w = Math.min(5, size - 4);
      const room: Room = {
        x: Math.floor((size - w) / 2),
        y: Math.floor((size - w) / 2),
        w,
        h: w,
      };
      rooms.push(room);
      for (let ry = room.y; ry < room.y + room.h; ry++)
        for (let rx = room.x; rx < room.x + room.w; rx++) carve(rx, ry);
    }

    // Connect every room to the nearest already-connected room with an L-corridor.
    const connected = [rooms[0]];
    const pending = rooms.slice(1);
    while (pending.length > 0) {
      let bestP = 0;
      let bestC = 0;
      let bestDist = Infinity;
      for (let p = 0; p < pending.length; p++) {
        for (let c = 0; c < connected.length; c++) {
          const a = roomCenter(pending[p]);
          const b = roomCenter(connected[c]);
          const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (d < bestDist) {
            bestDist = d;
            bestP = p;
            bestC = c;
          }
        }
      }
      const from = roomCenter(pending[bestP]);
      const to = roomCenter(connected[bestC]);
      const corner = rng.chance(0.5) ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
      carveLine(from, corner);
      carveLine(corner, to);
      connected.push(pending[bestP]);
      pending.splice(bestP, 1);
    }

    // A few extra corridors turn the tree into a graph with loops — less dead-end backtracking.
    if (rooms.length > 3) {
      const extras = Math.min(3, Math.max(1, Math.round(rooms.length / 4)));
      for (let i = 0; i < extras; i++) {
        const a = roomCenter(rng.pick(rooms));
        const b = roomCenter(rng.pick(rooms));
        if (a.x === b.x && a.y === b.y) continue;
        const corner = rng.chance(0.5) ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
        carveLine(a, corner);
        carveLine(corner, b);
      }
    }
  }

  const spawn = roomCenter(rooms[0]);

  // Farthest walkable tile from spawn by true path distance (BFS) hosts the exit — or the prize.
  const dist = new Int32Array(size * size).fill(-1);
  const queue: number[] = [spawn.y * size + spawn.x];
  dist[queue[0]] = 0;
  let farthest = queue[0];
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const x = idx % size;
    const y = Math.floor(idx / size);
    if (dist[idx] > dist[farthest]) farthest = idx;
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const nIdx = ny * size + nx;
      if (dist[nIdx] === -1 && isWalkable(tiles[nIdx])) {
        dist[nIdx] = dist[idx] + 1;
        queue.push(nIdx);
      }
    }
  }
  const far: Point = { x: farthest % size, y: Math.floor(farthest / size) };

  let stairsDown: Point | null = null;
  let prize: Point | null = null;
  if (isNadir) {
    prize = far;
    set(far.x, far.y, Tile.Prize);
  } else {
    stairsDown = far;
    set(far.x, far.y, Tile.StairsDown);
  }

  // Wrap every carved space in walls.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (at(x, y) !== Tile.Void) continue;
      let touchesFloor = false;
      for (let dy = -1; dy <= 1 && !touchesFloor; dy++)
        for (let dx = -1; dx <= 1 && !touchesFloor; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          if (isWalkable(at(nx, ny))) touchesFloor = true;
        }
      if (touchesFloor) set(x, y, Tile.Wall);
    }
  }

  return { depth, size, tiles, rooms, spawn, stairsDown, prize, isNadir };
}
