import Phaser from 'phaser';
import { randomSeedString } from '../core/rng';
import { registerAnims } from '../game/anims';
import {
  ATLAS_KEY,
  ATLAS_URL,
  SHEET_URL,
  TILES_KEY,
  TILE_SIZE,
  WALLS_KEY,
  WALLS_URL,
} from '../game/tiles';
import { WALL_TILE_H, WALL_TILE_W } from '../game/dtii-blob';

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
    this.load.spritesheet(WALLS_KEY, WALLS_URL, {
      frameWidth: WALL_TILE_W,
      frameHeight: WALL_TILE_H,
    });
  }

  create() {
    registerAnims(this);
    const url = new URL(window.location.href);
    const seed = url.searchParams.get('seed') ?? randomSeedString();
    this.scene.launch('ui');
    this.scene.start('dungeon', { seed, depth: 1 });
  }
}
