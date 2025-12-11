import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig, createBoardRenderConfig } from './boardConfig';
import { createCanonicalTileMaterials, getMahjongTileTexture } from './textures';
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
  tagFrontGroup(geometry);
  getMahjongTileTexture(); // prefetch cached texture
  const canonical = createCanonicalTileMaterials();
  applyMaterialOverrides(canonical.face, materials.front);
  applyMaterialOverrides(canonical.goldOuter, materials.side);

  const capacity = dimensions.width * dimensions.height;
  const materialArray = [canonical.face, canonical.goldOuter];
  const mesh = new THREE.InstancedMesh(geometry, materialArray, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false; // cylindrical layout; bounding sphere would need per-instance updates later
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'boardBlocksInstanced';
  mesh.userData.instanceDebugTag = {
    kind: 'towerCell',
    sourceFile: 'src/render/boardInstancedMesh.ts',
  };

  return { mesh, geometry, material: materialArray, capacity };
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

function applyMaterialOverrides(
  material: THREE.MeshStandardMaterial,
  overrides?: MaterialConfig['front']
): void {
  if (!overrides) {
    return;
  }
  if (overrides.roughness !== undefined) {
    material.roughness = overrides.roughness;
  }
  if (overrides.metalness !== undefined) {
    material.metalness = overrides.metalness;
  }
  if (overrides.envMapIntensity !== undefined) {
    material.envMapIntensity = overrides.envMapIntensity;
  }
  if (overrides.emissive !== undefined) {
    material.emissive = new THREE.Color(overrides.emissive);
  }
  if (overrides.emissiveIntensity !== undefined) {
    material.emissiveIntensity = overrides.emissiveIntensity;
  }
}
