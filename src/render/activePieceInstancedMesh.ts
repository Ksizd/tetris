import * as THREE from 'three';
import { BoardRenderConfig } from './boardConfig';

export interface ActivePieceInstancedResources {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BoxGeometry;
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
  const geometry = new THREE.BoxGeometry(config.blockSize, config.blockSize, config.blockSize);
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
