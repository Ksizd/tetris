import { describe, expect, it } from 'vitest';
import { Vector2, Vector3 } from 'three';
import { buildCanonicalShardBuffer, buildCanonicalShardLibrary } from '../canonicalShardBuffers';
import { CanonicalShard } from '../canonicalShards';

function makeSampleShard(): CanonicalShard {
  const positions = new Float32Array([
    -0.1, -0.1, 0.0, // 0
    0.1, -0.1, 0.0, // 1
    0.1, 0.1, 0.0, // 2
    -0.1, 0.1, 0.0, // 3
  ]);
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  return {
    id: 7,
    positions,
    normals,
    uvs,
    indices,
    materialKind: 'faceAndGold',
    approximateVolume: 0.02,
  };
}

describe('canonicalShardBuffers', () => {
  it('converts canonical shard to BufferGeometry with attributes', () => {
    const shard = makeSampleShard();
    const res = buildCanonicalShardBuffer(shard);
    expect(res.shardId).toBe(shard.id);
    expect(res.geometry.getAttribute('position').count).toBe(4);
    expect(res.geometry.getIndex()?.count).toBe(6);
    expect(res.materialId).toBe('face');
    expect(res.approximateVolume).toBeCloseTo(0.02);
  });

  it('builds library keyed by shard id', () => {
    const shardA = makeSampleShard();
    const shardB: CanonicalShard = {
      ...makeSampleShard(),
      id: 8,
      materialKind: 'goldInnerOnly',
      approximateVolume: 0.05,
    };
    const lib = buildCanonicalShardLibrary([shardA, shardB]);
    expect(lib.size).toBe(2);
    const b = lib.get(8);
    expect(b?.materialId).toBe('gold');
    expect(b?.geometry.getAttribute('uv').count).toBe(4);
  });
});
