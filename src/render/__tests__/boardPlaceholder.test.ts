import { describe, expect, it } from 'vitest';
import { createBoardPlaceholder } from '../boardPlaceholder';
import { createBoardRenderConfig } from '../boardConfig';

describe('createBoardPlaceholder', () => {
  const dimensions = { width: 6, height: 4 };

  it('creates rails per column and a base ring', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 2 });
    const { group, rails, baseRing } = createBoardPlaceholder(dimensions, config);
    const expectedHeight = (dimensions.height - 1) * config.verticalSpacing + config.blockSize;
    const expectedRingY = config.blockSize * 0.25;

    expect(rails).toHaveLength(dimensions.width);
    rails.forEach((rail) => {
      expect(group.children).toContain(rail);
      expect(rail.position.y).toBeCloseTo(expectedHeight / 2);
    });

    expect(group.children).toContain(baseRing);
    expect(baseRing.position.y).toBeCloseTo(expectedRingY);
  });
});
