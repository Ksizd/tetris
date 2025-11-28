import { describe, expect, it } from 'vitest';
import { createBoardRenderConfig } from '../boardConfig';
import { evaluateBoardSpacing } from '../boardSpacingDiagnostics';

describe('evaluateBoardSpacing', () => {
  it('ensures vertical, circumferential, and radial clearances are positive', () => {
    const dimensions = { width: 12, height: 10 };
    const config = createBoardRenderConfig(dimensions, {
      blockSize: 1,
      circumferentialGap: 0.05,
      verticalGap: 0.08,
      blockDepth: 0.9,
    });

    const result = evaluateBoardSpacing(dimensions, config);

    expect(result.verticalClear).toBe(true);
    expect(result.circumferentialClear).toBe(true);
    expect(result.radialClear).toBe(true);
    expect(result.verticalGap).toBeCloseTo(0.08);
    expect(result.tangentialClearance).toBeGreaterThan(0);
    expect(result.radialClearance).toBeGreaterThan(0);
  });

  it('fails circumferential check if radius is too small for requested gap', () => {
    const dimensions = { width: 8, height: 6 };
    const config = createBoardRenderConfig(dimensions, { blockSize: 1, towerRadius: 0.3 });

    const result = evaluateBoardSpacing(dimensions, config);
    expect(result.circumferentialClear).toBe(false);
  });
});
