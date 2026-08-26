import type Phaser from 'phaser';
import { ANIM } from '../game/anims';
import type { MoveIntent } from '../game/input';
import { PLAYER_SPEED } from '../game/physics';
import { ATLAS_KEY } from '../game/tiles';
import { Actor } from './Actor';

const SPEED = PLAYER_SPEED;

export class Player extends Actor {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ATLAS_KEY, 'knight_m_idle_anim_f0', {
      // Flat feet box. Height = how far the feet stop short of a north wall's
      // base (the box top collides), so short = you tuck right up against walls
      // above you. Bottom sits 6px above the sprite's bottom so the legs
      // overhang and get occluded by south walls (the "in a corridor" feel).
      bodySize: [10, 4],
      bodyOffset: [3, 18],
      shadow: { width: 10, height: 4 },
    });
    this.play(ANIM.knightIdle);
  }

  /** Apply a movement intent for this frame (normalized diagonals, anim, facing). */
  move({ vx, vy }: MoveIntent) {
    const len = Math.hypot(vx, vy) || 1;
    this.setVelocity((vx / len) * SPEED, (vy / len) * SPEED);
    if (vx !== 0) this.setFlipX(vx < 0);
    this.play(vx !== 0 || vy !== 0 ? ANIM.knightRun : ANIM.knightIdle, true);
  }

  halt() {
    this.setVelocity(0, 0);
    this.play(ANIM.knightIdle, true);
  }
}
