import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';

export interface CameraPlacement {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export const DEFAULT_CAMERA_FOV = 36;
export const DEFAULT_CAMERA_ANGLE = (Math.PI / 4) * -1; // -45 deg
export const DEFAULT_CAMERA_HEIGHT_RATIO = 0.58;
export const DEFAULT_TARGET_HEIGHT_RATIO = 0.5;

export interface CameraSetupOptions {
  angleRadians?: number; // around Y
  elevationDeg?: number; // pitch above horizontal (deprecated by ratios)
  fovDeg?: number; // used to keep tower in frame
  cameraHeightRatio?: number; // relative to tower height (0..1)
  targetHeightRatio?: number; // relative to tower height (0..1)
}

export function computeTowerHeight(dimensions: BoardDimensions, config: BoardRenderConfig): number {
  return (dimensions.height - 1) * config.verticalSpacing + config.blockSize;
}

/**
 * Computes a default camera placement that keeps the camera outside the tower geometry.
 */
export function computeCameraPlacement(
  dimensions: BoardDimensions,
  config: BoardRenderConfig,
  options: CameraSetupOptions = {}
): CameraPlacement {
  const angle = options.angleRadians ?? DEFAULT_CAMERA_ANGLE;
  const towerHeight = computeTowerHeight(dimensions, config);
  const cameraHeightRatio = clamp(
    options.cameraHeightRatio ?? DEFAULT_CAMERA_HEIGHT_RATIO,
    0.52,
    0.64
  );
  const targetHeightRatio = clamp(
    options.targetHeightRatio ?? DEFAULT_TARGET_HEIGHT_RATIO,
    0.44,
    0.6
  );
  const cameraY = towerHeight * cameraHeightRatio;
  const targetY = towerHeight * targetHeightRatio;
  const fovRad = THREE.MathUtils.degToRad(options.fovDeg ?? DEFAULT_CAMERA_FOV);

  const horizontalDistance = findHorizontalDistance({
    towerHeight,
    towerRadius: config.towerRadius,
    blockSize: config.blockSize,
    cameraY,
    targetY,
    fovRad,
  });

  const x = Math.cos(angle) * horizontalDistance;
  const z = Math.sin(angle) * horizontalDistance;

  const position = new THREE.Vector3(x, cameraY, z);
  const target = new THREE.Vector3(0, targetY, 0);

  return { position, target };
}

/**
 * Recomputes camera distance (XZ) to keep tower fully in frame at current height/target/FOV.
 * Useful on resize when aspect changes or when tweaking FOV without changing orientation.
 */
export function recomputeCameraPlacementForFrame(
  dimensions: BoardDimensions,
  config: BoardRenderConfig,
  placement: CameraPlacement,
  fovDeg?: number
): CameraPlacement {
  const towerHeight = computeTowerHeight(dimensions, config);
  const targetY = clamp(placement.target.y, 0, towerHeight);
  const cameraY = placement.position.y;
  const azimuth = new THREE.Vector2(
    placement.position.x - placement.target.x,
    placement.position.z - placement.target.z
  );
  const azimuthDir = azimuth.lengthSq() > 0 ? azimuth.normalize() : new THREE.Vector2(1, 0);
  const fovRad = THREE.MathUtils.degToRad(fovDeg ?? DEFAULT_CAMERA_FOV);

  const horizontalDistance = findHorizontalDistance({
    towerHeight,
    towerRadius: config.towerRadius,
    blockSize: config.blockSize,
    cameraY,
    targetY,
    fovRad,
  });

  const position = new THREE.Vector3(
    placement.target.x + azimuthDir.x * horizontalDistance,
    cameraY,
    placement.target.z + azimuthDir.y * horizontalDistance
  );
  const target = new THREE.Vector3(placement.target.x, targetY, placement.target.z);

  return { position, target };
}

interface FrameSolveParams {
  towerHeight: number;
  towerRadius: number;
  blockSize: number;
  cameraY: number;
  targetY: number;
  fovRad: number;
}

function findHorizontalDistance(params: FrameSolveParams): number {
  const { towerHeight, towerRadius, blockSize, cameraY, targetY, fovRad } = params;
  const margin = blockSize * 1.6;
  const minHorizontal = Math.max(towerRadius + margin, towerHeight * 0.3);
  const fovLimit = (fovRad * 0.5) * 0.96; // keep 4% headroom
  const probeAzimuth = Math.PI / 4;
  let horizontal = minHorizontal;

  for (let i = 0; i < 14; i += 1) {
    if (framesTowerWell(horizontal, cameraY, targetY, towerHeight, fovLimit, probeAzimuth)) {
      return horizontal;
    }
    horizontal *= 1.12;
  }

  return horizontal;
}

function framesTowerWell(
  horizontal: number,
  cameraY: number,
  targetY: number,
  towerHeight: number,
  maxAngle: number,
  azimuthAngle: number
): boolean {
  const position = new THREE.Vector3(
    Math.cos(azimuthAngle) * horizontal,
    cameraY,
    Math.sin(azimuthAngle) * horizontal
  );
  const target = new THREE.Vector3(0, targetY, 0);
  const dir = target.clone().sub(position).normalize();
  const top = new THREE.Vector3(0, towerHeight, 0).sub(position).normalize();
  const bottom = new THREE.Vector3(0, 0, 0).sub(position).normalize();

  const angleToTop = dir.angleTo(top);
  const angleToBottom = dir.angleTo(bottom);
  const maxViewAngle = Math.max(angleToTop, angleToBottom);

  return maxViewAngle <= maxAngle;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
