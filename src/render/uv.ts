import * as THREE from 'three';

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
    const region = plane === 'front' ? FRONT_REGION : SIDE_REGION;
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

type Plane = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

interface Range {
  min: number;
  max: number;
}

interface Region {
  u: Range;
  v: Range;
}

const FRONT_REGION: Region = {
  u: { min: 0.08, max: 0.92 },
  v: { min: 0.55, max: 0.95 },
};

const SIDE_REGION: Region = {
  u: { min: 0.08, max: 0.92 },
  v: { min: 0.05, max: 0.45 },
};

function resolvePlane(normal: THREE.Vector3): Plane {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);

  if (az >= ax && az >= ay) {
    return normal.z >= 0 ? 'front' : 'back';
  }
  if (ax >= ay && ax >= az) {
    return normal.x >= 0 ? 'right' : 'left';
  }
  return normal.y >= 0 ? 'top' : 'bottom';
}

function projectToPlane(
  pos: THREE.Vector3,
  size: THREE.Vector3,
  half: THREE.Vector3,
  plane: Plane
): { u: number; v: number } {
  switch (plane) {
    case 'front':
    case 'back':
      return {
        u: (pos.x + half.x) / size.x,
        v: (pos.y + half.y) / size.y,
      };
    case 'right':
    case 'left':
      return {
        u: (pos.z + half.z) / size.z,
        v: (pos.y + half.y) / size.y,
      };
    case 'top':
    case 'bottom':
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
