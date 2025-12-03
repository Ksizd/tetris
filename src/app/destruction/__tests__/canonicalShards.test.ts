import { Vector2, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildCanonicalCoreShards,
  buildCanonicalShellShards,
  buildCanonicalShards,
  CanonicalShard,
} from '../canonicalShards';
import { CubeFace } from '../cubeSpace';
import { ShellShardGeometry, buildShellShardGeometry } from '../shellShardGeometryBuilder';
import { ShellShardTemplate } from '../shellShardTemplate';
import { CoreShardCluster } from '../coreShardClusters';
import { VolumeCell } from '../coreVolumeCells';

function squarePoly(size: number): Vector2[] {
  const h = size * 0.5;
  return [
    new Vector2(-h, -h),
    new Vector2(h, -h),
    new Vector2(h, h),
    new Vector2(-h, h),
  ];
}

function makeShellGeom(): ShellShardGeometry {
  const template: ShellShardTemplate = {
    id: 0,
    face: CubeFace.Front,
    poly: { face: CubeFace.Front, vertices: squarePoly(0.2) },
    depthInner: 0.1,
  };
  return buildShellShardGeometry(template);
}

function makeCoreCluster(): CoreShardCluster {
  const half = 0.1;
  const corners = [
    new Vector3(-half, -half, -half),
    new Vector3(half, -half, -half),
    new Vector3(half, half, -half),
    new Vector3(-half, half, -half),
    new Vector3(-half, -half, half),
    new Vector3(half, -half, half),
    new Vector3(half, half, half),
    new Vector3(-half, half, half),
  ];
  const cell: VolumeCell = { id: 0, corners, center: new Vector3(0, 0, 0), sizeHint: new Vector3(0.2, 0.2, 0.2) };
  return { id: 0, cells: [cell] };
}

describe('canonicalShards', () => {
  it('converts shell shard geometry to canonical with volume', () => {
    const geo = makeShellGeom();
    const canonical = buildCanonicalShellShards([geo]);
    expect(canonical).toHaveLength(1);
    expect(canonical[0].materialKind).toBe('faceAndGold');
    expect(canonical[0].approximateVolume).toBeGreaterThan(0);
    expect(canonical[0].positions.length).toBeGreaterThan(0);
    expect(canonical[0].uvs.length).toBeGreaterThan(0);
  });

  it('converts core clusters to canonical gold-only shards', () => {
    const cluster = makeCoreCluster();
    const canonical = buildCanonicalCoreShards([cluster]);
    expect(canonical).toHaveLength(1);
    const shard = canonical[0];
    expect(shard.materialKind).toBe('goldInnerOnly');
    expect(shard.uvs.every((v) => v === 0)).toBe(true);
    expect(shard.indices.length % 3).toBe(0);
    expect(shard.approximateVolume).toBeCloseTo(0.2 * 0.2 * 0.2);
  });

  it('merges shell and core shards with sequential ids', () => {
    const shell = buildCanonicalShellShards([makeShellGeom()], 0);
    const core = buildCanonicalCoreShards([makeCoreCluster()], shell.length);
    const merged = buildCanonicalShards({ shell: [makeShellGeom()], core: [makeCoreCluster()] });

    const ids: number[] = merged.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(merged[0].materialKind).toBe('faceAndGold');
    expect(merged[1].materialKind).toBe('goldInnerOnly');
  });
});
