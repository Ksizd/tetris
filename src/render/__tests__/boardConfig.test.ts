import { describe, expect, it } from 'vitest';
import {
  createBoardRenderConfig,
  calculateTowerRadius,
  DEFAULT_BLOCK_SIZE,
  DEFAULT_VERTICAL_SPACING,
} from '../boardConfig';

describe('boardConfig', () => {
  const dimensions = { width: 6, height: 10 };

  it('builds defaults with vertical spacing equal to block size', () => {
    const config = createBoardRenderConfig(dimensions);

    expect(config.blockSize).toBe(DEFAULT_BLOCK_SIZE);
    expect(config.verticalSpacing).toBe(DEFAULT_VERTICAL_SPACING);
    expect(config.towerRadius).toBeCloseTo(
      calculateTowerRadius(dimensions.width, DEFAULT_BLOCK_SIZE)
    );
  });

  it('applies overrides for spacing and tower radius', () => {
    const blockSize = 2;
    const verticalSpacing = 3;
    const towerRadius = 42;
    const config = createBoardRenderConfig(dimensions, {
      blockSize,
      verticalSpacing,
      towerRadius,
    });

    expect(config.blockSize).toBe(blockSize);
    expect(config.verticalSpacing).toBe(verticalSpacing);
    expect(config.towerRadius).toBe(towerRadius);
  });

  it('validates positive values', () => {
    expect(() => createBoardRenderConfig(dimensions, { blockSize: 0 })).toThrow();
    expect(() => createBoardRenderConfig(dimensions, { verticalSpacing: -1 })).toThrow();
    expect(() => createBoardRenderConfig(dimensions, { towerRadius: 0 })).toThrow();
  });
});
