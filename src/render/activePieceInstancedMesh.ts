import * as THREE from 'three';
import { BoardRenderConfig } from './boardConfig';
import { createBeveledBoxGeometry } from './beveledBoxGeometry';
import { applyMahjongUVLayout } from './uv';
import { createMahjongMaterialMaps, createMahjongTileTexture } from './textures';
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
  materials: MaterialConfig = {
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
    emissive: materials.front.emissive,
    emissiveIntensity: materials.front.emissiveIntensity,
    envMapIntensity: materials.front.envMapIntensity,
  });
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2c14b,
    map: tileTexture,
    roughness: materials.side.roughness,
    metalness: materials.side.metalness,
    roughnessMap,
    metalnessMap,
    aoMap,
    emissive: materials.side.emissive,
    emissiveIntensity: materials.side.emissiveIntensity,
    envMapIntensity: materials.side.envMapIntensity,
  });

  const mesh = new THREE.InstancedMesh(
    geometry,
    [frontMaterial, sideMaterial],
    ACTIVE_PIECE_CAPACITY
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'activePieceInstanced';

  return { mesh, geometry, material: [frontMaterial, sideMaterial] };
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
