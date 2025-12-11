import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { createBoardRenderConfig } from '../boardConfig';
import { createDefaultHallLayoutConfig, computeHallLayout } from '../hallLayout';
import { computePlatformLayout } from '../platformLayout';
import { createFootprintDecor } from '../footprintDecor';

describe('footprint/platform integration (15.3.6)', () => {
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
  const footprint = createFootprintDecor({ dimensions, board, platformLayout });

  it('keeps footprint above platform top with small epsilon', () => {
    const bbox = new THREE.Box3().setFromObject(footprint);
    const footprintMinY = bbox.min.y;
    const platformTop = platformLayout.baseY + Math.max(
      platformLayout.ringA.height,
      platformLayout.ringB.height,
      platformLayout.ringC.height
    );
    const EPS = 0.002;
    expect(platformTop).toBeLessThanOrEqual(footprintMinY + EPS);
  });
});
