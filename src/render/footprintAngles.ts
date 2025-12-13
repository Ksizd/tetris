import { getColumnAngle } from '../core/coords';

const TWO_PI = Math.PI * 2;

export function computeFootprintStepRad(columns: number): number {
  if (!Number.isFinite(columns) || columns <= 0) {
    throw new Error(`columns must be positive, got ${columns}`);
  }
  return TWO_PI / columns;
}

/**
 * Canonical footprint angular offset.
 *
 * In this project the board column centers are placed at `getColumnAngle(x,width)` (see `BoardToWorldMapper`).
 * Footprint cell spans must start on boundaries, so we shift start by `-step/2`:
 * - cell 0 span: [-step/2 .. +step/2]
 * - cell 0 center: 0, matching mapper column 0.
 */
export function computeFootprintAngleOffsetRad(columns: number): number {
  return -computeFootprintStepRad(columns) * 0.5;
}

export function computeFootprintBoundaryAngleRad(
  boundaryIndex: number,
  columns: number,
  footprintAngleOffsetRad: number
): number {
  return getColumnAngle(boundaryIndex, columns) + footprintAngleOffsetRad;
}

