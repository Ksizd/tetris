import { Vector3 } from 'three';
import { CubeFace, CUBE_LOCAL_MIN, CUBE_LOCAL_MAX, CUBE_LOCAL_SIZE } from './cubeSpace';
import { CoreShardCluster } from './coreShardClusters';
import { VolumeCell } from './coreVolumeCells';
import { SHELL_DEPTH } from './shellLayers';

export type CoreShardLayer = 'outer' | 'inner';

export interface FaceFootprint {
  face: CubeFace;
  weight: number;
  anchor: Vector3;
  rect: { u0: number; v0: number; u1: number; v1: number };
}

export interface CoreShardBinding {
  clusterId: number;
  primaryFace: CubeFace;
  layer: CoreShardLayer;
  faces: FaceFootprint[];
}

interface Bounds {
  min: Vector3;
  max: Vector3;
}

const FACE_ORDER: CubeFace[] = [
  CubeFace.Front,
  CubeFace.Back,
  CubeFace.Left,
  CubeFace.Right,
  CubeFace.Top,
  CubeFace.Bottom,
];

function computeBounds(cells: VolumeCell[]): Bounds {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  cells.forEach((cell) => {
    cell.corners.forEach((p) => {
      min.min(p);
      max.max(p);
    });
  });
  return { min, max };
}

