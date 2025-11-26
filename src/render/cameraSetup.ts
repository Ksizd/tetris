import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';

export interface CameraPlacement {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface CameraSetupOptions {
  angleRadians?: number; // around Y
  elevationDeg?: number; // pitch above horizontal
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
  const angle = options.angleRadians ?? (Math.PI / 4) * -1; // look from -45deg azimuth
  const elevationRad = THREE.MathUtils.degToRad(options.elevationDeg ?? 35);
  const towerHeight = computeTowerHeight(dimensions, config);
  const margin = config.blockSize * 2;
  const halfHeightWithMargin = towerHeight / 2 + margin;
  const radialWithMargin = config.towerRadius + margin;
  const fovRad = THREE.MathUtils.degToRad(45); // matches renderer camera fov
  const distance = Math.max(halfHeightWithMargin, radialWithMargin) / Math.tan(fovRad / 2);

  const horizontalComponent = Math.cos(elevationRad) * distance;
  const x = Math.cos(angle) * horizontalComponent;
  const z = Math.sin(angle) * horizontalComponent;
  const y = Math.sin(elevationRad) * distance;

  const position = new THREE.Vector3(x, y, z);
  const target = new THREE.Vector3(0, towerHeight * 0.5, 0);

  return { position, target };
}
