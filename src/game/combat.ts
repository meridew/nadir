/** Pure combat math — hearts, i-frames, knockback. No Phaser. */

/** Player health in half-heart units (3 hearts). Contact damage lives in the species defs. */
export const MAX_HP = 6;
/** Invulnerability window after taking a hit. */
export const IFRAMES_MS = 800;
/**
 * Knockback impulse. Speed rides the normal collider pipeline, so it must
 * respect the anti-tunneling bound (game/physics.ts) — pinned by test.
 */
export const KNOCKBACK_SPEED = 180;
export const KNOCKBACK_MS = 120;

/** Melee swing (Gungeon-style weapon-sprite arc, no attack anims in DTII). */
export const SWING_MS = 140;
export const ATTACK_COOLDOWN_MS = 300;
/** the blade sweeps facing ± this (120° total) */
export const SWING_HALF_ARC = Math.PI / 3;
/** hit-circle center sits this far from the player center along the facing */
export const SWING_REACH = 12;
export const SWING_RADIUS = 14;
/** damage per swing, in hits-to-kill units (monster hp lives in the species defs) */
export const SWORD_DAMAGE = 1;

/** Circle vs axis-aligned rect — the swing hit test. */
export function circleIntersectsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}

export type HeartIcon = 'full' | 'half' | 'empty';

/** HP → heart icons for the HUD (ui_heart_* frames), left to right. */
export function heartsFor(hp: number, maxHp: number = MAX_HP): HeartIcon[] {
  const hearts: HeartIcon[] = [];
  for (let i = 0; i < Math.ceil(maxHp / 2); i++) {
    const units = Math.max(0, Math.min(2, hp - i * 2));
    hearts.push(units === 2 ? 'full' : units === 1 ? 'half' : 'empty');
  }
  return hearts;
}
