import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { getTowerBounds } from '../towerBounds';
import { computeHallLayout, createDefaultHallLayoutConfig } from '../hallLayout';
import { createBoardRenderConfig } from '../boardConfig';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { computeGameCameraPose } from '../cameraSetup';

describe('camera + hall layout integration (15.1.7)', () => {
  it('keeps hall outside real camera orbit and tower', () => {
    const board = createBoardRenderConfig(DEFAULT_BOARD_DIMENSIONS);
    const bounds = getTowerBounds(DEFAULT_BOARD_DIMENSIONS, board);
    const pose = computeGameCameraPose(bounds, 16 / 9, { fovDeg: 36 });

    const towerOuterRadius = board.towerRadius + board.blockDepth * 0.5;
    const delta = new THREE.Vector2(
      pose.position.x - bounds.center.x,
      pose.position.z - bounds.center.z
    );
    const cameraOrbitRadius = delta.length();

    const cfg = createDefaultHallLayoutConfig(board.blockSize);
    const layout = computeHallLayout(
      { towerOuterRadius, cameraOrbitRadius },
      cfg
    );

    const eps = 1e-6;
    expect(layout.hallInnerRadius).toBeGreaterThan(cameraOrbitRadius + cfg.cameraInnerMargin - eps);
    expect(layout.hallInnerRadius).toBeGreaterThan(towerOuterRadius + cfg.towerInnerMargin - eps);
    expect(layout.platformOuterRadius).toBeGreaterThanOrEqual(towerOuterRadius + 0.01 - eps);
  });
});
