import * as THREE from 'three';
import { BoardRenderConfig } from './boardConfig';
import { GoldenHallLayout } from './goldenHallLayout';
import { TowerBounds } from './towerBounds';

export interface TowerRadiusSnapshot {
  footprintRadius: number;
  outerRadius: number;
  center: THREE.Vector3;
}

export interface CameraOrbitSnapshot {
  radius: number;
  deltaXZ: THREE.Vector2;
}

export interface HallRadiiSnapshot {
  hallRadius: number;
  platformRadius: number;
}

export interface HallRadiusSources {
  tower: TowerRadiusSnapshot;
  camera: CameraOrbitSnapshot;
  hall: HallRadiiSnapshot;
}

export function deriveTowerRadii(
  board: BoardRenderConfig,
  towerCenter = new THREE.Vector3(0, 0, 0)
): TowerRadiusSnapshot {
  return {
    footprintRadius: board.towerRadius,
    outerRadius: board.towerRadius + board.blockDepth * 0.5,
    center: towerCenter.clone(),
  };
}

export function measureCameraOrbit(
  cameraPosition: THREE.Vector3,
  towerCenter: THREE.Vector3
): CameraOrbitSnapshot {
  const deltaXZ = new THREE.Vector2(
    cameraPosition.x - towerCenter.x,
    cameraPosition.z - towerCenter.z
  );
  return {
    radius: deltaXZ.length(),
    deltaXZ,
  };
}

export function readCurrentHallRadii(layout: GoldenHallLayout): HallRadiiSnapshot {
  return {
    hallRadius: layout.hallRadius,
    platformRadius: layout.base.outerRadius,
  };
}

export function captureHallRadiusSources(params: {
  board: BoardRenderConfig;
  towerBounds: TowerBounds;
  hallLayout: GoldenHallLayout;
  cameraPosition: THREE.Vector3;
}): HallRadiusSources {
  const tower = deriveTowerRadii(params.board, params.towerBounds.center);
  const camera = measureCameraOrbit(params.cameraPosition, params.towerBounds.center);
  const hall = readCurrentHallRadii(params.hallLayout);
  return {
    tower,
    camera,
    hall,
  };
}
