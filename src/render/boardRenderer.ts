import * as THREE from 'three';
import { Board } from '../core/board';
import { CellContent } from '../core/types';
import { BoardToWorldMapper } from './boardToWorldMapper';
import { BoardInstancedResources } from './boardInstancedMesh';

export interface RenderBoardParams {
  board: Board;
  instanced: BoardInstancedResources;
  mapper: BoardToWorldMapper;
}

/**
 * Updates instanced mesh transforms to reflect current board state.
 */
export function renderBoard({ board, instanced, mapper }: RenderBoardParams): void {
  const dimensions = board.getDimensions();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const rotation = new THREE.Quaternion();
  const targetMesh = instanced.mesh;

  let instanceIndex = 0;
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      if (board.getCell({ x, y }) !== CellContent.Block) {
        continue;
      }
      position.copy(mapper.cellToWorldPosition(x, y));
      mapper.getRadialOrientation(x, rotation);
      matrix.compose(position, rotation, scale);
      targetMesh.setMatrixAt(instanceIndex, matrix);
      instanceIndex += 1;
    }
  }

  targetMesh.count = instanceIndex;
  targetMesh.instanceMatrix.needsUpdate = true;
}
