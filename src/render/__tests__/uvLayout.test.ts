import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyMahjongUVLayout } from '../uv';

describe('applyMahjongUVLayout', () => {
  it('keeps the outward face in the front band and all other faces in the side band', () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
    applyMahjongUVLayout(geometry);

    const positions = geometry.getAttribute('position');
    const uvs = geometry.getAttribute('uv');
    const normals = geometry.getAttribute('normal');
    let frontCount = 0;
    let frontVMin = 1;
    let frontVMax = 0;
    let sideVMax = 0;
    let sideVMin = 1;

    for (let i = 0; i < positions.count; i += 1) {
      const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
      const v = uvs.getY(i);
      if (
        normal.z > 0.9 &&
        Math.abs(normal.z) >= Math.abs(normal.x) &&
        Math.abs(normal.z) >= Math.abs(normal.y)
      ) {
        frontCount += 1;
        frontVMin = Math.min(frontVMin, v);
        frontVMax = Math.max(frontVMax, v);
      } else {
        sideVMax = Math.max(sideVMax, v);
        sideVMin = Math.min(sideVMin, v);
      }
    }

    expect(frontCount).toBeGreaterThan(0);
    expect(frontVMin).toBeGreaterThanOrEqual(0.55 - 1e-6);
    expect(frontVMax).toBeLessThanOrEqual(0.95 + 1e-6);
    expect(sideVMin).toBeGreaterThanOrEqual(0.05 - 1e-6);
    expect(sideVMax).toBeLessThanOrEqual(0.45 + 1e-6);
    expect(frontVMin - sideVMax).toBeGreaterThanOrEqual(0.08 - 1e-6);
  });
});
