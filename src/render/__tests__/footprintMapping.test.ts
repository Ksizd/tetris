import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { createBoardRenderConfig } from '../boardConfig';
import { BoardToWorldMapper } from '../boardToWorldMapper';
import { createDefaultHallLayoutConfig, computeHallLayout } from '../hallLayout';
import { computePlatformLayout } from '../platformLayout';
import { createFootprintDecor } from '../footprintDecor';
import { getFootprintRadius } from '../towerFootprint';

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

  it('cell centers on row 0 fall within their footprint sectors', () => {
    createFootprintDecor({ dimensions, board, platformLayout });
    const footprintRadius = getFootprintRadius(board);
    const innerRadius = Math.max(0, footprintRadius - board.blockSize * 0.5);
    const outerRadius = footprintRadius + board.blockSize * 0.5;
    const step = (Math.PI * 2) / dimensions.width;
    for (let col = 0; col < dimensions.width; col += 1) {
      const cellPos = mapper.cellToWorldPosition(col, 0);
      const radius = Math.hypot(cellPos.x, cellPos.z);
      expect(radius).toBeGreaterThanOrEqual(innerRadius - 1e-3);
      expect(radius).toBeLessThanOrEqual(outerRadius + 1e-3);

      const angle = Math.atan2(cellPos.z, cellPos.x);
      const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
      expect(normalized).toBeCloseTo(step * col, 6);
    }
  });
});
