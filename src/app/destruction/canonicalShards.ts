import { Vector2, Vector3 } from 'three';
import { CubeFace } from './cubeSpace';
import { ShellShardGeometry } from './shellShardGeometryBuilder';
import { CoreShardCluster } from './coreShardClusters';
import { VolumeCell } from './coreVolumeCells';
import { getFaceBasis } from './shardGeometryBuilder';

export interface CanonicalShard {
  id: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array | Uint32Array;
  materialKind: 'faceAndGold' | 'goldInnerOnly';
  approximateVolume: number;
}

interface FloatGeometry {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array | Uint32Array;
}

function toFloatArrays(
  positions: Vector3[],
  normals: Vector3[],
  uvs: Vector2[],
  indices: number[]
): FloatGeometry {
  const pos = new Float32Array(positions.length * 3);
  const nrm = new Float32Array(normals.length * 3);
  const uv = new Float32Array(uvs.length * 2);
  positions.forEach((p, i) => {
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.z;
  });
  normals.forEach((p, i) => {
    nrm[i * 3] = p.x;
    nrm[i * 3 + 1] = p.y;
    nrm[i * 3 + 2] = p.z;
  });
  uvs.forEach((t, i) => {
    uv[i * 2] = t.x;
    uv[i * 2 + 1] = t.y;
  });
  const indexArray = positions.length > 65_535 ? new Uint32Array(indices) : new Uint16Array(indices);
  return { positions: pos, normals: nrm, uvs: uv, indices: indexArray };
}

function polygonArea2D(vertices: Vector2[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) * 0.5;
}

function projectToBasis(positions: Vector3[], face: CubeFace): Vector2[] {
  const basis = getFaceBasis(face);
  return positions.map((p) => {
    const delta = p.clone().sub(basis.origin);
    return new Vector2(delta.dot(basis.u), delta.dot(basis.v));
  });
}

function estimateShellVolume(geometry: ShellShardGeometry): number {
  const n = geometry.positions.length / 2;
  const front = geometry.positions.slice(0, n);
  const back = geometry.positions.slice(n);
  const basis = getFaceBasis(geometry.face);
  const area = polygonArea2D(projectToBasis(front, geometry.face));
  const depth =
    back.reduce((acc, p, idx) => {
      const f = front[idx];
      return acc + Math.abs(p.clone().sub(f).dot(basis.normal));
    }, 0) / Math.max(1, back.length);
  return area * depth;
}

function ensureCoreUvs(count: number): Vector2[] {
  return Array.from({ length: count }, () => new Vector2(0, 0));
}

function cellVolume(cell: VolumeCell): number {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  cell.corners.forEach((c) => {
    min.min(c);
    max.max(c);
  });
  const size = max.sub(min);
  return Math.abs(size.x * size.y * size.z);
}

function buildBoxIndices(offset: number): number[] {
  const o = offset;
  return [
    // back (-z)
    o + 0,
    o + 2,
    o + 1,
    o + 0,
    o + 3,
    o + 2,
    // front (+z)
    o + 4,
    o + 5,
    o + 6,
    o + 4,
    o + 6,
    o + 7,
    // top (+y)
    o + 7,
    o + 6,
    o + 2,
    o + 7,
    o + 2,
    o + 3,
    // bottom (-y)
    o + 0,
    o + 1,
    o + 5,
    o + 0,
    o + 5,
    o + 4,
    // right (+x)
    o + 1,
    o + 2,
    o + 6,
    o + 1,
    o + 6,
    o + 5,
    // left (-x)
    o + 0,
    o + 7,
    o + 3,
    o + 0,
    o + 4,
    o + 7,
  ];
}

function buildBoxNormals(positions: Vector3[], indices: number[]): Vector3[] {
  const normals = positions.map(() => new Vector3());
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i];
    const ib = indices[i + 1];
    const ic = indices[i + 2];
    const a = positions[ia];
    const b = positions[ib];
    const c = positions[ic];
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    normals[ia].add(n);
    normals[ib].add(n);
    normals[ic].add(n);
  }
  normals.forEach((n) => n.normalize());
  return normals;
}

function buildCoreShardGeometry(cluster: CoreShardCluster): { positions: Vector3[]; uvs: Vector2[]; indices: number[]; volume: number } {
  const positions: Vector3[] = [];
  const indices: number[] = [];
  let volume = 0;

  cluster.cells.forEach((cell) => {
    const base = positions.length;
    positions.push(...cell.corners.map((c) => c.clone()));
    indices.push(...buildBoxIndices(base));
    volume += cellVolume(cell);
  });

  const uvs = ensureCoreUvs(positions.length);
  return { positions, uvs, indices, volume };
}

export function buildCanonicalShellShards(shellGeometries: ShellShardGeometry[], startId = 0): CanonicalShard[] {
  return shellGeometries.map((geom, idx) => {
    const floats = toFloatArrays(geom.positions, geom.normals, geom.uvs, geom.indices);
    return {
      id: startId + idx,
      ...floats,
      materialKind: 'faceAndGold',
      approximateVolume: estimateShellVolume(geom),
    };
  });
}

export function buildCanonicalCoreShards(clusters: CoreShardCluster[], startId = 0): CanonicalShard[] {
  return clusters.map((cluster, idx) => {
    const { positions, uvs, indices, volume } = buildCoreShardGeometry(cluster);
    const normals = buildBoxNormals(positions, indices);
    const floats = toFloatArrays(positions, normals, uvs, indices);
    return {
      id: startId + idx,
      ...floats,
      materialKind: 'goldInnerOnly',
      approximateVolume: volume,
    };
  });
}

export function buildCanonicalShards(params: {
  shell: ShellShardGeometry[];
  core: CoreShardCluster[];
}): CanonicalShard[] {
  const shell = buildCanonicalShellShards(params.shell, 0);
  const core = buildCanonicalCoreShards(params.core, shell.length);
  return [...shell, ...core];
}
