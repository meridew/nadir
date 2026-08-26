import Phaser from 'phaser';
import { PHYSICS_MIN_FPS } from './game/physics';
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
    // fixedStep:false — step per render frame (variable delta) so movement is
    // smooth on high-refresh displays instead of updating at a fixed 60Hz.
    arcade: { gravity: { x: 0, y: 0 }, fixedStep: false, debug: false },
  },
  // Clamp frame deltas: with variable-step physics, an unclamped hitch (the
  // default floor is 5fps = 200ms!) moves bodies through walls in one step.
  // See game/physics.ts for the tunneling invariant.
  fps: { min: PHYSICS_MIN_FPS, smoothStep: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, DungeonScene, UIScene],
});

// Dev handle: lets tooling drive the loop manually (game.step) when rAF is throttled.
(window as unknown as Record<string, unknown>).game = game;
