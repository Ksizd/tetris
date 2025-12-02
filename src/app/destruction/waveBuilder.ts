import { CubeVisual } from '../../render';
import { createCubeExplosionSlot, CubeExplosionSlot } from './rowDestructionSim';

export interface LinearWaveParams {
  cubes: CubeVisual[];
  globalStartMs: number;
  delayBetweenCubesMs: number;
}

/**
 * Строит простую волну "бум-бум-бум": равномерный шаг по времени для каждого куба в порядке массива.
 */
export function buildLinearExplosionWave(params: LinearWaveParams): CubeExplosionSlot[] {
  const { cubes, globalStartMs, delayBetweenCubesMs } = params;
  if (delayBetweenCubesMs <= 0) {
    throw new Error('delayBetweenCubesMs must be positive');
  }

  return cubes.map((_, index) =>
    createCubeExplosionSlot(index, globalStartMs + index * delayBetweenCubesMs)
  );
}
