import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig, createBoardRenderConfig } from './boardConfig';
import { createMahjongMaterialMaps, createMahjongTileTexture } from './textures';
import { applyMahjongUVLayout } from './uv';
import { createBeveledBoxGeometry } from './beveledBoxGeometry';

export interface BoardInstancedResources {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
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
  const { roughnessMap, metalnessMap, aoMap } = createMahjongMaterialMaps(tileTexture.image.width ?? 1024);
  tagFrontGroup(geometry);

  const frontMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tileTexture,
    roughness: 0.25,
    metalness: 0.05,
    roughnessMap,
    metalnessMap,
    aoMap,
    envMapIntensity: 1.0,
  });

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0xf3c15c,
    map: tileTexture,
    roughness: 0.25,
    metalness: 1.0,
    roughnessMap,
    metalnessMap,
    aoMap,
    envMapIntensity: 1.25,
  });

  const capacity = dimensions.width * dimensions.height;
  const mesh = new THREE.InstancedMesh(geometry, [frontMaterial, sideMaterial], capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false; // cylindrical layout; bounding sphere would need per-instance updates later
  mesh.name = 'boardBlocksInstanced';

  return { mesh, geometry, material: [frontMaterial, sideMaterial], capacity };
}

function tagFrontGroup(geometry: THREE.BufferGeometry): void {
  if (!geometry.groups.length) {
    return;
  }
  const FRONT_GROUP_INDEX = 4; // BoxGeometry order: +X, -X, +Y, -Y, +Z, -Z
  geometry.groups.forEach((group, idx) => {
    // eslint-disable-next-line no-param-reassign
    group.materialIndex = idx === FRONT_GROUP_INDEX ? 0 : 1;
  });
}
