import type Phaser from 'phaser';
import { ANIM } from '../game/anims';
import {
  ATTACK_COOLDOWN_MS,
  IFRAMES_MS,
  KNOCKBACK_MS,
  KNOCKBACK_SPEED,
  SWING_HALF_ARC,
  SWING_MS,
  SWING_RADIUS,
  SWING_REACH,
} from '../game/combat';
import type { MoveIntent } from '../game/input';
import { PLAYER_SPEED } from '../game/physics';
import { ATLAS_KEY } from '../game/tiles';
import { Actor } from './Actor';

const SPEED = PLAYER_SPEED;
const HIT_FLASH_MS = 90;
/** how far from the player's center the blade's grip orbits during a swing */
const SWING_GRIP_RADIUS = 10;

export interface SwingRegion {
  x: number;
  y: number;
  r: number;
  /** monsters already hit by this swing (dedup; the scene fills it) */
  hit: Set<unknown>;
}

export class Player extends Actor {
  private weapon: Phaser.GameObjects.Sprite;
  private facing = { x: 1, y: 0 };
  private cooldownUntil = 0;
  private swing: (SwingRegion & { fx: number; fy: number; until: number }) | null = null;
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
    this.weapon = scene.add.sprite(x, y, ATLAS_KEY, 'weapon_regular_sword').setOrigin(0.5, 0.85);
    this.play(ANIM.knightIdle);
  }

  /** Apply a movement intent for this frame (normalized diagonals, anim, facing). */
  move({ vx, vy }: MoveIntent) {
    if (this.scene.time.now < this.knockedUntil) return; // ride the knockback out
    const len = Math.hypot(vx, vy) || 1;
    if (vx !== 0 || vy !== 0) this.facing = { x: vx / len, y: vy / len };
    this.setVelocity((vx / len) * SPEED, (vy / len) * SPEED);
    if (vx !== 0) this.setFlipX(vx < 0);
    this.play(vx !== 0 || vy !== 0 ? ANIM.knightRun : ANIM.knightIdle, true);
  }

  /** Swing the blade through an arc centered on the facing (cooldown-gated). */
  attack() {
    const now = this.scene.time.now;
    if (this.dying || now < this.cooldownUntil) return;
    this.cooldownUntil = now + ATTACK_COOLDOWN_MS;
    const { x: fx, y: fy } = this.facing;
    const swing = { x: 0, y: 0, r: SWING_RADIUS, hit: new Set<unknown>(), fx, fy, until: now + SWING_MS };
    this.swing = swing;
    const theta0 = Math.atan2(fy, fx);
    const arm = { t: -1 };
    this.scene.tweens.add({
      targets: arm,
      t: 1,
      duration: SWING_MS,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        const th = theta0 + arm.t * SWING_HALF_ARC;
        this.weapon
          .setPosition(this.x + Math.cos(th) * SWING_GRIP_RADIUS, this.y + 3 + Math.sin(th) * SWING_GRIP_RADIUS)
          .setRotation(th + Math.PI / 2)
          .setFlipX(false);
      },
      onComplete: () => {
        if (this.swing === swing) this.swing = null;
      },
    });
  }

  /** The live swing's hit circle (tracks the player mid-swing), or null. */
  get activeSwing(): SwingRegion | null {
    if (!this.swing || this.scene.time.now > this.swing.until) return null;
    return {
      x: this.x + this.swing.fx * SWING_REACH,
      y: this.y + 3 + this.swing.fy * SWING_REACH,
      r: this.swing.r,
      hit: this.swing.hit,
    };
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    // the blade shares the knight's occlusion fate, one step in front
    this.weapon.setDepth(this.depth + 1);
    if (!this.swing) {
      this.weapon
        .setPosition(this.x + (this.flipX ? -6 : 6), this.y + 4)
        .setRotation(this.flipX ? -0.45 : 0.45)
        .setFlipX(this.flipX);
    }
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

  /** Death pose: freeze on the hit frame, drained of color; the blade drops. */
  die() {
    this.dying = true;
    this.swing = null;
    this.scene.tweens.killTweensOf(this);
    this.setAlpha(1);
    this.setVelocity(0, 0);
    this.anims.stop();
    this.setFrame('knight_m_hit_anim_f0');
    this.setTint(0x777777);
    this.weapon.setVisible(false);
  }

  destroy(fromScene?: boolean) {
    this.weapon.destroy();
    super.destroy(fromScene);
  }
}
