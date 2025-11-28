import { describe, expect, it } from 'vitest';
import {
  createBoardRenderConfig,
  DEFAULT_BLOCK_SIZE,
  DEFAULT_CIRCUMFERENTIAL_GAP_RATIO,
  DEFAULT_VERTICAL_GAP_RATIO,
} from '../boardConfig';

describe('createBoardRenderConfig', () => {
  const dimensions = { width: 6, height: 4 };

  it('applies default vertical gap and circumferential gap ratios', () => {
    const config = createBoardRenderConfig(dimensions);

    expect(config.verticalGap).toBeCloseTo(DEFAULT_BLOCK_SIZE * DEFAULT_VERTICAL_GAP_RATIO);
    expect(config.verticalSpacing).toBeCloseTo(DEFAULT_BLOCK_SIZE + config.verticalGap);
    expect(config.circumferentialGap).toBeCloseTo(
      DEFAULT_BLOCK_SIZE * DEFAULT_CIRCUMFERENTIAL_GAP_RATIO
    );
  });

  it('honors verticalGap override and derives spacing accordingly when no spacing override', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 2, verticalGap: 0.2 });

    expect(config.verticalGap).toBeCloseTo(0.2);
    expect(config.verticalSpacing).toBeCloseTo(2.2);
  });

  it('derives verticalGap from spacing override when provided', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 1.5, verticalSpacing: 1.8 });

    expect(config.verticalGap).toBeCloseTo(0.3);
    expect(config.verticalSpacing).toBeCloseTo(1.8);
  });
});
