/** Typed animation registry. M2 monsters add rows here; scenes never use raw strings. */
import type Phaser from 'phaser';
import { ATLAS_KEY } from './tiles';

export const ANIM = {
  knightIdle: 'knight_m_idle',
  knightRun: 'knight_m_run',
  chestOpen: 'chest_open',
} as const;
export type AnimKey = (typeof ANIM)[keyof typeof ANIM];

interface AnimDef {
  key: AnimKey;
  /** atlas frame prefix; frames are `${prefix}${0..frames-1}` */
  prefix: string;
  frames: number;
  rate: number;
  repeat: number; // -1 loops
}

const ANIM_DEFS: AnimDef[] = [
  { key: ANIM.knightIdle, prefix: 'knight_m_idle_anim_f', frames: 4, rate: 8, repeat: -1 },
  { key: ANIM.knightRun, prefix: 'knight_m_run_anim_f', frames: 4, rate: 12, repeat: -1 },
  { key: ANIM.chestOpen, prefix: 'chest_full_open_anim_f', frames: 3, rate: 8, repeat: 0 },
];

export function registerAnims(scene: Phaser.Scene) {
  for (const def of ANIM_DEFS) {
    scene.anims.create({
      key: def.key,
      frames: scene.anims.generateFrameNames(ATLAS_KEY, {
        prefix: def.prefix,
        start: 0,
        end: def.frames - 1,
      }),
      frameRate: def.rate,
      repeat: def.repeat,
    });
  }
}
