import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBoardInstancedMesh } from '../boardInstancedMesh';
import { createBoardRenderConfig } from '../boardConfig';
import { applyUniformBoxUVs } from '../uv';

describe('createBoardInstancedMesh', () => {
  const dimensions = { width: 4, height: 3 };

  it('creates instanced mesh with capacity matching board size and zero count', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 1.5 });
    const { mesh, capacity, geometry, material } = createBoardInstancedMesh(dimensions, config);

    expect(capacity).toBe(dimensions.width * dimensions.height);
    expect(mesh.count).toBe(0);
    expect(mesh.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.material).toBe(material);
    expect(mesh.frustumCulled).toBe(false);
  });

  it('applies a texture map to board material', () => {
    const { material } = createBoardInstancedMesh(dimensions);
    expect(material.map).toBeInstanceOf(THREE.Texture);
  });

  it('applies uniform box UVs (no mirroring)', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    applyUniformBoxUVs(geometry);
    const uv = geometry.getAttribute('uv').array as Iterable<number>;
    const firstFace = Array.from(uv).slice(0, 12);
    expect(firstFace).toEqual([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]);
  });
});
