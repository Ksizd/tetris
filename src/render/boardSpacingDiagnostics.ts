import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';

export interface SpacingDiagnostics {
  verticalGap: number;
  tangentialClearance: number;
  radialClearance: number;
  verticalClear: boolean;
  circumferentialClear: boolean;
  radialClear: boolean;
}

/**
 * Computes simple spacing diagnostics to ensure cubes do not intersect and keep visible seams.
 * - tangentialClearance: chord distance between adjacent columns minus blockSize (>= circumferentialGap).
 * - verticalGap: spacing minus blockSize.
 * - radialClearance: inner empty space from tower center to inner cube face.
 */
export function evaluateBoardSpacing(
  dimensions: BoardDimensions,
  config: BoardRenderConfig
): SpacingDiagnostics {
  const angle = (2 * Math.PI) / dimensions.width;
  const chord = 2 * config.towerRadius * Math.sin(angle / 2);
  const tangentialClearance = chord - config.blockSize;

  const verticalGap = Math.max(0, config.verticalSpacing - config.blockSize);
  const radialClearance = config.towerRadius - config.blockDepth * 0.5;

  return {
    verticalGap,
    tangentialClearance,
    radialClearance,
    verticalClear: verticalGap > 0,
    circumferentialClear: tangentialClearance > 0,
    radialClear: radialClearance > 0,
  };
}
