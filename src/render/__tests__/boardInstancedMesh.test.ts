import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBoardInstancedMesh } from '../boardInstancedMesh';
import { createBoardRenderConfig } from '../boardConfig';

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
});
