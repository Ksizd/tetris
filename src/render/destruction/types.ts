import { Vector3 } from 'three';

export interface CubeId {
  x: number; // индекс по окружности
  y: number; // индекс по высоте = level
}

export interface CubeVisual {
  id: CubeId;
  worldPos: Vector3;
}
