import { describe, expect, it } from 'vitest';
import { getColumnAngle } from '../../core/coords';
import {
  computeFootprintAngleOffsetRad,
  computeFootprintBoundaryAngleRad,
  computeFootprintStepRad,
} from '../footprintAngles';

describe('footprint angle alignment (footprint_fix 1.6)', () => {
  it('defines cell 0 span so its center matches mapper column 0', () => {
    const width = 16;
    const step = computeFootprintStepRad(width);
    const offset = computeFootprintAngleOffsetRad(width);

    const cell0Start = computeFootprintBoundaryAngleRad(0, width, offset);
    const cell0End = computeFootprintBoundaryAngleRad(1, width, offset);
    const cell0Center = cell0Start + step * 0.5;

    expect(cell0Start).toBeCloseTo(0 + offset, 10);
    expect(cell0End).toBeCloseTo(step + offset, 10);
    expect(cell0Center).toBeCloseTo(step * 0.5 + offset, 10);
    expect(cell0Center).toBeCloseTo(getColumnAngle(0, width), 10);
  });

  it('keeps same contract for higher widths', () => {
    const width = 32;
    const step = computeFootprintStepRad(width);
    const offset = computeFootprintAngleOffsetRad(width);

    const cell0Start = computeFootprintBoundaryAngleRad(0, width, offset);
    const cell0Center = cell0Start + step * 0.5;

    expect(cell0Start).toBeCloseTo(offset, 10);
    expect(cell0Center).toBeCloseTo(getColumnAngle(0, width), 10);
  });
});

