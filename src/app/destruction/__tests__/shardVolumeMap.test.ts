import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import {
  estimateShardCoverage,
  validateShardCoverage,
  computeShardLocalCenter,
  isShardSurfaceBiased,
} from '../shardVolumeMap';
import { ShardTemplate } from '../shardTemplate';

const FULL_FACE_POLY = [
  new Vector2(-0.5, -0.5),
  new Vector2(0.5, -0.5),
  new Vector2(0.5, 0.5),
  new Vector2(-0.5, 0.5),
];

function makeTemplates(): ShardTemplate[] {
  return [
    {
      id: 1,
      face: 'front',
      polygon2D: { face: 'front', vertices: FULL_FACE_POLY },
      depthMin: 0,
      depthMax: 0.4,
    },
    {
      id: 2,
      face: 'back',
      polygon2D: { face: 'back', vertices: FULL_FACE_POLY },
      depthMin: 0,
      depthMax: 0.4,
    },
  ];
}

describe('shardVolumeMap', () => {
  it('estimates coverage with grid sampling', () => {
    const coverage = estimateShardCoverage(makeTemplates(), 4);
    expect(coverage.coveredFraction).toBeGreaterThan(0.4);
    const closest = coverage.samples.reduce((best, sample) => {
      const dist = sample.position.lengthSq();
      if (!best || dist < best.dist) {
        return { dist, sample };
      }
      return best;
    }, null as { dist: number; sample: (typeof coverage.samples)[number] } | null);
    expect(closest).not.toBeNull();
    expect(closest?.sample.hitTemplateIds.length).toBeGreaterThan(0);
  });

  it('validates coverage against threshold', () => {
    const result = validateShardCoverage(makeTemplates(), { resolution: 6, minCoveredFraction: 0.5 });
    expect(result.requiredFraction).toBe(0.5);
    expect(result.coveredFraction).toBeGreaterThan(0);
    expect(result.ok).toBe(true);
  });

  it('computes local center and surface bias heuristic', () => {
    const shallow: ShardTemplate = {
      id: 3,
      face: 'front',
      polygon2D: { face: 'front', vertices: FULL_FACE_POLY },
      depthMin: 0,
      depthMax: 0.1,
    };
    const deep: ShardTemplate = {
      id: 4,
      face: 'front',
      polygon2D: { face: 'front', vertices: FULL_FACE_POLY },
      depthMin: 0.4,
      depthMax: 0.5,
    };
    const c1 = computeShardLocalCenter(shallow);
    const c2 = computeShardLocalCenter(deep);
    expect(c1.z).toBeCloseTo(0.45); // near surface
    expect(c2.z).toBeCloseTo(0.05); // deeper inside
    expect(isShardSurfaceBiased(shallow)).toBe(true);
    expect(isShardSurfaceBiased(deep)).toBe(false);
  });
});
