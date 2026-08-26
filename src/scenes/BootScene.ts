import Phaser from 'phaser';
import { randomSeedString } from '../core/rng';
import { ATLAS_KEY, ATLAS_URL, SHEET_URL, TILES_KEY, TILE_SIZE } from '../game/tiles';

/** [animation key & frame prefix, frame count, frame rate] — all loop. */
const LOOPED_ANIMS: Array<[string, number, number]> = [
  ['knight_m_idle', 4, 8],
  ['knight_m_run', 4, 12],
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.spritesheet(TILES_KEY, SHEET_URL, {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
    this.load.atlas(ATLAS_KEY, SHEET_URL, ATLAS_URL);
  }

  create() {
    for (const [key, count, rate] of LOOPED_ANIMS) {
      this.anims.create({
        key,
        frames: this.anims.generateFrameNames(ATLAS_KEY, {
          prefix: `${key}_anim_f`,
          start: 0,
          end: count - 1,
        }),
        frameRate: rate,
        repeat: -1,
      });
    }
    this.anims.create({
      key: 'chest_open',
      frames: this.anims.generateFrameNames(ATLAS_KEY, {
        prefix: 'chest_full_open_anim_f',
        start: 0,
        end: 2,
      }),
      frameRate: 8,
    });

    const url = new URL(window.location.href);
    const seed = url.searchParams.get('seed') ?? randomSeedString();
    this.scene.launch('ui');
    this.scene.start('dungeon', { seed, depth: 1 });
  }
}
