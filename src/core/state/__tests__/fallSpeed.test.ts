import { describe, expect, it } from 'vitest';
import { DEFAULT_FALL_SPEED, getFallIntervalMs } from '../fallSpeed';

describe('fall speed parameters', () => {
  it('keeps level 1 at base interval', () => {
    expect(getFallIntervalMs(1, DEFAULT_FALL_SPEED)).toBe(DEFAULT_FALL_SPEED.baseIntervalMs);
  });

  it('decreases interval with higher levels down to minimum', () => {
    const l1 = getFallIntervalMs(1, DEFAULT_FALL_SPEED);
    const l5 = getFallIntervalMs(5, DEFAULT_FALL_SPEED);
    const l20 = getFallIntervalMs(20, DEFAULT_FALL_SPEED);
    expect(l5).toBeLessThan(l1);
    expect(l20).toBeLessThanOrEqual(l5);
    expect(l20).toBeGreaterThanOrEqual(DEFAULT_FALL_SPEED.minIntervalMs);
  });
});
