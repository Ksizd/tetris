import { BoardDimensions } from '../core/types';

export interface BoardRenderConfig {
  blockSize: number;
  blockDepth: number;
  towerRadius: number;
  verticalSpacing: number;
  circumferentialGap: number;
  edgeRadius: number;
}

export const DEFAULT_BLOCK_SIZE = 1;
export const DEFAULT_VERTICAL_SPACING = DEFAULT_BLOCK_SIZE;
export const DEFAULT_BLOCK_DEPTH_RATIO = 0.9;
export const DEFAULT_CIRCUMFERENTIAL_GAP_RATIO = 0.03;
export const DEFAULT_EDGE_RADIUS_RATIO = 0.08;

export function calculateTowerRadius(
  boardWidth: number,
  blockSize: number,
  gap: number = 0
): number {
  if (boardWidth <= 0) {
    throw new Error('Board width must be positive to calculate tower radius');
  }
  if (blockSize <= 0) {
    throw new Error('blockSize must be positive to calculate tower radius');
  }
  if (gap < 0) {
    throw new Error('gap must be non-negative to calculate tower radius');
  }
  const step = blockSize + gap;
  return (boardWidth * step) / (2 * Math.PI);
}

/**
 * Builds a normalized render config with defaults and validation for block size, radius and spacing.
 * verticalSpacing defaults to blockSize as per plan 7.1.2.
 */
export function createBoardRenderConfig(
  dimensions: BoardDimensions,
  overrides?: Partial<BoardRenderConfig>
): BoardRenderConfig {
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error('Board dimensions must be positive to build render config');
  }

  const blockSize = overrides?.blockSize ?? DEFAULT_BLOCK_SIZE;
  if (blockSize <= 0) {
    throw new Error('blockSize must be positive');
  }

  const blockDepth = overrides?.blockDepth ?? blockSize * DEFAULT_BLOCK_DEPTH_RATIO;
  if (blockDepth <= 0) {
    throw new Error('blockDepth must be positive');
  }

  const verticalSpacing = overrides?.verticalSpacing ?? blockSize;
  if (verticalSpacing <= 0) {
    throw new Error('verticalSpacing must be positive');
  }

  const circumferentialGap =
    overrides?.circumferentialGap ?? blockSize * DEFAULT_CIRCUMFERENTIAL_GAP_RATIO;
  if (circumferentialGap < 0) {
    throw new Error('circumferentialGap must be non-negative');
  }

  const maxEdgeRadius = Math.min(blockSize, blockDepth) * 0.5 - 1e-4;
  const edgeRadius =
    overrides?.edgeRadius ?? Math.min(blockSize * DEFAULT_EDGE_RADIUS_RATIO, maxEdgeRadius);
  if (edgeRadius < 0) {
    throw new Error('edgeRadius must be non-negative');
  }

  const towerRadius =
    overrides?.towerRadius ??
    calculateTowerRadius(dimensions.width, blockSize, circumferentialGap);
  if (towerRadius <= 0) {
    throw new Error('towerRadius must be positive');
  }
  return {
    blockSize,
    blockDepth,
    towerRadius,
    verticalSpacing,
    circumferentialGap,
    edgeRadius: Math.min(edgeRadius, maxEdgeRadius),
  };
}
