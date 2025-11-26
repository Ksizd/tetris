import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Board } from '../../core/board';
import { CellContent } from '../../core/types';
import { createBoardRenderConfig } from '../boardConfig';
import { BoardToWorldMapper } from '../boardToWorldMapper';
import { createBoardInstancedMesh } from '../boardInstancedMesh';
import { renderBoard } from '../boardRenderer';

describe('renderBoard', () => {
  const dimensions = { width: 3, height: 3 };

  it('writes instance matrices for occupied cells and updates count', () => {
    const board = Board.createEmpty(dimensions);
    board.setCell({ x: 0, y: 0 }, CellContent.Block);
    board.setCell({ x: 2, y: 1 }, CellContent.Block);

    const config = createBoardRenderConfig(dimensions, { blockSize: 2 });
    const mapper = new BoardToWorldMapper(dimensions, config);
    const instanced = createBoardInstancedMesh(dimensions, config);

    renderBoard({ board, instanced, mapper });

    expect(instanced.mesh.count).toBe(2);
    const m0 = new THREE.Matrix4();
    instanced.mesh.getMatrixAt(0, m0);
    const pos0 = new THREE.Vector3().setFromMatrixPosition(m0);
    const expected0 = mapper.cellToWorldPosition(0, 0);
    expect(pos0.distanceTo(expected0)).toBeLessThan(1e-6);

    const m1 = new THREE.Matrix4();
    instanced.mesh.getMatrixAt(1, m1);
    const pos1 = new THREE.Vector3().setFromMatrixPosition(m1);
    const expected1 = mapper.cellToWorldPosition(2, 1);
    expect(pos1.distanceTo(expected1)).toBeLessThan(1e-6);
  });
});
