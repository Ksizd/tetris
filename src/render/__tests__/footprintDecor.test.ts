import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { createBoardRenderConfig } from '../boardConfig';
import { createDefaultHallLayoutConfig, computeHallLayout } from '../hallLayout';
import { computePlatformLayout } from '../platformLayout';
import { createFootprintDecor } from '../footprintDecor';
import { getFootprintRadius } from '../towerFootprint';

describe('createFootprintDecor (15.3.2)', () => {
  const dimensions = { ...DEFAULT_BOARD_DIMENSIONS, width: 6, height: 2 };
  const board = createBoardRenderConfig(dimensions);
  const hallLayout = computeHallLayout(
    {
      towerOuterRadius: board.towerRadius + board.blockDepth * 0.5,
      cameraOrbitRadius: (board.towerRadius + board.blockDepth * 0.5) * 2,
    },
    createDefaultHallLayoutConfig(board.blockSize)
  );
  const platformLayout = computePlatformLayout(hallLayout, board);

  it('places engraving and sectors just above Ring B and within ringB radius', () => {
    const footprint = createFootprintDecor({ dimensions, board, platformLayout });
    const ring = footprint.getObjectByName('footprintRingEngraving') as
      | THREE.Mesh<THREE.RingGeometry>
      | null;
    const sectors = footprint.getObjectByName('footprintCellSectors') as
      | THREE.Mesh<THREE.BufferGeometry>
      | null;
    expect(ring).toBeTruthy();
    expect(sectors).toBeTruthy();

    const ringTop = ring!.position.y;
    const ringBTop = platformLayout.baseY + platformLayout.ringB.height;
    expect(ringTop).toBeGreaterThan(ringBTop);

    const ringOuter = (ring!.geometry as THREE.RingGeometry).parameters.outerRadius;
    expect(ringOuter).toBeLessThanOrEqual(platformLayout.ringB.outer + 1e-4);

    sectors!.geometry.computeBoundingSphere();
    const bs = sectors!.geometry.boundingSphere;
    expect(bs).toBeTruthy();
    expect(bs?.radius).toBeLessThanOrEqual(platformLayout.ringB.outer + 1e-3);
  });

  it('matches footprint radius design window', () => {
    const footprintRadius = getFootprintRadius(board);
    const footprint = createFootprintDecor({ dimensions, board, platformLayout });
    const ring = footprint.getObjectByName('footprintRingEngraving') as
      | THREE.Mesh<THREE.RingGeometry>
      | null;
    expect(ring).toBeTruthy();
    const { innerRadius, outerRadius } = (ring!.geometry as THREE.RingGeometry).parameters;
    expect(innerRadius).toBeLessThanOrEqual(footprintRadius);
    expect(outerRadius).toBeGreaterThanOrEqual(footprintRadius);
  });
});
