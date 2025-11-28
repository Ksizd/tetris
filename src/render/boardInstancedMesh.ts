import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig, createBoardRenderConfig } from './boardConfig';
import { createMahjongMaterialMaps, createMahjongTileTexture } from './textures';
import { applyMahjongUVLayout } from './uv';
import { createBeveledBoxGeometry } from './beveledBoxGeometry';
import { MaterialConfig } from './renderConfig';

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
  config?: Partial<BoardRenderConfig>,
  materials: MaterialConfig = {
    front: { roughness: 0.22, metalness: 0.04, envMapIntensity: 0.9 },
    side: { roughness: 0.28, metalness: 1.0, envMapIntensity: 1.8 },
  }
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
  const { roughnessMap, metalnessMap, aoMap } = createMahjongMaterialMaps(
    tileTexture.image.width ?? 1024
  );
  tagFrontGroup(geometry);

  const frontMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tileTexture,
    roughness: materials.front.roughness,
    metalness: materials.front.metalness,
    roughnessMap,
    metalnessMap,
    aoMap,
    envMapIntensity: materials.front.envMapIntensity,
    emissive: materials.front.emissive,
    emissiveIntensity: materials.front.emissiveIntensity,
  });

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2c14b,
    map: tileTexture,
    roughness: materials.side.roughness,
    metalness: materials.side.metalness,
    roughnessMap,
    metalnessMap,
    aoMap,
    envMapIntensity: materials.side.envMapIntensity,
    emissive: materials.side.emissive,
    emissiveIntensity: materials.side.emissiveIntensity,
  });

  const capacity = dimensions.width * dimensions.height;
  const mesh = new THREE.InstancedMesh(geometry, [frontMaterial, sideMaterial], capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false; // cylindrical layout; bounding sphere would need per-instance updates later
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'boardBlocksInstanced';

  return { mesh, geometry, material: [frontMaterial, sideMaterial], capacity };
}

function tagFrontGroup(geometry: THREE.BufferGeometry): void {
  if (!geometry.groups.length) {
    return;
  }
  const FRONT_GROUP_INDEX = 4; // BoxGeometry order: +X, -X, +Y, -Y, +Z, -Z
  geometry.groups.forEach((group, idx) => {
    group.materialIndex = idx === FRONT_GROUP_INDEX ? 0 : 1;
  });
}
