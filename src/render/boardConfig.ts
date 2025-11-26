import { BoardDimensions } from '../core/types';

export interface BoardRenderConfig {
  blockSize: number;
  towerRadius: number;
  verticalSpacing: number;
}

export const DEFAULT_BLOCK_SIZE = 1;
export const DEFAULT_VERTICAL_SPACING = DEFAULT_BLOCK_SIZE;

export function calculateTowerRadius(boardWidth: number, blockSize: number): number {
  if (boardWidth <= 0) {
    throw new Error('Board width must be positive to calculate tower radius');
  }
  if (blockSize <= 0) {
    throw new Error('blockSize must be positive to calculate tower radius');
  }
  return (boardWidth * blockSize) / (2 * Math.PI);
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

  const verticalSpacing = overrides?.verticalSpacing ?? blockSize;
  if (verticalSpacing <= 0) {
    throw new Error('verticalSpacing must be positive');
  }

  const towerRadius = overrides?.towerRadius ?? calculateTowerRadius(dimensions.width, blockSize);
  if (towerRadius <= 0) {
    throw new Error('towerRadius must be positive');
  }
  return {
    blockSize,
    towerRadius,
    verticalSpacing,
  };
}
