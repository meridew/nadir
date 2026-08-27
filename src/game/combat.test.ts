import { describe, expect, it } from 'vitest';
import { KNOCKBACK_SPEED, MAX_HP, circleIntersectsRect, heartsFor } from './combat';
import { MIN_SOLID } from './draws';
import { PHYSICS_MIN_FPS } from './physics';

describe('heartsFor', () => {
  it('maps half-heart hp to heart icons', () => {
    expect(heartsFor(6)).toEqual(['full', 'full', 'full']);
    expect(heartsFor(5)).toEqual(['full', 'full', 'half']);
    expect(heartsFor(4)).toEqual(['full', 'full', 'empty']);
    expect(heartsFor(3)).toEqual(['full', 'half', 'empty']);
    expect(heartsFor(1)).toEqual(['half', 'empty', 'empty']);
    expect(heartsFor(0)).toEqual(['empty', 'empty', 'empty']);
  });

  it('clamps out-of-range hp', () => {
    expect(heartsFor(-2)).toEqual(['empty', 'empty', 'empty']);
    expect(heartsFor(99)).toEqual(['full', 'full', 'full']);
  });

  it('covers MAX_HP exactly', () => {
    expect(heartsFor(MAX_HP)).toHaveLength(MAX_HP / 2);
  });
});

describe('knockback', () => {
  it('respects the anti-tunneling bound', () => {
    expect(KNOCKBACK_SPEED / PHYSICS_MIN_FPS).toBeLessThan(MIN_SOLID);
  });
});

describe('circleIntersectsRect', () => {
  it('detects overlap, containment, and edge contact', () => {
    expect(circleIntersectsRect(0, 0, 5, 3, -2, 10, 4)).toBe(true); // overlaps left edge
    expect(circleIntersectsRect(5, 5, 20, 0, 0, 10, 10)).toBe(true); // circle swallows rect
    expect(circleIntersectsRect(5, 5, 2, 4, 4, 2, 2)).toBe(true); // center inside rect
    expect(circleIntersectsRect(0, 0, 5, 5, 0, 4, 4)).toBe(true); // exact edge touch
  });

  it('rejects clear misses, including diagonal corners', () => {
    expect(circleIntersectsRect(0, 0, 5, 6, 0, 4, 4)).toBe(false);
    expect(circleIntersectsRect(0, 0, 5, 4, 4, 10, 10)).toBe(false); // corner at (4,4): dist √32 > 5
  });
});
