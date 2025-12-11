import { describe, expect, it } from 'vitest';
import { createDefaultPlatformDesign } from '../platformDesign';
import { createDefaultHallLayoutConfig, computeHallLayout } from '../hallLayout';
import { createBoardRenderConfig } from '../boardConfig';
import { computePlatformLayout } from '../platformLayout';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { createGoldenPlatformGeometry } from '../goldenPlatformGeometry';

describe('goldenPlatformGeometry (15.2.5)', () => {
  const dimensions = DEFAULT_BOARD_DIMENSIONS;
  const board = createBoardRenderConfig(dimensions);
  const hallLayout = computeHallLayout(
    {
      towerOuterRadius: board.towerRadius + board.blockDepth * 0.5,
      cameraOrbitRadius: (board.towerRadius + board.blockDepth * 0.5) * 2,
    },
    createDefaultHallLayoutConfig(board.blockSize)
  );
  const layout = computePlatformLayout(hallLayout, board, createDefaultPlatformDesign(board.blockSize));

  it('builds geometry with valid attributes and finite values', () => {
    const geometry = createGoldenPlatformGeometry(layout, { segments: 8 });
    const positions = geometry.getAttribute('position');
    expect(positions.count).toBeGreaterThan(0);
    const normals = geometry.getAttribute('normal');
    const uvs = geometry.getAttribute('uv');
    const hasNaN =
      Array.from(positions.array as ArrayLike<number>).some((v) => Number.isNaN(v)) ||
      Array.from(normals.array as ArrayLike<number>).some((v) => Number.isNaN(v)) ||
      Array.from(uvs.array as ArrayLike<number>).some((v) => Number.isNaN(v));
    expect(hasNaN).toBe(false);
    geometry.dispose();
  });

  it('creates bounding box that covers ringC radius and platform height span', () => {
    const geometry = createGoldenPlatformGeometry(layout, { segments: 8 });
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    expect(bbox).toBeTruthy();
    const maxRingTop =
      layout.baseY + Math.max(layout.ringA.height, layout.ringB.height, layout.ringC.height);
    const EPS = 1e-4;
    expect(bbox?.min.x ?? 0).toBeCloseTo(-layout.ringC.outer, 3);
    expect(bbox?.max.x ?? 0).toBeCloseTo(layout.ringC.outer, 3);
    expect(bbox?.min.y ?? 0).toBeLessThanOrEqual(layout.baseY + EPS);
    expect(bbox?.max.y ?? 0).toBeGreaterThanOrEqual(maxRingTop - EPS);
    geometry.dispose();
  });
});
