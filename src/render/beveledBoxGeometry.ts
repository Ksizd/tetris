import * as THREE from 'three';

export interface BeveledBoxParams {
  width: number;
  height: number;
  depth: number;
  radius: number;
  smoothness?: number; // segments per edge; higher = softer bevel
}

/**
 * Generates a low-poly beveled box by clamping vertices to an inset box and pushing them outward by radius.
 * Keeps target dimensions while rounding edges. Intended for instanced meshes, so keeps geometry lightweight.
 */
export function createBeveledBoxGeometry(params: BeveledBoxParams): THREE.BufferGeometry {
  const { width, height, depth } = params;
  if (width <= 0 || height <= 0 || depth <= 0) {
    throw new Error('Beveled box dimensions must be positive');
  }
  const halfW = width / 2;
  const halfH = height / 2;
  const halfD = depth / 2;
  const maxRadius = Math.min(halfW, halfH, halfD) - 1e-4;
  const radius = clamp(params.radius, 0, maxRadius);
  const segments = Math.max(1, Math.floor(params.smoothness ?? 3));

  const geometry = new THREE.BoxGeometry(width, height, depth, segments, segments, segments);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  const clamped = new THREE.Vector3();
  const offset = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    clamped.set(
      clamp(vertex.x, -halfW + radius, halfW - radius),
      clamp(vertex.y, -halfH + radius, halfH - radius),
      clamp(vertex.z, -halfD + radius, halfD - radius)
    );
    offset.subVectors(vertex, clamped);
    if (offset.lengthSq() > 0) {
      offset.normalize().multiplyScalar(radius);
      vertex.copy(clamped).add(offset);
    } else {
      vertex.copy(clamped);
    }
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.normalizeNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
