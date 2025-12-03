import { Vector3 } from 'three';
import { bindCoreShardClusters, validateCoreBindings } from '../coreShardBindings';
import { CoreShardCluster } from '../coreShardClusters';
import { CubeFace, CUBE_LOCAL_MAX } from '../cubeSpace';
import { VolumeCell } from '../coreVolumeCells';
import { SHELL_DEPTH } from '../shellLayers';

function makeCell(id: number, center: Vector3, size: number): VolumeCell {
  const half = size * 0.5;
  const corners = [
    new Vector3(center.x - half, center.y - half, center.z - half),
    new Vector3(center.x + half, center.y - half, center.z - half),
    new Vector3(center.x + half, center.y + half, center.z - half),
    new Vector3(center.x - half, center.y + half, center.z - half),
    new Vector3(center.x - half, center.y - half, center.z + half),
    new Vector3(center.x + half, center.y - half, center.z + half),
    new Vector3(center.x + half, center.y + half, center.z + half),
    new Vector3(center.x - half, center.y + half, center.z + half),
  ];
  return { id, corners, center, sizeHint: new Vector3(size, size, size) };
}

function makeCluster(id: number, cells: VolumeCell[]): CoreShardCluster {
  return { id, cells };
}

const CORE_HALF = CUBE_LOCAL_MAX - SHELL_DEPTH;

describe('bindCoreShardClusters', () => {
  it('marks clusters touching front as outer and binds primaryFace front', () => {
    const cell = makeCell(0, new Vector3(0, 0, CORE_HALF - 0.02), 0.04);
    const clusters = [makeCluster(0, [cell])];
    const bindings = bindCoreShardClusters(clusters);

    expect(bindings[0].primaryFace).toBe(CubeFace.Front);
    expect(bindings[0].layer).toBe('outer');
    const frontBinding = bindings[0].faces.find((f) => f.face === CubeFace.Front);
    expect(frontBinding?.anchor.z).toBeCloseTo(CORE_HALF, 5);
    expect(frontBinding?.weight).toBeGreaterThan(0.3);
  });

  it('binds left-near clusters to left face', () => {
    const cell = makeCell(0, new Vector3(-CORE_HALF + 0.01, 0, 0), 0.04);
    const clusters = [makeCluster(1, [cell])];
    const bindings = bindCoreShardClusters(clusters);

    expect(bindings[0].primaryFace).toBe(CubeFace.Left);
    const left = bindings[0].faces.find((f) => f.face === CubeFace.Left);
    expect(left?.anchor.x).toBeCloseTo(-CORE_HALF, 5);
    expect(left?.rect.u0).toBeGreaterThanOrEqual(0);
    expect(left?.rect.u1).toBeLessThanOrEqual(1);
  });

  it('keeps central clusters as inner with balanced weights', () => {
    const cell = makeCell(0, new Vector3(0, 0, 0), 0.05);
    const bindings = bindCoreShardClusters([makeCluster(2, [cell])]);
    const result = validateCoreBindings(bindings);

    expect(bindings[0].layer).toBe('inner');
    expect(result.ok).toBe(true);
    const weights = bindings[0].faces.map((f) => f.weight);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    expect(maxWeight - minWeight).toBeLessThan(0.15);
  });
});
