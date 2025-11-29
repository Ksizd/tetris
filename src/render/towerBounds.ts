import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';
import { computeTowerHeight } from './cameraSetup';

export interface TowerBounds {
  center: THREE.Vector3;
  radius: number;
  minY: number;
  maxY: number;
}

export interface TowerBoundsOptions {
  /**
   * Additional radial margin in world units; defaults to one block to keep the tower comfortably inside the frustum.
   */
  radiusMargin?: number;
  /**
   * Extra headroom above the logical top (spawn zone). Defaults to ~1.5 blocks.
   */
  topMargin?: number;
  /**
   * Floor level in world Y; defaults to 0 so the base sits on the ground plane/shadow catcher.
   */
  minY?: number;
}

/**
  * Computes cylindrical bounds of the tower in world space for camera/frustum planning.
  * minY: floor level; maxY: logical tower top + configurable margin; radius: outer radius + margin.
  */
export function computeTowerEnvelope(
  dimensions: BoardDimensions,
  config: BoardRenderConfig,
  options: TowerBoundsOptions = {}
): TowerBounds {
  const minY = options.minY ?? 0;
  const towerHeight = computeTowerHeight(dimensions, config);
  const topMargin = options.topMargin ?? config.blockSize * 1.5;
  const radiusMargin = options.radiusMargin ?? config.blockSize;

  return {
    center: new THREE.Vector3(0, 0, 0),
    radius: config.towerRadius + radiusMargin,
    minY,
    maxY: minY + towerHeight + topMargin,
  };
}

/**
 * Convenience wrapper to get tower bounds with defaults derived from render config and dimensions.
 */
export function getTowerBounds(
  dimensions: BoardDimensions,
  config: BoardRenderConfig,
  floorY = 0
): TowerBounds {
  return computeTowerEnvelope(dimensions, config, { minY: floorY });
}
