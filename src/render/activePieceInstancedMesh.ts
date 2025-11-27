import * as THREE from 'three';
import { BoardRenderConfig } from './boardConfig';
import { createBeveledBoxGeometry } from './beveledBoxGeometry';
import { applyMahjongUVLayout } from './uv';

export interface ActivePieceInstancedResources {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

const ACTIVE_PIECE_CAPACITY = 4;

/**
 * Prepares instanced mesh for the active piece (up to 4 blocks).
 * Population will be handled by renderActivePiece.
 */
export function createActivePieceInstancedMesh(
  config: BoardRenderConfig
): ActivePieceInstancedResources {
  const geometry = createBeveledBoxGeometry({
    width: config.blockSize,
    height: config.blockSize,
    depth: config.blockDepth,
    radius: config.edgeRadius,
    smoothness: 3,
  });
  applyMahjongUVLayout(geometry);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffcc66,
    roughness: 0.3,
    metalness: 0.2,
    emissive: 0x331100,
    emissiveIntensity: 0.1,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, ACTIVE_PIECE_CAPACITY);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.name = 'activePieceInstanced';

  return { mesh, geometry, material };
}
