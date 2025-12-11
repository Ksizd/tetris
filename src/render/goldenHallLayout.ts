import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';
import { computeTowerHeight } from './cameraSetup';
import { GoldenHallConfig } from './renderConfig';
import { HallLayoutRadii } from './hallLayout';

export interface GoldenHallFootprint {
  towerRadius: number;
  outerRadius: number;
  innerRadius: number;
  height: number;
  blockSize: number;
  columnCount: number;
}

export interface GoldenHallBaseLayout {
  outerRadius: number;
  height: number;
  stepCount: number;
  stepInsetRatio: number;
  topY: number;
  bottomY: number;
}

export interface GoldenHallLayout {
  footprint: GoldenHallFootprint;
  base: GoldenHallBaseLayout;
  hallRadius: number;
  wallHeight: number;
  wallCurvatureSegments: number;
}

/**
 * Derives Golden Hall footprint and base layout strictly from tower bounds/config,
 * without moving or scaling the tower itself.
 */
export function computeGoldenHallLayout(
  dimensions: BoardDimensions,
  board: BoardRenderConfig,
  goldenHall: GoldenHallConfig,
  hallLayoutOverride?: HallLayoutRadii
): GoldenHallLayout {
  const towerRadius = board.towerRadius;
  const towerOuterRadius = towerRadius + board.blockDepth * 0.5;
  const towerInnerRadius = Math.max(0, towerRadius - board.blockDepth * 0.5);
  const towerHeight = computeTowerHeight(dimensions, board);
  const blockSize = board.blockSize;
  const columnCount = dimensions.width;

  const baseHeight = Math.max(0, goldenHall.baseHeight);
  const baseOuterRadiusRaw = Math.max(towerOuterRadius, towerRadius + goldenHall.baseRadiusMargin);
  const hallRadiusRaw = Math.max(baseOuterRadiusRaw, towerRadius + goldenHall.hallRadiusMargin);

  const baseOuterRadius = hallLayoutOverride
    ? Math.max(towerOuterRadius, hallLayoutOverride.platformOuterRadius)
    : baseOuterRadiusRaw;
  const hallRadius = hallLayoutOverride
    ? Math.max(baseOuterRadius, hallLayoutOverride.hallOuterRadius)
    : hallRadiusRaw;

  return {
    footprint: {
      towerRadius,
      outerRadius: towerOuterRadius,
      innerRadius: towerInnerRadius,
      height: towerHeight,
      blockSize,
      columnCount,
    },
    base: {
      outerRadius: baseOuterRadius,
      height: baseHeight,
      stepCount: goldenHall.baseStepCount,
      stepInsetRatio: goldenHall.baseStepInsetRatio,
      topY: 0,
      bottomY: -baseHeight,
    },
    hallRadius,
    wallHeight: Math.max(0, goldenHall.wallHeight),
    wallCurvatureSegments: Math.max(4, Math.round(goldenHall.wallCurvatureSegments)),
  };
}
