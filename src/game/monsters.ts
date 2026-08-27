/**
 * The monster bench: species registry (DTII art bindings + stats) and pure
 * spawn placement. No Phaser — fully unit-tested; entities/Monster.ts and the
 * scene do the wiring.
 */
import { Rng } from '../core/rng';
import { Tile, isWalkable, type Floorplan } from '../dungeon/generate';

export type MonsterSpeciesId =
  | 'tiny_zombie'
  | 'goblin'
  | 'imp'
  | 'skelet'
  | 'orc_warrior'
  | 'masked_orc'
  | 'chort'
  | 'wogol'
  | 'necromancer'
  | 'big_demon';

export interface MonsterSpeciesDef {
  id: MonsterSpeciesId;
  /** atlas frame prefixes; frames are `${prefix}${0..3}` (necromancer has one anim — both prefixes match) */
  idlePrefix: string;
  runPrefix: string;
  /** physics feet box in sprite-local px, same convention as entities/Player */
  bodySize: [w: number, h: number];
  bodyOffset: [x: number, y: number];
  shadow: { width: number; height: number };
  /** px/s — every entry stays under PLAYER_SPEED (you can always disengage) and the anti-tunneling bound (game/physics.ts) */
  speed: number;
  /** hits to kill (SWORD_DAMAGE units — see game/combat.ts) */
  hp: number;
  /** contact damage to the player, in half-hearts */
  damage: number;
  /** sword-knockback multiplier (default 1; the boss barely budges) */
  knockbackScale?: number;
  /** px — sighting the player inside this range starts a chase */
  aggroRadius: number;
}

// feet boxes: flat like the player's, bottom a couple px above the sprite so
// legs overhang south walls (16x16 fry vs 16x23 tall sprites)
type BodyPlan = Pick<MonsterSpeciesDef, 'bodySize' | 'bodyOffset' | 'shadow'>;
const FRY_BODY: BodyPlan = { bodySize: [10, 4], bodyOffset: [3, 10], shadow: { width: 10, height: 4 } };
const TALL_BODY: BodyPlan = { bodySize: [10, 4], bodyOffset: [3, 15], shadow: { width: 11, height: 4 } };

export const MONSTER_SPECIES: Record<MonsterSpeciesId, MonsterSpeciesDef> = {
  tiny_zombie: {
    id: 'tiny_zombie',
    idlePrefix: 'tiny_zombie_idle_anim_f',
    runPrefix: 'tiny_zombie_run_anim_f',
    ...FRY_BODY,
    speed: 42,
    hp: 1,
    damage: 1,
    aggroRadius: 88,
  },
  goblin: {
    id: 'goblin',
    idlePrefix: 'goblin_idle_anim_f',
    runPrefix: 'goblin_run_anim_f',
    ...FRY_BODY,
    speed: 68,
    hp: 1,
    damage: 1,
    aggroRadius: 96,
  },
  imp: {
    id: 'imp',
    idlePrefix: 'imp_idle_anim_f',
    runPrefix: 'imp_run_anim_f',
    ...FRY_BODY,
    speed: 76,
    hp: 1,
    damage: 1,
    aggroRadius: 112,
  },
  skelet: {
    id: 'skelet',
    idlePrefix: 'skelet_idle_anim_f',
    runPrefix: 'skelet_run_anim_f',
    ...FRY_BODY,
    speed: 55,
    hp: 2,
    damage: 1,
    aggroRadius: 112,
  },
  orc_warrior: {
    id: 'orc_warrior',
    idlePrefix: 'orc_warrior_idle_anim_f',
    runPrefix: 'orc_warrior_run_anim_f',
    ...TALL_BODY,
    speed: 58,
    hp: 2,
    damage: 1,
    aggroRadius: 96,
  },
  masked_orc: {
    id: 'masked_orc',
    idlePrefix: 'masked_orc_idle_anim_f',
    runPrefix: 'masked_orc_run_anim_f',
    ...TALL_BODY,
    speed: 64,
    hp: 2,
    damage: 1,
    aggroRadius: 104,
  },
  chort: {
    id: 'chort',
    idlePrefix: 'chort_idle_anim_f',
    runPrefix: 'chort_run_anim_f',
    ...TALL_BODY,
    speed: 80,
    hp: 2,
    damage: 1,
    aggroRadius: 128,
  },
  wogol: {
    id: 'wogol',
    idlePrefix: 'wogol_idle_anim_f',
    runPrefix: 'wogol_run_anim_f',
    ...TALL_BODY,
    speed: 70,
    hp: 2,
    damage: 1,
    aggroRadius: 128,
  },
  necromancer: {
    id: 'necromancer',
    idlePrefix: 'necromancer_anim_f',
    runPrefix: 'necromancer_anim_f',
    ...TALL_BODY,
    speed: 45,
    hp: 2,
    damage: 1,
    aggroRadius: 144,
  },
  // The nadir's warden (32×36). Never in a depth band — bossFor places it.
  big_demon: {
    id: 'big_demon',
    idlePrefix: 'big_demon_idle_anim_f',
    runPrefix: 'big_demon_run_anim_f',
    bodySize: [16, 6],
    bodyOffset: [8, 27],
    shadow: { width: 20, height: 6 },
    speed: 40,
    hp: 8,
    damage: 2,
    knockbackScale: 0.25,
    aggroRadius: 160,
  },
};

