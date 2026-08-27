import type Phaser from 'phaser';
import { monsterAnim, type MonsterSpeciesDef } from '../game/monsters';
import { ATLAS_KEY } from '../game/tiles';
import { Actor } from './Actor';
import type { Player } from './Player';

/** How long a monster keeps heading for the player's last seen position. */
const CHASE_MEMORY_MS = 800;

export class Monster extends Actor {
  readonly def: MonsterSpeciesDef;
  private lastSeen: { x: number; y: number; at: number } | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterSpeciesDef) {
    super(scene, x, y, ATLAS_KEY, `${def.idlePrefix}0`, {
      bodySize: def.bodySize,
      bodyOffset: def.bodyOffset,
      shadow: def.shadow,
    });
    this.def = def;
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

  halt() {
    this.setVelocity(0, 0);
    this.play(monsterAnim(this.def.id, 'idle'), true);
  }
}
