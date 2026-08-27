import { describe, expect, it } from 'vitest';
import { KNOCKBACK_SPEED, MAX_HP, heartsFor } from './combat';
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
