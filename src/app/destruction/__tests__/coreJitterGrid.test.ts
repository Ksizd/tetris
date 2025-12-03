import { describe, expect, it } from 'vitest';
import { buildCoreJitterGrid } from '../coreJitterGrid';
import { CORE_BOUNDS, CORE_Z_RANGE, SHELL_DEPTH } from '../shellLayers';

function fixedRandom(seq: number[]): () => number {
  let idx = 0;
  return () => {
    const v = seq[idx % seq.length];
    idx += 1;
    return v;
  };
}

describe('coreJitterGrid', () => {
  it('builds jittered grid nodes within core bounds', () => {
    const grid = buildCoreJitterGrid({ divisions: 4, random: fixedRandom([0.1, 0.3, 0.7]) });
    const expectedCount = Math.pow(4 + 1, 3);
    expect(grid.nodes.length).toBe(expectedCount);
    grid.nodes.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(CORE_BOUNDS[0] - 0.25 * grid.cellSize);
      expect(p.x).toBeLessThanOrEqual(CORE_BOUNDS[1] + 0.25 * grid.cellSize);
      expect(p.y).toBeGreaterThanOrEqual(CORE_BOUNDS[0] - 0.25 * grid.cellSize);
      expect(p.y).toBeLessThanOrEqual(CORE_BOUNDS[1] + 0.25 * grid.cellSize);
      expect(p.z).toBeGreaterThanOrEqual(CORE_Z_RANGE[0] - 0.25 * grid.cellSize);
      expect(p.z).toBeLessThanOrEqual(CORE_Z_RANGE[1] + 0.25 * grid.cellSize);
    });
    expect(grid.cellSize).toBeCloseTo((CORE_BOUNDS[1] - CORE_BOUNDS[0]) / 4);
  });

  it('respects jitter amplitude clamping', () => {
    const grid = buildCoreJitterGrid({ divisions: 3, jitterAmplitude: 0.9, random: fixedRandom([0.5]) });
    // jitterAmplitude is clamped to 0.49 of cell size
    const maxOffset = 0.49 * grid.cellSize + 1e-6;
    const center = (CORE_BOUNDS[0] + CORE_BOUNDS[1]) * 0.5;
    grid.nodes.forEach((p) => {
      expect(Math.abs(p.x - center)).toBeLessThanOrEqual(CORE_BOUNDS[1] + maxOffset);
    });
  });
});
