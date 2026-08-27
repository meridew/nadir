import type Phaser from 'phaser';
import { ANIM } from '../game/anims';
import { IFRAMES_MS, KNOCKBACK_MS, KNOCKBACK_SPEED } from '../game/combat';
import type { MoveIntent } from '../game/input';
import { PLAYER_SPEED } from '../game/physics';
import { ATLAS_KEY } from '../game/tiles';
import { Actor } from './Actor';

const SPEED = PLAYER_SPEED;
const HIT_FLASH_MS = 90;

export class Player extends Actor {
  private iframesUntil = 0;
  private knockedUntil = 0;
  private dying = false;

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
    // Monsters must not bulldoze the knight across the floor when they catch
    // up — contact consequences are damage + knockback impulses, never solver
    // pushes.
    (this.body as Phaser.Physics.Arcade.Body).pushable = false;
    this.play(ANIM.knightIdle);
  }

  /** Apply a movement intent for this frame (normalized diagonals, anim, facing). */
  move({ vx, vy }: MoveIntent) {
    if (this.scene.time.now < this.knockedUntil) return; // ride the knockback out
    const len = Math.hypot(vx, vy) || 1;
    this.setVelocity((vx / len) * SPEED, (vy / len) * SPEED);
    if (vx !== 0) this.setFlipX(vx < 0);
    this.play(vx !== 0 || vy !== 0 ? ANIM.knightRun : ANIM.knightIdle, true);
  }

  halt() {
    this.setVelocity(0, 0);
    this.play(ANIM.knightIdle, true);
  }

  /**
   * Take a contact hit from a source at (sx, sy): knockback impulse away from
   * it, hit flash, i-frame flicker. Returns false while invulnerable — the
   * scene only spends hp when this lands.
   */
  hurt(sx: number, sy: number): boolean {
    const now = this.scene.time.now;
    if (this.dying || now < this.iframesUntil) return false;
    this.iframesUntil = now + IFRAMES_MS;
    this.knockedUntil = now + KNOCKBACK_MS;
    const dx = this.x - sx;
    const dy = this.feetY - sy;
    const d = Math.hypot(dx, dy) || 1;
    this.setVelocity((dx / d) * KNOCKBACK_SPEED, (dy / d) * KNOCKBACK_SPEED);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (!this.dying) this.clearTint();
    });
    this.scene.tweens.add({
      targets: this,
      alpha: 0.35,
      duration: HIT_FLASH_MS,
      yoyo: true,
      repeat: Math.floor(IFRAMES_MS / (HIT_FLASH_MS * 2)) - 1,
      onComplete: () => this.setAlpha(1),
    });
    return true;
  }

  /** Death pose: freeze on the hit frame, drained of color. */
  die() {
    this.dying = true;
    this.scene.tweens.killTweensOf(this);
    this.setAlpha(1);
    this.setVelocity(0, 0);
    this.anims.stop();
    this.setFrame('knight_m_hit_anim_f0');
    this.setTint(0x777777);
  }
}
