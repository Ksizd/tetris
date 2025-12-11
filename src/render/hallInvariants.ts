import * as THREE from 'three';
import { GoldenHallLayout } from './goldenHallLayout';
import { TowerBounds } from './towerBounds';
import { measureCameraOrbit } from './hallRadiiSources';

export interface HallInvariantSnapshot {
  hallInnerRadius: number;
  towerOuterRadius: number;
  cameraOrbitRadius: number;
  cameraClearance: number;
  towerClearance: number;
}

export interface HallInvariantStatus {
  hallContainsCamera: boolean;
  hallContainsTower: boolean;
}

const CLEARANCE_EPSILON = 1e-4;

/**
 * Captures the radii needed to verify hall_plan 15.1.0 invariants without mutating inputs.
 * - Camera orbit radius is read from the actual camera position projected to XZ.
 * - Tower radius is taken from the current hall footprint (already accounts for bevels).
 * - Hall radius uses the layout definition; thickness is handled by the layout itself.
 */
export function measureHallInvariants(params: {
  towerBounds: TowerBounds;
  hallLayout: GoldenHallLayout;
  cameraPosition: THREE.Vector3;
}): HallInvariantSnapshot {
  const camera = measureCameraOrbit(params.cameraPosition, params.towerBounds.center);
  const hallInnerRadius = params.hallLayout.hallRadius;
  const towerOuterRadius = params.hallLayout.footprint.outerRadius;

  return {
    hallInnerRadius,
    towerOuterRadius,
    cameraOrbitRadius: camera.radius,
    cameraClearance: hallInnerRadius - camera.radius,
    towerClearance: hallInnerRadius - towerOuterRadius,
  };
}

export function evaluateHallInvariantStatus(
  snapshot: HallInvariantSnapshot
): HallInvariantStatus {
  return {
    hallContainsCamera: snapshot.cameraClearance > CLEARANCE_EPSILON,
    hallContainsTower: snapshot.towerClearance > CLEARANCE_EPSILON,
  };
}