export type MonsterAnimKey = `m_${MonsterSpeciesId}_idle` | `m_${MonsterSpeciesId}_run`;

/** Anim registry key for a species (rows are registered from this table in game/anims.ts). */
export function monsterAnim(id: MonsterSpeciesId, kind: 'idle' | 'run'): MonsterAnimKey {
  return `m_${id}_${kind}`;
}

/** The bench by depth band: fry up top, brutes mid, demons deep. The boss is placed by bossFor, never banded. */
export function speciesForDepth(depth: number): MonsterSpeciesId[] {
  if (depth <= 3) return ['tiny_zombie', 'goblin', 'imp'];
  if (depth <= 6) return ['skelet', 'orc_warrior', 'masked_orc'];
  return ['chort', 'wogol', 'necromancer'];
}

/**
 * The nadir's confrontation: big_demon stands one step inward from the prize,
 * between it and the room. Deterministic — no RNG, no seed.
 */
export function bossFor(plan: Floorplan): MonsterSpawn | null {
  if (!plan.isNadir || !plan.prize) return null;
  const room = plan.rooms[0];
  const cx = room.x + Math.floor(room.w / 2);
  const cy = room.y + Math.floor(room.h / 2);
  const x = plan.prize.x + Math.sign(cx - plan.prize.x);
  const y = plan.prize.y + Math.sign(cy - plan.prize.y);
  return { x, y, species: 'big_demon' };
}

/**
 * The danger budget: monsters per floor stays roughly constant while floors
 * shrink — the dungeon closes in, the danger doesn't.
 */
export const DANGER_BUDGET = 9;
/** Keep at least this many walkable tiles per monster so tiny floors stay playable. */
const MIN_TILES_PER_MONSTER = 8;
/** Spawns keep this BFS distance (tiles) from the entry, halved-down on floors too small for it. */
const SPAWN_EXCLUSION = 10;

export interface MonsterSpawn {
  x: number;
  y: number;
  species: MonsterSpeciesId;
}

/**
 * Pick monster spawn tiles for a floor: room floor tiles at a safe path
 * distance from the entry, count = DANGER_BUDGET ± 1 (density-capped). The
 * nadir gets none — its confrontation is the boss, not scatter spawns.
 * Seeded independently of generation so layouts never shift.
 */
export function placeMonsters(plan: Floorplan, seed: string): MonsterSpawn[] {
  if (plan.isNadir) return [];
  const rng = new Rng(`${seed}:monsters:${plan.depth}`);
  const s = plan.size;

  // path distance from the entry — spawn safety is BFS, not crow-flies
  const dist = new Int32Array(s * s).fill(-1);
  const queue: number[] = [plan.spawn.y * s + plan.spawn.x];
  dist[queue[0]] = 0;
  let farthest = 0;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    farthest = Math.max(farthest, dist[idx]);
    const x = idx % s;
    const y = Math.floor(idx / s);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= s || ny >= s) continue;
      const nIdx = ny * s + nx;
      if (dist[nIdx] === -1 && isWalkable(plan.tiles[nIdx])) {
        dist[nIdx] = dist[idx] + 1;
        queue.push(nIdx);
      }
    }
  }
  const minDist = Math.min(SPAWN_EXCLUSION, Math.ceil(farthest / 2));

  // candidates: room floor tiles far enough out (plain Floor keeps the stairs clear)
  const candidates: number[] = [];
  for (const r of plan.rooms) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const idx = y * s + x;
        if (plan.tiles[idx] === Tile.Floor && dist[idx] >= minDist) candidates.push(idx);
      }
    }
  }

  let walkableCount = 0;
  for (const t of plan.tiles) if (isWalkable(t)) walkableCount++;
  const budget = Math.min(
    rng.int(DANGER_BUDGET - 1, DANGER_BUDGET + 1),
    Math.floor(walkableCount / MIN_TILES_PER_MONSTER),
    candidates.length,
  );

  const bench = speciesForDepth(plan.depth);
  const spawns: MonsterSpawn[] = [];
  // partial Fisher-Yates: draw `budget` distinct tiles
  for (let i = 0; i < budget; i++) {
    const j = rng.int(i, candidates.length - 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    const idx = candidates[i];
    spawns.push({ x: idx % s, y: Math.floor(idx / s), species: rng.pick(bench) });
  }
  return spawns;
}
