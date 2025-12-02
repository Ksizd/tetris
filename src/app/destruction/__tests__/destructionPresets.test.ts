import { describe, expect, it } from 'vitest';
import { LOW_DESTRUCTION_PRESET, ULTRA_DESTRUCTION_PRESET } from '../destructionPresets';

describe('destruction presets', () => {
  it('ultra preset meets plan ranges', () => {
    expect(ULTRA_DESTRUCTION_PRESET.fragmentCount.min).toBeGreaterThanOrEqual(16);
    expect(ULTRA_DESTRUCTION_PRESET.fragmentCount.max).toBeGreaterThanOrEqual(32);
    expect(ULTRA_DESTRUCTION_PRESET.lifetimeMs.min).toBeGreaterThanOrEqual(1200);
    expect(ULTRA_DESTRUCTION_PRESET.lifetimeMs.max).toBeGreaterThanOrEqual(2000);
    expect(ULTRA_DESTRUCTION_PRESET.radialSpeed.max).toBeGreaterThan(6);
    expect(ULTRA_DESTRUCTION_PRESET.fullPhysics).toBe(true);
  });

  it('low preset uses reduced counts and simplified physics', () => {
    expect(LOW_DESTRUCTION_PRESET.fragmentCount.max).toBeLessThanOrEqual(8);
    expect(LOW_DESTRUCTION_PRESET.fragmentCount.min).toBeGreaterThanOrEqual(4);
    expect(LOW_DESTRUCTION_PRESET.lifetimeMs.max).toBeLessThanOrEqual(1200);
    expect(LOW_DESTRUCTION_PRESET.fullPhysics).toBe(false);
  });
});
