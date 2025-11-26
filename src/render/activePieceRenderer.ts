import * as THREE from 'three';
import { ActivePiece } from '../core/types';
import { getWorldBlocks } from '../core/piece';
import { BoardToWorldMapper } from './boardToWorldMapper';
import { ActivePieceInstancedResources } from './activePieceInstancedMesh';

export interface RenderActivePieceParams {
  piece: ActivePiece | null;
  instanced: ActivePieceInstancedResources;
  mapper: BoardToWorldMapper;
  offsetY?: number;
}

/**
 * Updates instanced mesh for the active piece; when piece is null, clears instances.
 */
export function renderActivePiece({
  piece,
  instanced,
  mapper,
  offsetY = 0,
}: RenderActivePieceParams): void {
  if (!piece) {
    const targetMesh = instanced.mesh;
    targetMesh.count = 0;
    targetMesh.instanceMatrix.needsUpdate = true;
    return;
  }

  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();
  const dimensions = mapper.getDimensions();
  const blocks = getWorldBlocks(piece, dimensions);
  const targetMesh = instanced.mesh;

  let instanceIndex = 0;
  for (const block of blocks) {
    if (block.y < 0 || block.y >= dimensions.height) {
      continue; // outside visible tower; skip to avoid mapper bounds errors
    }
    const worldPos = mapper.cellToWorldPosition(block.x, block.y);
    const shifted = worldPos.clone();
    shifted.y += offsetY;
    matrix.compose(shifted, rotation, scale);
    targetMesh.setMatrixAt(instanceIndex, matrix);
    instanceIndex += 1;
  }

  targetMesh.count = instanceIndex;
  targetMesh.instanceMatrix.needsUpdate = true;
}
