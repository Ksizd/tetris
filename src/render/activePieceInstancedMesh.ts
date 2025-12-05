import * as THREE from 'three';
import { BoardRenderConfig } from './boardConfig';
import { createBeveledBoxGeometry } from './beveledBoxGeometry';
import { applyMahjongUVLayout } from './uv';
import { createCanonicalTileMaterials } from './textures';
import { MaterialConfig } from './renderConfig';

export interface ActivePieceInstancedResources {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
}

const ACTIVE_PIECE_CAPACITY = 4;

/**
 * Prepares instanced mesh for the active piece (up to 4 blocks).
 * Population will be handled by renderActivePiece.
 */
export function createActivePieceInstancedMesh(
  config: BoardRenderConfig,
  materialConfig: MaterialConfig = {
    front: {
      roughness: 0.22,
      metalness: 0.04,
      envMapIntensity: 0.9,
      emissive: 0x221100,
      emissiveIntensity: 0.06,
    },
    side: {
      roughness: 0.28,
      metalness: 1.0,
      envMapIntensity: 1.8,
      emissive: 0x331100,
      emissiveIntensity: 0.08,
    },
  }
): ActivePieceInstancedResources {
  const geometry = createBeveledBoxGeometry({
    width: config.blockSize,
    height: config.blockSize,
    depth: config.blockDepth,
    radius: config.edgeRadius,
    smoothness: 3,
  });
  applyMahjongUVLayout(geometry);
  tagFrontGroup(geometry);
  const canonical = createCanonicalTileMaterials();
  applyMaterialOverrides(canonical.face, materialConfig.front);
  applyMaterialOverrides(canonical.goldOuter, materialConfig.side);

  const materials = [canonical.face, canonical.goldOuter];
  const mesh = new THREE.InstancedMesh(geometry, materials, ACTIVE_PIECE_CAPACITY);
  mesh.material = materials;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'activePieceInstanced';

  return { mesh, geometry, material: materials };
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
