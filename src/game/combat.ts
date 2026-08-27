/** Pure combat math — hearts, i-frames, knockback. No Phaser. */

/** Player health in half-heart units (3 hearts). */
export const MAX_HP = 6;
/** Contact with a monster costs half a heart. */
export const CONTACT_DAMAGE = 1;
/** Invulnerability window after taking a hit. */
export const IFRAMES_MS = 800;
/**
 * Knockback impulse. Speed rides the normal collider pipeline, so it must
 * respect the anti-tunneling bound (game/physics.ts) — pinned by test.
 */
export const KNOCKBACK_SPEED = 180;
export const KNOCKBACK_MS = 120;

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
