import * as THREE from 'three';
import { BoardRenderConfig } from './boardConfig';
import { HallLayoutRadii } from './hallLayout';
import { PlatformLayout } from './platformLayout';
import { getFootprintRadius } from './towerFootprint';

export interface HallGeometryDiagnosticsConfig {
  floorEpsilon: number;
  penetrationEpsilon: number;
  footprintMaxOffset: number;
  engravingMaxDepth: number;
  orientationCosTolerance: number;
}

export interface HallGeometryDiagnosticsInput {
  board: BoardRenderConfig;
  hallLayout: HallLayoutRadii;
  platformLayout?: PlatformLayout | null;
  platformObject?: THREE.Object3D | null;
  footprintObject?: THREE.Object3D | null;
}

export interface HallGeometryDiagnosticsResult {
  warnings: string[];
  errors: string[];
  report: {
    floorY: number;
    ringATop?: number;
    footprintMinY?: number;
    footprintMaxY?: number;
    towerOuterRadius: number;
    footprintRadius: number;
    ringAOuterRadius?: number;
    ringBOuterRadius?: number;
    ringCOuterRadius?: number;
    hallInnerRadius: number;
  };
}

const DEFAULT_CONFIG: HallGeometryDiagnosticsConfig = {
  floorEpsilon: 0.01,
  penetrationEpsilon: 0.002,
  footprintMaxOffset: 0.05,
  engravingMaxDepth: 0.2,
  orientationCosTolerance: 0.98,
};

const AXIS_Y = new THREE.Vector3(0, 1, 0);

