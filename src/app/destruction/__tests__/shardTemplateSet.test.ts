import { describe, expect, it } from 'vitest';
import { createShardTemplateSet, getDefaultShardTemplateSet, resetDefaultShardTemplateSet } from '../shardTemplateSet';
import { ShardGenerationOptions } from '../shardTemplateGenerator';

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

describe('shardTemplateSet', () => {
  it('creates template set with coverage check', () => {
    const options: ShardGenerationOptions = { random: makeRng(42) };
    const set = createShardTemplateSet({ ...options, coverageResolution: 6, minCoveredFraction: 0.5 });
    expect(set.templates.length).toBeGreaterThan(0);
    expect(set.coverage.ok).toBe(true);
    expect(set.coverage.coveredFraction).toBeGreaterThanOrEqual(0.5);
  });

  it('caches default set', () => {
    resetDefaultShardTemplateSet();
    const a = getDefaultShardTemplateSet();
    const b = getDefaultShardTemplateSet();
    expect(a).toBe(b);
    expect(a.templates.length).toBeGreaterThan(0);
  });
});
