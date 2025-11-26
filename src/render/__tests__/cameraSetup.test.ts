import { describe, expect, it } from 'vitest';
import { computeCameraPlacement, computeTowerHeight } from '../cameraSetup';
import { createBoardRenderConfig } from '../boardConfig';

describe('cameraSetup', () => {
  const dimensions = { width: 6, height: 10 };

  it('computes tower height from dimensions and spacing', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 2, verticalSpacing: 3 });
    expect(computeTowerHeight(dimensions, config)).toBe((dimensions.height - 1) * 3 + 2);
  });

  it('places camera outside tower radius and looks at center', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 2 });
    const placement = computeCameraPlacement(dimensions, config);

    const distanceXZ = Math.hypot(placement.position.x, placement.position.z);
    expect(distanceXZ).toBeGreaterThan(config.towerRadius);
    expect(placement.target.x).toBeCloseTo(0);
    expect(placement.target.z).toBeCloseTo(0);
    const towerHeight = (dimensions.height - 1) * config.verticalSpacing + config.blockSize;
    expect(placement.target.y).toBeCloseTo(towerHeight * 0.5);

    // Camera distance should be enough to cover half height with margin at current fov
    const margin = config.blockSize * 2;
    const halfHeightWithMargin = towerHeight / 2 + margin;
    const fovRad = (45 * Math.PI) / 180;
    const minDistance = halfHeightWithMargin / Math.tan(fovRad / 2);
    const actualDistance = placement.position.length();
    expect(actualDistance).toBeGreaterThan(minDistance * 0.9);
  });
});
