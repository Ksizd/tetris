import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Board } from '../../core/board';
import { CellContent } from '../../core/types';
import { createBoardRenderConfig } from '../boardConfig';
import { BoardToWorldMapper } from '../boardToWorldMapper';
import { createBoardInstancedMesh } from '../boardInstancedMesh';
import { renderBoard } from '../boardRenderer';
import { createDefaultHallLayoutConfig, computeHallLayout } from '../hallLayout';
import { computePlatformLayout } from '../platformLayout';

function computeInstancedBoundingBox(mesh: THREE.InstancedMesh): THREE.Box3 {
  const baseBox =
    mesh.geometry.boundingBox ?? (() => (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox))();
  const result = new THREE.Box3();
  const tempBox = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  if (!baseBox) {
    throw new Error('Instanced mesh geometry missing bounding box');
  }
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, matrix);
    tempBox.copy(baseBox).applyMatrix4(matrix);
    result.union(tempBox);
  }
  return result;
}

describe('golden platform integration with tower (15.2.5)', () => {
  it('keeps the bottom row of cubes above ringA top (no sinking below platform)', () => {
    const dimensions = { width: 4, height: 2 };
    const boardConfig = createBoardRenderConfig(dimensions);
    const hallLayout = computeHallLayout(
      {
        towerOuterRadius: boardConfig.towerRadius + boardConfig.blockDepth * 0.5,
        cameraOrbitRadius: (boardConfig.towerRadius + boardConfig.blockDepth * 0.5) * 2,
      },
      createDefaultHallLayoutConfig(boardConfig.blockSize)
    );
    const layout = computePlatformLayout(hallLayout, boardConfig);
    const board = Board.createEmpty(dimensions);
    for (let x = 0; x < dimensions.width; x += 1) {
      board.setCell({ x, y: 0 }, CellContent.Block);
    }
    const mapper = new BoardToWorldMapper(dimensions, boardConfig);
    const instanced = createBoardInstancedMesh(dimensions, boardConfig);
    renderBoard({ board, instanced, mapper });

    const bbox = computeInstancedBoundingBox(instanced.mesh);
    const ringATop = layout.baseY + layout.ringA.height;
    const EPS = 1e-3;
    expect(bbox.min.y).toBeGreaterThanOrEqual(ringATop - EPS);
  });
});
