/** Keyboard → game intent. Scenes ask for intent; they never touch raw keys. */
import Phaser from 'phaser';

export interface MoveIntent {
  vx: number; // -1 | 0 | 1
  vy: number;
}

type Keys = Record<
  'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'R' | 'N',
  Phaser.Input.Keyboard.Key
>;

export class KeyInput {
  private keys: Keys;

  constructor(scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,R,N') as Keys;
  }

  moveIntent(): MoveIntent {
    let vx = 0;
    let vy = 0;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) vx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) vx += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) vy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) vy += 1;
    return { vx, vy };
  }

  /** R — restart the current dungeon (same seed). */
  justRestart(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.R);
  }

  /** N — start a new dungeon (fresh seed). */
  justNewRun(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.N);
  }
}
