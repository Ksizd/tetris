import { BoardRenderConfig } from './boardConfig';
import { HallLayoutRadii } from './hallLayout';
import { PlatformDesignSpec, createDefaultPlatformDesign } from './platformDesign';
import { getFootprintRadius } from './towerFootprint';

export interface PlatformRingLayout {
  inner: number;
  outer: number;
  height: number;
}

export interface PlatformLayout {
  baseY: number; // y-координата низа платформы
  heightCore: number; // высота видимой толстой части (ringC baseline)
  ringA: PlatformRingLayout;
  ringB: PlatformRingLayout;
  ringC: PlatformRingLayout;
}

const EPS = 1e-4;
const MIN_FOOTPRINT_MARGIN_RATIO = 0.1;

export function computePlatformLayout(
  hallLayout: HallLayoutRadii,
  board: BoardRenderConfig,
  design: PlatformDesignSpec = createDefaultPlatformDesign(board.blockSize)
): PlatformLayout {
  const cellSize = { x: board.blockSize, y: board.blockSize, z: board.blockDepth };
  const footprintOuter = getFootprintRadius(board); // footprint outer ~= tower + bevel
  const minFootprintMargin = Math.max(EPS, board.blockSize * MIN_FOOTPRINT_MARGIN_RATIO);
  const footprintMargin = Math.max(design.marginFootprint, minFootprintMargin);

  const ringAOuter = hallLayout.towerOuterRadius + design.marginBaseInner;
  const ringBOuter = footprintOuter + footprintMargin;
  const ringCOuter = hallLayout.platformOuterRadius;

  const ringA: PlatformRingLayout = {
    inner: 0,
    outer: ringAOuter,
    height: design.heights.ringA.height,
  };
  const ringB: PlatformRingLayout = {
    inner: ringA.outer,
    outer: ringBOuter,
    height: design.heights.ringB.height,
  };
  const ringC: PlatformRingLayout = {
    inner: ringB.outer,
    outer: ringCOuter,
    height: design.heights.ringC.height,
  };

  const cellBottomY = -cellSize.y * 0.5;
  const visibleLift = cellSize.y * 0.005; // lift platform top slightly above cube floor for visibility
  const baseY = cellBottomY + visibleLift - ringA.height;

  // Invariants / safety checks
  if (ringA.outer + EPS < ringB.inner || ringB.outer + EPS < ringC.inner) {
    console.warn('[platformLayout] ring ordering suspect', { ringA, ringB, ringC });
  }
  if (ringC.outer > hallLayout.platformOuterRadius + EPS) {
    console.warn('[platformLayout] ringC outer exceeds platform radius', {
      ringCOuter: ringC.outer,
      platformOuterRadius: hallLayout.platformOuterRadius,
    });
  }

  return {
    baseY,
    heightCore: design.heights.core,
    ringA,
    ringB,
    ringC,
  };
}