export function runHallGeometryDiagnostics(
  input: HallGeometryDiagnosticsInput,
  config: Partial<HallGeometryDiagnosticsConfig> = {}
): HallGeometryDiagnosticsResult {
  const cfg: HallGeometryDiagnosticsConfig = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  const errors: string[] = [];

  const platformLayout = input.platformLayout ?? null;
  const footprintRadius = getFootprintRadius(input.board);
  const floorY = -input.board.blockSize * 0.5;
  const ringATop = platformLayout ? platformLayout.baseY + platformLayout.ringA.height : undefined;
  const ringBTop = platformLayout ? platformLayout.baseY + platformLayout.ringB.height : undefined;
  const ringCTop = platformLayout ? platformLayout.baseY + platformLayout.ringC.height : undefined;

  if (ringATop !== undefined) {
    const gap = ringATop - floorY;
    if (Math.abs(gap) > cfg.floorEpsilon) {
      const severityTarget = gap > 0 ? errors : warnings;
      severityTarget.push(
        `[RingA vs floor] |Y_top(RingA) - Y_floor|=${gap.toFixed(4)} exceeds eps=${cfg.floorEpsilon}`
      );
    }
    if (gap > cfg.penetrationEpsilon) {
      errors.push(
        `[RingA penetration] ring A top is ${gap.toFixed(
          4
        )} above cube floor; cubes may sink into platform`
      );
    }
  } else {
    warnings.push('[RingA] platformLayout missing; cannot verify Y alignment');
  }

  // Footprint height envelope
  let footprintMinY: number | undefined;
  let footprintMaxY: number | undefined;
  if (input.footprintObject) {
    const box = new THREE.Box3().setFromObject(input.footprintObject);
    footprintMinY = box.min.y;
    footprintMaxY = box.max.y;
    if (ringATop !== undefined) {
      const depth = ringATop - footprintMinY;
      if (depth > cfg.engravingMaxDepth + cfg.floorEpsilon) {
        errors.push(
          `[Footprint Y] depth=${depth.toFixed(4)} exceeds engravingMaxDepth=${cfg.engravingMaxDepth.toFixed(
            4
          )} (ringA top ${ringATop.toFixed(4)})`
        );
      }
      if (footprintMaxY > ringATop + cfg.footprintMaxOffset + cfg.floorEpsilon) {
        errors.push(
          `[Footprint Y] maxY=${footprintMaxY.toFixed(
            4
          )} exceeds allowed offset ${cfg.footprintMaxOffset.toFixed(4)} above ring A`
        );
      }
    }
  } else {
    warnings.push('[Footprint] footprintObject missing; Y envelope not validated');
  }

  // Radii ordering
  if (platformLayout) {
    const radiiIssues: string[] = [];
    if (!(footprintRadius + 1e-6 >= input.hallLayout.towerOuterRadius)) {
      radiiIssues.push('R_footprintOuter < R_tower violated');
    }
    if (!(footprintRadius < platformLayout.ringB.outer)) {
      radiiIssues.push('R_footprintOuter < R_ringBOuter violated');
    }
    if (
      !(
        platformLayout.ringA.outer < platformLayout.ringB.outer &&
        platformLayout.ringB.outer < platformLayout.ringC.outer &&
        platformLayout.ringC.outer < input.hallLayout.hallInnerRadius
      )
    ) {
      radiiIssues.push('Ring ordering R_A < R_B < R_C < R_hallInner violated');
    }
    if (radiiIssues.length > 0) {
      errors.push(`[Radii] ${radiiIssues.join('; ')}`);
    }
  } else {
    warnings.push('[Radii] platformLayout missing; cannot validate ring ordering');
  }

  // Orientation checks
  if (input.platformObject) {
    const cosUp = worldUpDot(input.platformObject);
    if (cosUp < cfg.orientationCosTolerance) {
      errors.push(
        `[Orientation] platform object up=${cosUp.toFixed(
          4
        )} deviates from +Y (threshold ${cfg.orientationCosTolerance})`
      );
    }
  }
  if (input.footprintObject) {
    const cosUp = worldUpDot(input.footprintObject);
    if (cosUp < cfg.orientationCosTolerance) {
      errors.push(
        `[Orientation] footprint object up=${cosUp.toFixed(
          4
        )} deviates from +Y (threshold ${cfg.orientationCosTolerance})`
      );
    }
  }

  // Collision checks (approximate AABB)
  const platformBox = platformLayout
    ? new THREE.Box3(
        new THREE.Vector3(
          -platformLayout.ringC.outer,
          platformLayout.baseY,
          -platformLayout.ringC.outer
        ),
        new THREE.Vector3(
          platformLayout.ringC.outer,
          Math.max(ringATop ?? platformLayout.baseY, ringBTop ?? platformLayout.baseY, ringCTop ?? platformLayout.baseY),
          platformLayout.ringC.outer
        )
      )
    : null;

  const towerOuter = input.hallLayout.towerOuterRadius;
  const towerBox = new THREE.Box3(
    new THREE.Vector3(-towerOuter, floorY, -towerOuter),
    new THREE.Vector3(towerOuter, floorY + input.board.blockSize, towerOuter)
  );

  const footprintBox =
    input.footprintObject && footprintMinY !== undefined && footprintMaxY !== undefined
      ? new THREE.Box3(
          new THREE.Vector3(-footprintRadius, footprintMinY, -footprintRadius),
          new THREE.Vector3(footprintRadius, footprintMaxY, footprintRadius)
        )
      : null;

  if (platformBox) {
    const penetration = penetrationDepth(platformBox, towerBox);
    if (penetration !== null && penetration > cfg.penetrationEpsilon) {
      errors.push(
        `[Collision] platform vs tower cells penetration=${penetration.toFixed(
          4
        )} (> ${cfg.penetrationEpsilon})`
      );
    }
  }
  if (platformBox && footprintBox) {
    if (!(ringATop !== undefined && footprintMaxY !== undefined && footprintMaxY <= ringATop + cfg.floorEpsilon)) {
      const penetration = penetrationDepth(platformBox, footprintBox);
      if (penetration !== null && penetration > cfg.penetrationEpsilon) {
        warnings.push(
          `[Collision] platform vs footprint overlap penetration=${penetration.toFixed(
            4
          )} (> ${cfg.penetrationEpsilon})`
        );
      }
    }
  }

  return {
    warnings,
    errors,
    report: {
      floorY,
      ringATop,
      footprintMinY,
      footprintMaxY,
      towerOuterRadius: input.hallLayout.towerOuterRadius,
      footprintRadius,
      ringAOuterRadius: platformLayout?.ringA.outer,
      ringBOuterRadius: platformLayout?.ringB.outer,
      ringCOuterRadius: platformLayout?.ringC.outer,
      hallInnerRadius: input.hallLayout.hallInnerRadius,
    },
  };
}

function worldUpDot(object: THREE.Object3D): number {
  const q = new THREE.Quaternion();
  object.getWorldQuaternion(q);
  const up = AXIS_Y.clone().applyQuaternion(q).normalize();
  return up.dot(AXIS_Y);
}

function penetrationDepth(a: THREE.Box3, b: THREE.Box3): number | null {
  const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
  const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
  const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
  if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) {
    return null;
  }
  return Math.min(overlapX, overlapY, overlapZ);
}
