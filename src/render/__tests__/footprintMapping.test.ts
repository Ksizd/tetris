import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { createBoardRenderConfig } from '../boardConfig';
import { BoardToWorldMapper } from '../boardToWorldMapper';
import { createDefaultHallLayoutConfig, computeHallLayout } from '../hallLayout';
import { computePlatformLayout } from '../platformLayout';
import { createFootprintDecor } from '../footprintDecor';

describe('footprint mapping (15.3.6)', () => {
  const dimensions = { ...DEFAULT_BOARD_DIMENSIONS, width: 8, height: 2 };
  const board = createBoardRenderConfig(dimensions);
  const hallLayout = computeHallLayout(
    {
      towerOuterRadius: board.towerRadius + board.blockDepth * 0.5,
      cameraOrbitRadius: (board.towerRadius + board.blockDepth * 0.5) * 2,
    },
    createDefaultHallLayoutConfig(board.blockSize)
  );
  const platformLayout = computePlatformLayout(hallLayout, board);
  const mapper = new BoardToWorldMapper(dimensions, board);

  const footprint = createFootprintDecor({ dimensions, board, platformLayout });
  const sectors = footprint.getObjectByName('footprintCellSectors') as
    | THREE.Mesh<THREE.BufferGeometry>
    | null;
  if (!sectors) {
    throw new Error('footprintCellSectors mesh not found');
  }
  const positions = sectors.geometry.getAttribute('position') as THREE.BufferAttribute;

  function closestDistanceToSector(pos: THREE.Vector3): number {
    let minDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < positions.count; i += 1) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      const v = new THREE.Vector3(vx, vy, vz).applyMatrix4(sectors.matrixWorld);
      const dx = v.x - pos.x;
      const dz = v.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist) {
        minDist = dist;
      }
    }
    return minDist;
  }

  it('cell centers on row 0 align within 0.01 to nearest sector vertex', () => {
    for (let col = 0; col < dimensions.width; col += 1) {
      const cellPos = mapper.cellToWorldPosition(col, 0);
      const dist = closestDistanceToSector(cellPos);
      expect(dist).toBeLessThanOrEqual(0.01);
    }
  });
});
