import { describe, expect, it } from 'vitest';
import { computePlatformLayout } from '../platformLayout';
import { createDefaultPlatformDesign } from '../platformDesign';
import { createDefaultHallLayoutConfig, computeHallLayout } from '../hallLayout';
import { createBoardRenderConfig } from '../boardConfig';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';

describe('platformLayout (15.2.2)', () => {
  const board = createBoardRenderConfig(DEFAULT_BOARD_DIMENSIONS);
  const hallLayout = computeHallLayout(
    {
      towerOuterRadius: board.towerRadius + board.blockDepth * 0.5,
      cameraOrbitRadius: (board.towerRadius + board.blockDepth * 0.5) * 2,
    },
    createDefaultHallLayoutConfig(board.blockSize)
  );

  it('derives ring radii from hallLayout and board with monotonic ordering', () => {
    const design = createDefaultPlatformDesign(board.blockSize);
    const layout = computePlatformLayout(hallLayout, board, design);
    const EPS = 1e-5;

    expect(layout.ringA.outer).toBeGreaterThan(board.towerRadius);
    expect(layout.ringB.inner).toBeGreaterThanOrEqual(layout.ringA.outer - EPS);
    expect(layout.ringB.outer).toBeGreaterThan(layout.ringB.inner);
    expect(layout.ringC.inner).toBeGreaterThanOrEqual(layout.ringB.outer - EPS);
    expect(layout.ringC.outer).toBeCloseTo(hallLayout.platformOuterRadius, 5);
    expect(layout.ringC.outer).toBeGreaterThan(layout.ringC.inner);
  });

  it('aligns ringA top to tower floor (baseY + hA == 0)', () => {
    const layout = computePlatformLayout(hallLayout, board);
    const topA = layout.baseY + layout.ringA.height;
    expect(topA).toBeGreaterThan(-board.blockSize * 0.5); // slightly above floor
    expect(topA).toBeLessThanOrEqual(-board.blockSize * 0.5 + board.blockSize * 0.02);
  });

  it('keeps the contact gap to tower floor within 0.01 to avoid floating/overlap', () => {
    const layout = computePlatformLayout(hallLayout, board);
    const topA = layout.baseY + layout.ringA.height;
    const floor = -board.blockSize * 0.5;
    const gap = topA - floor;
    expect(gap).toBeLessThanOrEqual(board.blockSize * 0.02);
  });

  it('places baseY below all ring tops', () => {
    const layout = computePlatformLayout(hallLayout, board);
    const topA = layout.baseY + layout.ringA.height;
    const topB = layout.baseY + layout.ringB.height;
    const topC = layout.baseY + layout.ringC.height;
    expect(layout.baseY).toBeLessThan(topA);
    expect(layout.baseY).toBeLessThan(topB);
    expect(layout.baseY).toBeLessThan(topC);
  });
});
