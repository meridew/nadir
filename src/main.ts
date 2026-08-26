import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { DungeonScene } from './scenes/DungeonScene';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  // CANVAS (not AUTO/WebGL): pixel-art perf is identical and canvas.toDataURL()
  // stays readable for headless snapshot verification.
  type: Phaser.CANVAS,
  parent: 'app',
  width: 960,
  height: 540,
  backgroundColor: '#0b0b12',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, DungeonScene, UIScene],
});

// Dev handle: lets tooling drive the loop manually (game.step) when rAF is throttled.
(window as unknown as Record<string, unknown>).game = game;
