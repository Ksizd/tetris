import { CUBE_LOCAL_MAX, CUBE_LOCAL_MIN } from './cubeSpace';

/**
 * Thickness of the outer shell (cladding) portion of the cube in local units (cube spans 1.0).
 * Shell shards must occupy z in [0.5 - SHELL_DEPTH, 0.5] for the outward-facing side.
 */
export const SHELL_DEPTH = 0.2;

export const SHELL_Z_RANGE: [number, number] = [CUBE_LOCAL_MAX - SHELL_DEPTH, CUBE_LOCAL_MAX];

// Core occupies the inner cube [-CORE_HALF, CORE_HALF]^3.
export const CORE_HALF = CUBE_LOCAL_MAX - SHELL_DEPTH;
export const CORE_BOUNDS: [number, number] = [-CORE_HALF, CORE_HALF];
export const CORE_Z_RANGE: [number, number] = [CORE_BOUNDS[0], CORE_BOUNDS[1]];

export function isWithinShellZ(z: number, epsilon = 1e-6): boolean {
  return z >= SHELL_Z_RANGE[0] - epsilon && z <= SHELL_Z_RANGE[1] + epsilon;
}

export function isWithinCoreZ(z: number, epsilon = 1e-6): boolean {
  return z >= CORE_Z_RANGE[0] - epsilon && z <= CORE_Z_RANGE[1] + epsilon;
}

export function shellAndCoreFractions(): { shell: number; core: number; total: number } {
  const shell = SHELL_Z_RANGE[1] - SHELL_Z_RANGE[0];
  const core = CORE_Z_RANGE[1] - CORE_Z_RANGE[0];
  return { shell, core, total: core + shell * 2 };
}

export function assertShellDepthInvariant(): void {
  if (SHELL_DEPTH <= 0 || SHELL_DEPTH > CUBE_LOCAL_MAX - CUBE_LOCAL_MIN) {
    throw new Error('SHELL_DEPTH must be within (0, cubeSize]');
  }
  const shellSpan = SHELL_Z_RANGE[1] - SHELL_Z_RANGE[0];
  const coreSpan = CORE_Z_RANGE[1] - CORE_Z_RANGE[0];
  if (SHELL_Z_RANGE[0] < CUBE_LOCAL_MIN - 1e-6 || SHELL_Z_RANGE[1] > CUBE_LOCAL_MAX + 1e-6) {
    throw new Error('SHELL_Z_RANGE must stay inside cube bounds');
  }
  if (Math.abs(CORE_Z_RANGE[0] + CORE_Z_RANGE[1]) > 1e-6) {
    throw new Error('CORE_Z_RANGE must be symmetric around 0');
  }
  if (Math.abs(CORE_HALF - (CUBE_LOCAL_MAX - SHELL_DEPTH)) > 1e-6) {
    throw new Error('CORE_HALF must be cubeHalf - shellDepth');
  }
  if (shellSpan <= 0 || coreSpan <= 0) {
    throw new Error('Shell and core thickness must be positive');
  }
  const { total } = shellAndCoreFractions();
  if (Math.abs(total - (CUBE_LOCAL_MAX - CUBE_LOCAL_MIN)) > 1e-6) {
    throw new Error('Shell + core (both sides) must equal cube size');
  }
}
