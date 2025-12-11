/**
 * Describes the conceptual platform structure for 15.2.x:
 * - Ring A: central pedestal under the tower.
 * - Ring B: inset ring with bevel and radial segmentation.
 * - Ring C: main parquet area up to platformOuterRadius.
 *
 * This module only encodes design-time defaults and ratios; actual layout
 * computation happens in platform layout/geometry steps (15.2.2+).
 */
export type PlatformRingId = 'ringA' | 'ringB' | 'ringC';

export interface PlatformRingHeightSpec {
  /** Absolute height of the ring (world units). */
  height: number;
  /**
   * Optional bevel height to create a sloped transition toward the next ring.
   * Geometry builders can use this to add an angled skirt instead of a hard step.
   */
  bevelHeight?: number;
}

export interface PlatformDesignSpec {
  /** Clearance from tower outer radius to start of ring A. */
  marginBaseInner: number;
  /** Extra spacing between tower and decorative footprint band (ring B). */
  marginFootprint: number;
  /** Extra spacing before the outer parquet begins (ring C). */
  marginOuterParquet: number;
  /** Baseline heights for the three rings. */
  heights: {
    core: number;
    ringA: PlatformRingHeightSpec;
    ringB: PlatformRingHeightSpec;
    ringC: PlatformRingHeightSpec;
  };
}

/**
 * Generates default design ratios based on block size (cellSize).
 * These values are intentionally small to leave visual tuning for later steps.
 */
export function createDefaultPlatformDesign(blockSize: number): PlatformDesignSpec {
  const coreHeight = blockSize * 0.6;
  return {
    marginBaseInner: blockSize * 0.2,
    marginFootprint: blockSize * 0.3,
    marginOuterParquet: blockSize * 0.5,
    heights: {
      core: coreHeight,
      ringA: {
        height: coreHeight + blockSize * 0.1,
        bevelHeight: blockSize * 0.04,
      },
      ringB: {
        height: coreHeight + blockSize * 0.05,
        bevelHeight: blockSize * 0.03,
      },
      ringC: {
        height: coreHeight,
        bevelHeight: blockSize * 0.02,
      },
    },
  };
}
