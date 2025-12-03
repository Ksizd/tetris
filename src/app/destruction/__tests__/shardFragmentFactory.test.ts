import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { createShardTemplateSet } from '../shardTemplateSet';
import { buildShardGeometryLibrary, makeFragmentFromTemplate } from '../shardFragmentFactory';

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

describe('shardFragmentFactory', () => {
  it('builds geometry library and instantiates fragment with world transform', () => {
    const set = createShardTemplateSet({ random: makeRng(1), coverageResolution: 5, minCoveredFraction: 0.5 });
    const lib = buildShardGeometryLibrary(set, { random: makeRng(2) });
    expect(lib.size).toBeGreaterThan(0);
    const firstId = set.templates[0].id;
    const resource = lib.get(firstId);
    expect(resource).toBeDefined();
    const frag = makeFragmentFromTemplate({
      templateId: firstId,
      cubeWorldPos: new Vector3(1, 2, 3),
      cubeSize: { sx: 2, sy: 2, sz: 2 },
      geometryLib: lib,
    });
    expect(frag.geometry).toBeDefined();
    expect(frag.materialId === 'face' || frag.materialId === 'gold').toBe(true);
    const pos = new Vector3();
    const rot = new THREE.Quaternion();
    const scl = new Vector3();
    frag.matrix.decompose(pos, rot, scl);
    const expectedPos = new Vector3(1, 2, 3).add(resource!.localCenter.clone().multiplyScalar(2));
    expect(pos.x).toBeCloseTo(expectedPos.x, 3);
    expect(pos.y).toBeCloseTo(expectedPos.y, 3);
    expect(pos.z).toBeCloseTo(expectedPos.z, 3);
    expect(scl.x).toBeCloseTo(2);
    expect(frag.velocityScale).toBeGreaterThan(0);
    expect(frag.lifetimeScale).toBeGreaterThan(0);
    expect(frag.volumeEstimate).toBeGreaterThan(0);
  });
});