function faceDistance(bounds: Bounds, face: CubeFace, coreHalf: number): number {
  switch (face) {
    case CubeFace.Front:
      return Math.max(0, coreHalf - bounds.max.z);
    case CubeFace.Back:
      return Math.max(0, bounds.min.z + coreHalf);
    case CubeFace.Right:
      return Math.max(0, coreHalf - bounds.max.x);
    case CubeFace.Left:
      return Math.max(0, bounds.min.x + coreHalf);
    case CubeFace.Top:
      return Math.max(0, coreHalf - bounds.max.y);
    case CubeFace.Bottom:
      return Math.max(0, bounds.min.y + coreHalf);
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function clampToCore(value: number, coreHalf: number): number {
  return Math.max(-coreHalf, Math.min(coreHalf, value));
}

function projectBoundsToFace(bounds: Bounds, face: CubeFace, coreHalf: number): { u0: number; v0: number; u1: number; v1: number } {
  const toUnit = (v: number) => (v + coreHalf) / (2 * coreHalf);
  const x0 = clampToCore(bounds.min.x, coreHalf);
  const x1 = clampToCore(bounds.max.x, coreHalf);
  const y0 = clampToCore(bounds.min.y, coreHalf);
  const y1 = clampToCore(bounds.max.y, coreHalf);
  const z0 = clampToCore(bounds.min.z, coreHalf);
  const z1 = clampToCore(bounds.max.z, coreHalf);

  switch (face) {
    case CubeFace.Front: {
      const u0 = toUnit(x0);
      const u1 = toUnit(x1);
      const v0 = toUnit(y0);
      const v1 = toUnit(y1);
      return { u0, v0, u1, v1 };
    }
    case CubeFace.Back: {
      const u0 = toUnit(-x1);
      const u1 = toUnit(-x0);
      const v0 = toUnit(y0);
      const v1 = toUnit(y1);
      return { u0, v0, u1, v1 };
    }
    case CubeFace.Right: {
      const u0 = toUnit(-z1);
      const u1 = toUnit(-z0);
      const v0 = toUnit(y0);
      const v1 = toUnit(y1);
      return { u0, v0, u1, v1 };
    }
    case CubeFace.Left: {
      const u0 = toUnit(z0);
      const u1 = toUnit(z1);
      const v0 = toUnit(y0);
      const v1 = toUnit(y1);
      return { u0, v0, u1, v1 };
    }
    case CubeFace.Top: {
      const u0 = toUnit(x0);
      const u1 = toUnit(x1);
      const v0 = toUnit(-z1);
      const v1 = toUnit(-z0);
      return { u0, v0, u1, v1 };
    }
    case CubeFace.Bottom: {
      const u0 = toUnit(x0);
      const u1 = toUnit(x1);
      const v0 = toUnit(z0);
      const v1 = toUnit(z1);
      return { u0, v0, u1, v1 };
    }
    default:
      return { u0: 0, v0: 0, u1: 1, v1: 1 };
  }
}

function anchorOnFace(bounds: Bounds, face: CubeFace, coreHalf: number): Vector3 {
  const cx = (bounds.min.x + bounds.max.x) * 0.5;
  const cy = (bounds.min.y + bounds.max.y) * 0.5;
  const cz = (bounds.min.z + bounds.max.z) * 0.5;
  switch (face) {
    case CubeFace.Front:
      return new Vector3(cx, cy, coreHalf);
    case CubeFace.Back:
      return new Vector3(cx, cy, -coreHalf);
    case CubeFace.Right:
      return new Vector3(coreHalf, cy, cz);
    case CubeFace.Left:
      return new Vector3(-coreHalf, cy, cz);
    case CubeFace.Top:
      return new Vector3(cx, coreHalf, cz);
    case CubeFace.Bottom:
      return new Vector3(cx, -coreHalf, cz);
    default:
      return new Vector3(cx, cy, cz);
  }
}

function normalizeWeights(bindings: FaceFootprint[]): FaceFootprint[] {
  const total = bindings.reduce((acc, item) => acc + item.weight, 0);
  if (total <= 0) {
    return bindings.map((item) => ({ ...item, weight: 1 / bindings.length }));
  }
  return bindings.map((item) => ({ ...item, weight: item.weight / total }));
}

function buildFaceBindings(bounds: Bounds, coreHalf: number, sizeHint: number): FaceFootprint[] {
  const epsilon = Math.max(1e-4, sizeHint * 0.1);
  const bindings = FACE_ORDER.map((face) => {
    const dist = faceDistance(bounds, face, coreHalf);
    const weight = 1 / (dist + epsilon);
    return {
      face,
      weight,
      anchor: anchorOnFace(bounds, face, coreHalf),
      rect: projectBoundsToFace(bounds, face, coreHalf),
    };
  });
  return normalizeWeights(bindings);
}

function classifyLayer(bounds: Bounds, coreHalf: number, sizeHint: number): CoreShardLayer {
  const nearestFaceDist = Math.min(
    coreHalf - bounds.max.z,
    bounds.min.z + coreHalf,
    coreHalf - bounds.max.x,
    bounds.min.x + coreHalf,
    coreHalf - bounds.max.y,
    bounds.min.y + coreHalf
  );
  const threshold = Math.max(sizeHint * 0.6, SHELL_DEPTH * 0.35);
  return nearestFaceDist <= threshold ? 'outer' : 'inner';
}

function estimateCellSize(bounds: Bounds): number {
  const dx = bounds.max.x - bounds.min.x;
  const dy = bounds.max.y - bounds.min.y;
  const dz = bounds.max.z - bounds.min.z;
  return Math.max(1e-3, Math.min(dx, dy, dz));
}

export function bindCoreShardClusters(
  clusters: CoreShardCluster[],
  coreHalf = CUBE_LOCAL_MAX - SHELL_DEPTH
): CoreShardBinding[] {
  return clusters.map((cluster) => {
    const bounds = computeBounds(cluster.cells);
    const sizeHint = estimateCellSize(bounds);
    const faces = buildFaceBindings(bounds, coreHalf, sizeHint).sort((a, b) => b.weight - a.weight);
    const primaryFace = faces[0]?.face ?? CubeFace.Front;
    const layer = classifyLayer(bounds, coreHalf, sizeHint);
    return {
      clusterId: cluster.id,
      primaryFace,
      layer,
      faces,
    };
  });
}

export function validateCoreBindings(bindings: CoreShardBinding[]): { ok: boolean; reason?: string } {
  if (bindings.length === 0) {
    return { ok: true };
  }
  for (const binding of bindings) {
    const weightSum = binding.faces.reduce((acc, f) => acc + f.weight, 0);
    if (Math.abs(weightSum - 1) > 1e-3) {
      return { ok: false, reason: `weights not normalized for cluster ${binding.clusterId}` };
    }
    const hasPrimary = binding.faces.some((f) => f.face === binding.primaryFace);
    if (!hasPrimary) {
      return { ok: false, reason: `primaryFace missing in faces for cluster ${binding.clusterId}` };
    }
    for (const face of binding.faces) {
      const { u0, v0, u1, v1 } = face.rect;
      if (u0 > u1 + 1e-6 || v0 > v1 + 1e-6) {
        return { ok: false, reason: `rect ranges invalid for cluster ${binding.clusterId}` };
      }
      if (u0 < 0 - 1e-6 || v0 < 0 - 1e-6 || u1 > 1 + 1e-6 || v1 > 1 + 1e-6) {
        return { ok: false, reason: `rect out of bounds for cluster ${binding.clusterId}` };
      }
    }
  }
  return { ok: true };
}
