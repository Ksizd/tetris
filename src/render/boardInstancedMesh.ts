import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig, createBoardRenderConfig } from './boardConfig';
import { createMahjongTileTexture } from './textures';
import { applyMahjongUVLayout } from './uv';
import { createBeveledBoxGeometry } from './beveledBoxGeometry';

export interface BoardInstancedResources {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  capacity: number;
}

/**
 * Prepares an instanced mesh for board blocks. Instances are zeroed (count=0); population will be handled by renderBoard.
 */
export function createBoardInstancedMesh(
  dimensions: BoardDimensions,
  config?: Partial<BoardRenderConfig>
): BoardInstancedResources {
  const resolvedConfig = createBoardRenderConfig(dimensions, config);
  const geometry = createBeveledBoxGeometry({
    width: resolvedConfig.blockSize,
    height: resolvedConfig.blockSize,
    depth: resolvedConfig.blockDepth,
    radius: resolvedConfig.edgeRadius,
    smoothness: 3,
  });
  applyMahjongUVLayout(geometry);
  const tileTexture = createMahjongTileTexture();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tileTexture,
    roughness: 0.35,
    metalness: 0.15,
  });

  const capacity = dimensions.width * dimensions.height;
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false; // cylindrical layout; bounding sphere would need per-instance updates later
  mesh.name = 'boardBlocksInstanced';

  return { mesh, geometry, material, capacity };
}
