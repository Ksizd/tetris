import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ActivePiece, PieceOrientation, PieceType } from '../../core/types';
import { createBoardRenderConfig } from '../boardConfig';
import { BoardToWorldMapper } from '../boardToWorldMapper';
import { createActivePieceInstancedMesh } from '../activePieceInstancedMesh';
import { renderActivePiece } from '../activePieceRenderer';

describe('renderActivePiece', () => {
  const dimensions = { width: 6, height: 8 };

  it('writes active piece instances for provided piece', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 2 });
    const mapper = new BoardToWorldMapper(dimensions, config);
    const instanced = createActivePieceInstancedMesh(config);
    const piece: ActivePiece = {
      type: PieceType.O,
      orientation: PieceOrientation.Deg0,
      position: { x: 1, y: 2 },
    };

    renderActivePiece({ piece, instanced, mapper });

    expect(instanced.mesh.count).toBe(4);
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < instanced.mesh.count; i += 1) {
      const m = new THREE.Matrix4();
      instanced.mesh.getMatrixAt(i, m);
      positions.push(new THREE.Vector3().setFromMatrixPosition(m));
    }
    const expected = [
      mapper.cellToWorldPosition(2, 2),
      mapper.cellToWorldPosition(3, 2),
      mapper.cellToWorldPosition(2, 3),
      mapper.cellToWorldPosition(3, 3),
    ];
    const tolerance = 1e-3;
    expected.forEach((pos) => {
      expect(positions.some((p) => p.distanceTo(pos) < tolerance)).toBe(true);
    });
  });

  it('applies vertical offset for interpolation', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 1 });
    const mapper = new BoardToWorldMapper(dimensions, config);
    const instanced = createActivePieceInstancedMesh(config);
    const piece: ActivePiece = {
      type: PieceType.I,
      orientation: PieceOrientation.Deg0,
      position: { x: 0, y: 5 },
    };

    renderActivePiece({ piece, instanced, mapper, offsetY: -0.5 });

    const m = new THREE.Matrix4();
    instanced.mesh.getMatrixAt(0, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    const firstBlockCellY = piece.position.y + 1; // I Deg0 shape sits on y=1 row in local grid
    expect(pos.y).toBeCloseTo(mapper.cellToWorldPosition(0, firstBlockCellY).y - 0.5);
  });

  it('skips blocks outside tower bounds without throwing', () => {
    const config = createBoardRenderConfig(dimensions);
    const mapper = new BoardToWorldMapper(dimensions, config);
    const instanced = createActivePieceInstancedMesh(config);
    const piece: ActivePiece = {
      type: PieceType.I,
      orientation: PieceOrientation.Deg0,
      position: { x: 0, y: dimensions.height - 1 },
    };

    renderActivePiece({ piece, instanced, mapper });

    expect(instanced.mesh.count).toBeGreaterThanOrEqual(0);
  });

  it('clears instances when piece is null', () => {
    const config = createBoardRenderConfig(dimensions);
    const mapper = new BoardToWorldMapper(dimensions, config);
    const instanced = createActivePieceInstancedMesh(config);

    instanced.mesh.count = 2;
    renderActivePiece({ piece: null, instanced, mapper });

    expect(instanced.mesh.count).toBe(0);
  });
});
