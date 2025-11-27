import * as THREE from 'three';
import { wrapX } from '../core/coords';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig, createBoardRenderConfig } from './boardConfig';

export type { BoardRenderConfig } from './boardConfig';
export { calculateTowerRadius, createBoardRenderConfig } from './boardConfig';

/**
 * Maps board cell coordinates (x wraps around width, y grows upward) to world positions on a cylindrical tower.
 */
export class BoardToWorldMapper {
  private readonly dimensions: BoardDimensions;
  private readonly config: BoardRenderConfig;

  constructor(dimensions: BoardDimensions, config?: Partial<BoardRenderConfig>) {
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      throw new Error('Board dimensions must be positive');
    }
    this.dimensions = { ...dimensions };
    this.config = createBoardRenderConfig(dimensions, config);
  }

  getDimensions(): BoardDimensions {
    return { ...this.dimensions };
  }

  cellToWorldPosition(x: number, y: number): THREE.Vector3 {
    this.ensureIntegerCoord(x, 'x');
    this.ensureIntegerCoord(y, 'y');
    this.ensureValidY(y);
    const normalizedX = wrapX(x, this.dimensions.width);
    const angle = this.columnAngle(normalizedX);
    const worldX = Math.cos(angle) * this.config.towerRadius;
    const worldZ = Math.sin(angle) * this.config.towerRadius;
    const worldY = y * this.config.verticalSpacing;

    return new THREE.Vector3(worldX, worldY, worldZ);
  }

  /**
   * Returns quaternion that orients a cube so that its +Z face looks outward from tower center.
   */
  getRadialOrientation(x: number, target = new THREE.Quaternion()): THREE.Quaternion {
    this.ensureIntegerCoord(x, 'x');
    const normalizedX = wrapX(x, this.dimensions.width);
    const angle = this.columnAngle(normalizedX);
    const rotationY = Math.PI / 2 - angle;
    return target.setFromAxisAngle(AXIS_Y, rotationY);
  }

  private columnAngle(normalizedX: number): number {
    return (2 * Math.PI * normalizedX) / this.dimensions.width;
  }

  private ensureValidY(y: number): void {
    if (y < 0 || y >= this.dimensions.height) {
      throw new RangeError(
        `Board y=${y} is outside vertical bounds [0, ${this.dimensions.height - 1}]`
      );
    }
  }

  private ensureIntegerCoord(value: number, name: 'x' | 'y'): void {
    if (!Number.isInteger(value)) {
      throw new TypeError(`Board coordinate ${name} must be an integer, got ${value}`);
    }
  }
}

const AXIS_Y = new THREE.Vector3(0, 1, 0);
