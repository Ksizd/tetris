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
