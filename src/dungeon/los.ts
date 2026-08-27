/** Pure line-of-sight on the tile grid — no Phaser, fully unit-testable. */

/**
 * Supercover grid raycast (Amanatides & Woo DDA): true iff EVERY tile the
 * segment from (x0,y0) to (x1,y1) passes through is walkable. Coordinates are
 * in tile units and may be fractional (world px / TILE_SIZE).
 *
 * Exact lattice-corner crossings count as blocked unless BOTH cells flanking
 * the corner are open — sight never squeezes through a diagonal wall pinch
 * (mirroring the collision plugs in game/draws.ts).
 */
export function lineOfSight(
  walkableAt: (tx: number, ty: number) => boolean,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  let tx = Math.floor(x0);
  let ty = Math.floor(y0);
  const txEnd = Math.floor(x1);
  const tyEnd = Math.floor(y1);
  if (!walkableAt(tx, ty)) return false;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  let tMaxX = dx === 0 ? Infinity : (dx > 0 ? tx + 1 - x0 : x0 - tx) * tDeltaX;
  let tMaxY = dy === 0 ? Infinity : (dy > 0 ? ty + 1 - y0 : y0 - ty) * tDeltaY;

  // each iteration advances at least one axis one tile toward the end cell,
  // so this bound is only ever hit by float drift — fail safe (no sight)
  let guard = Math.abs(txEnd - tx) + Math.abs(tyEnd - ty) + 2;
  while (tx !== txEnd || ty !== tyEnd) {
    if (--guard < 0) return false;
    if (tMaxX < tMaxY) {
      tMaxX += tDeltaX;
      tx += stepX;
    } else if (tMaxY < tMaxX) {
      tMaxY += tDeltaY;
      ty += stepY;
    } else {
      if (!walkableAt(tx + stepX, ty) || !walkableAt(tx, ty + stepY)) return false;
      tMaxX += tDeltaX;
      tx += stepX;
      tMaxY += tDeltaY;
      ty += stepY;
    }
    if (!walkableAt(tx, ty)) return false;
  }
  return true;
}
