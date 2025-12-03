import * as THREE from 'three';
import { CubeFace } from '../app/destruction/cubeSpace';
import { DEFAULT_CUBE_UV_LAYOUT } from '../app/destruction/faceUvRect';

/**
 * Applies consistent 0..1 UVs to all faces of a BoxGeometry to avoid mirrored tiles.
 */
export function applyUniformBoxUVs(geometry: THREE.BoxGeometry): void {
  const uv = [];
  const faceUV = [
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 1, v: 1 },
    { u: 0, v: 1 },
  ];

  // 6 faces * 2 triangles * 3 vertices = 36 vertices, but BoxGeometry uses 24 unique vertices for UVs.
  for (let face = 0; face < 6; face += 1) {
    // two triangles per face: (0,1,2) and (2,3,0)
    uv.push(
      faceUV[0].u,
      faceUV[0].v,
      faceUV[1].u,
      faceUV[1].v,
      faceUV[3].u,
      faceUV[3].v,
      faceUV[1].u,
      faceUV[1].v,
      faceUV[2].u,
      faceUV[2].v,
      faceUV[3].u,
      faceUV[3].v
    );
  }

  const uvAttr = new THREE.Float32BufferAttribute(uv, 2);
  geometry.setAttribute('uv', uvAttr);
}

/**
 * Applies a two-band UV layout where only the outward (+Z) face uses the front band (top of the atlas),
 * and the remaining five faces share the side band (bottom of the atlas). The mapping is normal-driven
 * to keep beveled edges aligned with their dominant facing direction and avoid front/side bleed.
 * Geometry is converted to non-indexed so every vertex can receive an explicit UV.
 */
export function applyMahjongUVLayout(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const working = geometry.index ? geometry.toNonIndexed() : geometry;
  working.computeBoundingBox();
  const bbox = working.boundingBox;
  if (!bbox) {
    throw new Error('Geometry must have a bounding box for UV layout');
  }
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const half = size.clone().multiplyScalar(0.5);
  const positions = working.getAttribute('position');
  const normals = working.getAttribute('normal');
  if (!positions || !normals) {
    throw new Error('Geometry must have position and normal attributes for UV layout');
  }

  const uv: number[] = [];
  const pos = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < positions.count; i += 1) {
    pos.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i);
    const plane = resolvePlane(normal);
    const region = plane === CubeFace.Front ? FRONT_REGION : SIDE_REGION;
    const { u, v } = projectToPlane(pos, size, half, plane);

    uv.push(mapRange(u, region.u), mapRange(v, region.v));
  }

  working.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  working.attributes.uv.needsUpdate = true;

  if (working !== geometry) {
    geometry.copy(working);
  }
  return geometry;
}

type Plane = CubeFace;

interface Range {
  min: number;
  max: number;
}

interface Region {
  u: Range;
  v: Range;
}

function rectToRegion(rect: { u0: number; u1: number; v0: number; v1: number }): Region {
  return {
    u: { min: rect.u0, max: rect.u1 },
    v: { min: rect.v0, max: rect.v1 },
  };
}

const FRONT_REGION: Region = rectToRegion(DEFAULT_CUBE_UV_LAYOUT.faces[CubeFace.Front]);
const SIDE_REGION: Region = rectToRegion(DEFAULT_CUBE_UV_LAYOUT.faces[CubeFace.Right]);

function resolvePlane(normal: THREE.Vector3): Plane {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);

  if (az >= ax && az >= ay) {
    return normal.z >= 0 ? CubeFace.Front : CubeFace.Back;
  }
  if (ax >= ay && ax >= az) {
    return normal.x >= 0 ? CubeFace.Right : CubeFace.Left;
  }
  return normal.y >= 0 ? CubeFace.Top : CubeFace.Bottom;
}

function projectToPlane(
  pos: THREE.Vector3,
  size: THREE.Vector3,
  half: THREE.Vector3,
  plane: Plane
): { u: number; v: number } {
  switch (plane) {
    case CubeFace.Front:
    case CubeFace.Back:
      return {
        u: (pos.x + half.x) / size.x,
        v: (pos.y + half.y) / size.y,
      };
    case CubeFace.Right:
    case CubeFace.Left:
      return {
        u: (pos.z + half.z) / size.z,
        v: (pos.y + half.y) / size.y,
      };
    case CubeFace.Top:
    case CubeFace.Bottom:
    default:
      return {
        u: (pos.x + half.x) / size.x,
        v: (pos.z + half.z) / size.z,
      };
  }
}

function mapRange(value: number, range: Range): number {
  return range.min + clamp01(value) * (range.max - range.min);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
