import { describe, expect, it } from 'vitest';
import { generateLifetimeMs } from '../fragmentLifetime';

describe('fragmentLifetime', () => {
  it('generates lifetime within default range using random', () => {
    const lifetime = generateLifetimeMs({ randomFn: () => 0.5 });
    expect(lifetime).toBeCloseTo(1500);
    expect(lifetime).toBeGreaterThanOrEqual(1000);
    expect(lifetime).toBeLessThanOrEqual(2000);
  });

  it('supports custom range', () => {
    const lifetime = generateLifetimeMs({ minMs: 500, maxMs: 1500, randomFn: () => 0.2 });
    expect(lifetime).toBeCloseTo(700);
  });

  it('throws on invalid range', () => {
    expect(() => generateLifetimeMs({ minMs: -1, maxMs: 1000 })).toThrow();
    expect(() => generateLifetimeMs({ minMs: 1000, maxMs: 500 })).toThrow();
  });
});
