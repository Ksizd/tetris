import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createActivePieceInstancedMesh } from '../activePieceInstancedMesh';
import { createBoardRenderConfig } from '../boardConfig';

describe('createActivePieceInstancedMesh', () => {
  it('creates instanced mesh for up to 4 blocks with zero count', () => {
    const config = createBoardRenderConfig({ width: 10, height: 20 }, { blockSize: 1.25 });
    const { mesh, geometry, material } = createActivePieceInstancedMesh(config);

    expect(mesh.count).toBe(0);
    expect(mesh.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.material).toBe(material);
    expect(mesh.count).toBeLessThanOrEqual(4);
    expect(mesh.frustumCulled).toBe(false);
  });
});
