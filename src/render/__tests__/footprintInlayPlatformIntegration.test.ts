import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { createBoardRenderConfig } from '../boardConfig';
import { computeHallLayout, createDefaultHallLayoutConfig } from '../hallLayout';
import { computePlatformLayout } from '../platformLayout';
import { createGoldenPlatformGeometry } from '../goldenPlatformGeometry';

describe('footprint inlay platform integration (15.3Ω)', () => {
  const dimensions = { ...DEFAULT_BOARD_DIMENSIONS, width: 12, height: 4 };
  const board = createBoardRenderConfig(dimensions);
  const hallLayout = computeHallLayout(
    {
      towerOuterRadius: board.towerRadius + board.blockDepth * 0.5,
      cameraOrbitRadius: (board.towerRadius + board.blockDepth * 0.5) * 2,
    },
    createDefaultHallLayoutConfig(board.blockSize)
  );
  const platformLayout = computePlatformLayout(hallLayout, board);

  it('keeps lava geometry inside ringA and below ringB', () => {
    const geometry = createGoldenPlatformGeometry(platformLayout, {
      segments: dimensions.width,
      ringADetailBand: {
        inner: board.towerRadius - board.blockDepth * 0.5,
        outer: board.towerRadius + board.blockDepth * 0.5,
      },
      footprintCarve: {
        towerRadius: board.towerRadius,
        blockDepth: board.blockDepth,
        blockSize: board.blockSize,
        columns: dimensions.width,
      },
    });

    const lavaGroup = geometry.groups.find((g) => g.materialIndex === 2);
    expect(lavaGroup).toBeTruthy();

    const index = geometry.getIndex()!;
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;

    let maxR = 0;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = lavaGroup!.start; i < lavaGroup!.start + lavaGroup!.count; i += 1) {
      const vi = index.getX(i);
      const x = pos.getX(vi);
      const y = pos.getY(vi);
      const z = pos.getZ(vi);
      maxR = Math.max(maxR, Math.hypot(x, z));
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    expect(maxR).toBeLessThanOrEqual(platformLayout.ringA.outer + 1e-3);
    expect(maxR).toBeLessThan(platformLayout.ringB.outer - 1e-3);

    const ringATopY = platformLayout.baseY + platformLayout.ringA.height;
    expect(maxY).toBeLessThanOrEqual(ringATopY + 1e-3);
    expect(minY).toBeLessThan(ringATopY - 1e-4);

    geometry.dispose();
  });
});

