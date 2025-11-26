import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';

export interface CameraPlacement {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface CameraSetupOptions {
  angleRadians?: number; // around Y
  heightFactor?: number; // multiplier of tower height to place camera Y
  distanceFactor?: number; // multiplier of towerRadius to place camera distance
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
  const angle = options.angleRadians ?? (Math.PI / 4) * -1; // look from -45deg
  const distanceFactor = options.distanceFactor ?? 4;
  const heightFactor = options.heightFactor ?? 0.6;

  const towerHeight = computeTowerHeight(dimensions, config);
  const distance = Math.max(
    config.towerRadius * distanceFactor,
    config.towerRadius + config.blockSize * 2
  );

  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;
  const y = towerHeight * heightFactor;

  const position = new THREE.Vector3(x, y, z);
  const target = new THREE.Vector3(0, towerHeight * 0.5, 0);

  return { position, target };
}
