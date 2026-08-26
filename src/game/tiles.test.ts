import { describe, expect, it } from 'vitest';
import { isGridTile, tileIndex } from './tiles';

describe('tileIndex / isGridTile', () => {
  it('maps grid-aligned frames to spritesheet indices', () => {
    expect(tileIndex('floor_1')).toBe((64 / 16) * 32 + 1); // frame at (16,64)
    expect(tileIndex('wall_mid')).toBe((16 / 16) * 32 + 2); // frame at (32,16)
  });

  it('rejects off-grid frames (the wall_edge family sits at y%16==8)', () => {
    expect(isGridTile('floor_1')).toBe(true);
    expect(isGridTile('wall_edge_top_left')).toBe(false);
    expect(() => tileIndex('wall_edge_top_left')).toThrow();
  });
});
