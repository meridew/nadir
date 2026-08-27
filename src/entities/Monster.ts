import type Phaser from 'phaser';
import { KNOCKBACK_MS, KNOCKBACK_SPEED, SWORD_DAMAGE } from '../game/combat';
import { monsterAnim, type MonsterSpeciesDef } from '../game/monsters';
import { ATLAS_KEY } from '../game/tiles';
import { Actor } from './Actor';
import type { Player } from './Player';

/** How long a monster keeps heading for the player's last seen position. */
const CHASE_MEMORY_MS = 800;
/** knockback ride plus a short stagger before the AI retakes the wheel */
const STAGGER_MS = KNOCKBACK_MS + 80;
const HIT_FLASH_MS = 90;

export class Monster extends Actor {
  readonly def: MonsterSpeciesDef;
  private hp: number;
  private lastSeen: { x: number; y: number; at: number } | null = null;
  private stunnedUntil = 0;
  private dying = false;

  constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterSpeciesDef) {
    super(scene, x, y, ATLAS_KEY, `${def.idlePrefix}0`, {
      bodySize: def.bodySize,
      bodyOffset: def.bodyOffset,
      shadow: def.shadow,
    });
    this.def = def;
    this.hp = def.hp;
    this.play(monsterAnim(def.id, 'idle'));
  }

  get alerted(): boolean {
    return this.lastSeen !== null;
  }

  /**
   * Line-of-sight-gated chase, no pathfinding: sighting the player (within
   * aggro range to start, at any range once alerted) marks their position;
   * the monster steers straight there and forgets after a short memory, so
   * walls end pursuits. Feet aim at feet — sprite heights differ.
   */
  updateAI(player: Player, canSee: (m: Monster) => boolean, now: number) {
    if (this.dying) return;
    if (now < this.stunnedUntil) return; // riding a knockback impulse
    const dist = Math.hypot(player.x - this.x, player.feetY - this.feetY);
    if ((this.alerted || dist < this.def.aggroRadius) && canSee(this)) {
      this.lastSeen = { x: player.x, y: player.feetY, at: now };
    }
    let vx = 0;
    let vy = 0;
    if (this.lastSeen) {
      const dx = this.lastSeen.x - this.x;
      const dy = this.lastSeen.y - this.feetY;
      const d = Math.hypot(dx, dy);
      if (now - this.lastSeen.at > CHASE_MEMORY_MS || d < 2) {
        this.lastSeen = null;
      } else {
        vx = (dx / d) * this.def.speed;
        vy = (dy / d) * this.def.speed;
      }
    }
    this.setVelocity(vx, vy);
    if (vx !== 0) this.setFlipX(vx < 0);
    this.play(monsterAnim(this.def.id, vx !== 0 || vy !== 0 ? 'run' : 'idle'), true);
  }

  /**
   * Take a sword hit from a source at (sx, sy): flash, knockback, stagger —
   * and wake up (getting stabbed reveals the stabber). Returns true when the
   * hit was fatal; the scene then removes it from play and calls perish().
   */
  takeHit(sx: number, sy: number): boolean {
    if (this.dying) return false;
    this.hp -= SWORD_DAMAGE;
    const now = this.scene.time.now;
    this.stunnedUntil = now + STAGGER_MS;
    this.lastSeen = { x: sx, y: sy, at: now };
    const dx = this.x - sx;
    const dy = this.feetY - sy;
    const d = Math.hypot(dx, dy) || 1;
    const kb = KNOCKBACK_SPEED * (this.def.knockbackScale ?? 1);
    this.setVelocity((dx / d) * kb, (dy / d) * kb);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (this.active && !this.dying) this.clearTint();
    });
    return this.hp <= 0;
  }

  /** Death poof: fade and shrink out, then leave the scene entirely. */
  perish() {
    this.dying = true;
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.5,
      duration: 150,
      onComplete: () => this.destroy(),
    });
  }

  halt() {
    if (this.dying) return;
    this.setVelocity(0, 0);
    this.play(monsterAnim(this.def.id, 'idle'), true);
  }
}
