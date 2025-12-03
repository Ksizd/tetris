import { describe, expect, it } from 'vitest';
import { CanonicalShard } from '../canonicalShards';
import {
  buildCanonicalShardReport,
  validateCanonicalShardVolume,
  assertCanonicalShardVolume,
} from '../canonicalShardReport';

function makeShard(id: number, volume: number, kind: CanonicalShard['materialKind']): CanonicalShard {
  return {
    id,
    positions: new Float32Array([0, 0, 0]),
    normals: new Float32Array([0, 0, 1]),
    uvs: new Float32Array([0, 0]),
    indices: new Uint16Array([0]),
    materialKind: kind,
    approximateVolume: volume,
  };
}

describe('canonicalShardReport', () => {
  it('builds aggregate stats by material and volumes', () => {
    const shards: CanonicalShard[] = [
      makeShard(1, 0.1, 'faceAndGold'),
      makeShard(2, 0.2, 'faceAndGold'),
      makeShard(3, 0.4, 'goldInnerOnly'),
    ];
    const report = buildCanonicalShardReport(shards);

    expect(report.totalShards).toBe(3);
    expect(report.totalVolume).toBeCloseTo(0.7);
    expect(report.minVolume).toBeCloseTo(0.1);
    expect(report.maxVolume).toBeCloseTo(0.4);
    expect(report.averageVolume).toBeCloseTo(0.7 / 3);

    expect(report.byMaterial.faceAndGold.count).toBe(2);
    expect(report.byMaterial.faceAndGold.volume).toBeCloseTo(0.3);
    expect(report.byMaterial.goldInnerOnly.count).toBe(1);
    expect(report.byMaterial.goldInnerOnly.volume).toBeCloseTo(0.4);
  });

  it('handles empty list safely', () => {
    const report = buildCanonicalShardReport([]);
    expect(report.totalShards).toBe(0);
    expect(report.totalVolume).toBe(0);
    expect(report.minVolume).toBe(0);
    expect(report.maxVolume).toBe(0);
    expect(report.averageVolume).toBe(0);
  });

  it('validates total volume against target with tolerance', () => {
    const shards: CanonicalShard[] = [makeShard(1, 0.52, 'faceAndGold'), makeShard(2, 0.45, 'goldInnerOnly')];
    const resOk = validateCanonicalShardVolume(shards, 1, 0.2);
    expect(resOk.ok).toBe(true);
    expect(resOk.totalVolume).toBeCloseTo(0.97);

    const resFail = validateCanonicalShardVolume(shards, 1, 0.01);
    expect(resFail.ok).toBe(false);
    expect(resFail.reason).toBeDefined();
  });

  it('assertion throws when volume is out of bounds', () => {
    const shards: CanonicalShard[] = [makeShard(1, 0.2, 'faceAndGold')];
    expect(() => assertCanonicalShardVolume(shards, 1, 0.01)).toThrow();
    expect(() => assertCanonicalShardVolume(shards, 1, 0.9)).not.toThrow();
  });
});
