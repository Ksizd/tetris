import { Vector3 } from 'three';
import { CubeFace, CUBE_LOCAL_MAX, CUBE_LOCAL_MIN, CUBE_LOCAL_SIZE } from './cubeSpace';

export interface CubeFaceUvRect {
  face: CubeFace;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface CubeUvLayout {
  faces: Record<CubeFace, CubeFaceUvRect>;
}

// Legacy alias to keep existing imports working while aligning with 12H.1.1 terminology.
export type FaceUvRect = CubeFaceUvRect;

export const DEFAULT_CUBE_UV_LAYOUT: CubeUvLayout = {
  faces: {
    [CubeFace.Front]: { face: CubeFace.Front, u0: 0.08, v0: 0.55, u1: 0.92, v1: 0.95 },
    [CubeFace.Back]: { face: CubeFace.Back, u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
    [CubeFace.Right]: { face: CubeFace.Right, u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
    [CubeFace.Left]: { face: CubeFace.Left, u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
    [CubeFace.Top]: { face: CubeFace.Top, u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
    [CubeFace.Bottom]: { face: CubeFace.Bottom, u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
  },
};

export const DEFAULT_FACE_UV_RECTS: Record<CubeFace, CubeFaceUvRect> = DEFAULT_CUBE_UV_LAYOUT.faces;

const FACE_PLANE_CHECK = {
  [CubeFace.Front]: (p: Vector3, eps: number) => Math.abs(p.z - CUBE_LOCAL_MAX) <= eps,
  [CubeFace.Back]: (p: Vector3, eps: number) => Math.abs(p.z - CUBE_LOCAL_MIN) <= eps,
  [CubeFace.Left]: (p: Vector3, eps: number) => Math.abs(p.x - CUBE_LOCAL_MIN) <= eps,
  [CubeFace.Right]: (p: Vector3, eps: number) => Math.abs(p.x - CUBE_LOCAL_MAX) <= eps,
  [CubeFace.Top]: (p: Vector3, eps: number) => Math.abs(p.y - CUBE_LOCAL_MAX) <= eps,
  [CubeFace.Bottom]: (p: Vector3, eps: number) => Math.abs(p.y - CUBE_LOCAL_MIN) <= eps,
} satisfies Record<CubeFace, (p: Vector3, eps: number) => boolean>;

function projectToFaceSquare(face: CubeFace, pos: Vector3): { u: number; v: number } | null {
  // Map 3D point lying on a given face to local square coordinates in [-0.5, 0.5]^2 following face basis from shardGeometryBuilder.
  switch (face) {
    case CubeFace.Front:
      return { u: pos.x, v: pos.y };
    case CubeFace.Back:
      return { u: -pos.x, v: pos.y };
    case CubeFace.Left:
      return { u: pos.z, v: pos.y };
    case CubeFace.Right:
      return { u: -pos.z, v: pos.y };
    case CubeFace.Top:
      return { u: pos.x, v: -pos.z };
    case CubeFace.Bottom:
      return { u: pos.x, v: pos.z };
    default:
      return null;
  }
}

function toUnitSquare(value: number): number {
  return (value - CUBE_LOCAL_MIN) / CUBE_LOCAL_SIZE;
}

/**
 * Samples UV coordinates for a point that lies on a specific cube face in local space [-0.5, 0.5]^3.
 * Returns undefined if the point is not on the requested face or outside the square extents.
 */
export function sampleFaceUv(
  face: CubeFace,
  localPos: Vector3,
  layout: CubeUvLayout = DEFAULT_CUBE_UV_LAYOUT,
  epsilon = 1e-4
): { u: number; v: number } | undefined {
  if (!FACE_PLANE_CHECK[face](localPos, epsilon)) {
    return undefined;
  }
  const projected = projectToFaceSquare(face, localPos);
  if (!projected) {
    return undefined;
  }
  if (
    projected.u < CUBE_LOCAL_MIN - epsilon ||
    projected.u > CUBE_LOCAL_MAX + epsilon ||
    projected.v < CUBE_LOCAL_MIN - epsilon ||
    projected.v > CUBE_LOCAL_MAX + epsilon
  ) {
    return undefined;
  }
  const sx = toUnitSquare(projected.u);
  const sy = toUnitSquare(projected.v);
  const rect = layout.faces[face];
  const u = rect.u0 + sx * (rect.u1 - rect.u0);
  const v = rect.v0 + (1 - sy) * (rect.v1 - rect.v0);
  return { u, v };
}
