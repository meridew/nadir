import Phaser from 'phaser';
import { randomSeedString } from '../core/rng';
import { SHEET_KEY, TILE_SIZE } from '../game/tiles';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.spritesheet(SHEET_KEY, 'assets/tilemap_packed.png', {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
  }

  create() {
    const url = new URL(window.location.href);
    const seed = url.searchParams.get('seed') ?? randomSeedString();
    this.scene.launch('ui');
    this.scene.start('dungeon', { seed, depth: 1 });
  }
}
