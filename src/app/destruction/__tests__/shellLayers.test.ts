import { describe, expect, it } from 'vitest';
import {
  SHELL_DEPTH,
  SHELL_Z_RANGE,
  CORE_HALF,
  CORE_BOUNDS,
  CORE_Z_RANGE,
  isWithinShellZ,
  isWithinCoreZ,
  shellAndCoreFractions,
  assertShellDepthInvariant,
} from '../shellLayers';
import { CUBE_LOCAL_MAX, CUBE_LOCAL_MIN } from '../cubeSpace';

describe('shellLayers', () => {
  it('defines shell thickness and z-range within cube bounds', () => {
    expect(SHELL_DEPTH).toBeCloseTo(0.2);
    expect(SHELL_Z_RANGE[0]).toBeCloseTo(CUBE_LOCAL_MAX - SHELL_DEPTH);
    expect(SHELL_Z_RANGE[1]).toBeCloseTo(CUBE_LOCAL_MAX);
    expect(SHELL_Z_RANGE[0]).toBeGreaterThanOrEqual(CUBE_LOCAL_MIN);
    expect(SHELL_Z_RANGE[1]).toBeLessThanOrEqual(CUBE_LOCAL_MAX);
  });

  it('detects points inside and outside shell band', () => {
    expect(isWithinShellZ(CUBE_LOCAL_MAX)).toBe(true);
    expect(isWithinShellZ(SHELL_Z_RANGE[0] + 0.01)).toBe(true);
    expect(isWithinShellZ(SHELL_Z_RANGE[0] - 0.01)).toBe(false);
  });

  it('defines core range contiguous with shell and covers remaining depth', () => {
    expect(CORE_HALF).toBeCloseTo(CUBE_LOCAL_MAX - SHELL_DEPTH);
    expect(CORE_Z_RANGE[0]).toBeCloseTo(-CORE_HALF);
    expect(CORE_Z_RANGE[1]).toBeCloseTo(CORE_HALF);
    expect(isWithinCoreZ(CORE_Z_RANGE[0])).toBe(true);
    expect(isWithinCoreZ(CORE_Z_RANGE[1] - 1e-4)).toBe(true);
    expect(isWithinCoreZ(SHELL_Z_RANGE[1])).toBe(false);

    const fractions = shellAndCoreFractions();
    expect(fractions.total).toBeCloseTo(CUBE_LOCAL_MAX - CUBE_LOCAL_MIN);
    expect(fractions.shell).toBeCloseTo(SHELL_DEPTH);
    expect(fractions.core).toBeCloseTo(CORE_BOUNDS[1] - CORE_BOUNDS[0]);
    expect(fractions.shell * 2 + fractions.core).toBeCloseTo(1.0);
  });

  it('assertion passes for default constants', () => {
    expect(() => assertShellDepthInvariant()).not.toThrow();
  });
});
