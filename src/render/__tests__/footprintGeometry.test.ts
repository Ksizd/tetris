import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { createBoardRenderConfig } from '../boardConfig';
import { createDefaultHallLayoutConfig, computeHallLayout } from '../hallLayout';
import { computePlatformLayout } from '../platformLayout';
import { createFootprintDecor } from '../footprintDecor';
import { getFootprintRadius } from '../towerFootprint';

describe('footprint geometry (15.3.6)', () => {
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

  it('builds decorative footprint with expected bounds and layers', () => {
    const footprint = createFootprintDecor({ dimensions, board, platformLayout });
    const children = footprint.children.filter((c) => (c as THREE.Mesh).isMesh);
    expect(children.length).toBeGreaterThanOrEqual(2);

    const bbox = new THREE.Box3().setFromObject(footprint);
    const bs = bbox.getBoundingSphere(new THREE.Sphere());
    const rFootprint = getFootprintRadius(board);
    expect(bs.radius).toBeGreaterThan(rFootprint * 0.8);
    expect(bs.radius).toBeLessThan(rFootprint * 1.2);
  });
});
