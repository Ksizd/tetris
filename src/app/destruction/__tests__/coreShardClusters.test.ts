import { describe, expect, it } from 'vitest';
import { buildCoreJitterGrid } from '../coreJitterGrid';
import { buildCoreVolumeCells } from '../coreVolumeCells';
import { buildCoreShardClusters, validateClusters } from '../coreShardClusters';

function fixedRandom(seq: number[]): () => number {
  let idx = 0;
  return () => {
    const v = seq[idx % seq.length];
    idx += 1;
    return v;
  };
}

describe('coreShardClusters', () => {
  it('clusters all volume cells with no overlaps', () => {
    const grid = buildCoreJitterGrid({ divisions: 3, random: fixedRandom([0.2, 0.4, 0.6]) });
    const cells = buildCoreVolumeCells(grid);
    const clusters = buildCoreShardClusters(cells, { random: fixedRandom([0.5]), minSize: 2, maxSize: 4 });
    const validation = validateClusters(cells, clusters);
    expect(validation.ok).toBe(true);
    const sizes = clusters.map((c) => c.cells.length);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(2);
  });
});
