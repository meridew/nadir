/**
 * Timestep bounds. Physics runs variable-step (fixedStep: false, for smooth
 * motion at any refresh rate — see main.ts), which makes frame hitches
 * dangerous: one big delta can move a body clean through a collider
 * (tunneling). The game loop therefore clamps deltas to at most
 * 1000 / PHYSICS_MIN_FPS ms, and the standing invariant is:
 *
 *   maxActorSpeed * (1 / PHYSICS_MIN_FPS) < MIN_SOLID collider core (8px)
 *
 * pinned by collision.test.ts. Anything faster than that bound (M2+
 * projectiles?) needs swept collision instead of a speed bump.
 */
export const PHYSICS_MIN_FPS = 30;

/** Player walk speed in px/s (bound by the invariant above). */
export const PLAYER_SPEED = 95;
