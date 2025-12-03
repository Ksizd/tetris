import { Vector3 } from 'three';
import { CUBE_LOCAL_MIN } from './cubeSpace';
import { CORE_BOUNDS, CORE_Z_RANGE, SHELL_DEPTH } from './shellLayers';

export interface CoreGridOptions {
  divisions?: number; // base resolution per axis before jitter
  jitterAmplitude?: number; // fraction of cell size (0..0.49)
  random?: () => number;
}

export interface CoreGrid {
  nodes: Vector3[];
  cellSize: number;
  divisions: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildCoreJitterGrid(options: CoreGridOptions = {}): CoreGrid {
  const random = options.random ?? Math.random;
  const divisions = Math.max(2, Math.floor(options.divisions ?? 5));
  const span = CORE_BOUNDS[1] - CORE_BOUNDS[0];
  const cellSize = span / divisions;
  const jitterAmp = clamp(options.jitterAmplitude ?? 0.18, 0, 0.49) * cellSize;

  const nodes: Vector3[] = [];
  for (let ix = 0; ix <= divisions; ix += 1) {
    for (let iy = 0; iy <= divisions; iy += 1) {
      for (let iz = 0; iz <= divisions; iz += 1) {
        const jitter = new Vector3(
          (random() * 2 - 1) * jitterAmp,
          (random() * 2 - 1) * jitterAmp,
          (random() * 2 - 1) * jitterAmp
        );
        const x = CORE_BOUNDS[0] + ix * cellSize + jitter.x;
        const y = CORE_BOUNDS[0] + iy * cellSize + jitter.y;
        const z = CORE_Z_RANGE[0] + iz * (CORE_Z_RANGE[1] - CORE_Z_RANGE[0]) / divisions + jitter.z;
        nodes.push(new Vector3(x, y, z));
      }
    }
  }

  return { nodes, cellSize, divisions };
}
