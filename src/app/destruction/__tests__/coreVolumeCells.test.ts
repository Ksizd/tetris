import { describe, expect, it } from 'vitest';
import { buildCoreJitterGrid } from '../coreJitterGrid';
import { buildCoreVolumeCells, validateVolumeCells } from '../coreVolumeCells';
import { CORE_BOUNDS, CORE_Z_RANGE } from '../shellLayers';

function fixedRandom(seq: number[]): () => number {
  let idx = 0;
  return () => {
    const v = seq[idx % seq.length];
    idx += 1;
    return v;
  };
}

describe('coreVolumeCells', () => {
  it('builds hexahedral cells between neighboring grid nodes', () => {
    const grid = buildCoreJitterGrid({ divisions: 3, random: fixedRandom([0.2, 0.4, 0.6]) });
    const cells = buildCoreVolumeCells(grid);
    expect(cells.length).toBe(Math.pow(grid.divisions, 3));
    const first = cells[0];
    expect(first.corners.length).toBe(8);
    expect(first.center.z).toBeGreaterThanOrEqual(CORE_Z_RANGE[0] - 0.1);
    expect(first.center.z).toBeLessThanOrEqual(CORE_Z_RANGE[1] + 0.1);
    expect(first.center.x).toBeGreaterThanOrEqual(CORE_BOUNDS[0] - 0.1);
    expect(first.center.x).toBeLessThanOrEqual(CORE_BOUNDS[1] + 0.1);
  });

  it('validates bounds of all cell corners', () => {
    const grid = buildCoreJitterGrid({ divisions: 4, random: fixedRandom([0.5]) });
    const cells = buildCoreVolumeCells(grid);
    const res = validateVolumeCells(cells);
    expect(res.ok).toBe(true);
    expect(res.outOfBounds).toBe(0);
    cells.forEach((cell) =>
      cell.corners.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(CORE_BOUNDS[0] - 1e-2);
        expect(p.x).toBeLessThanOrEqual(CORE_BOUNDS[1] + 1e-2);
      })
    );
  });
});
