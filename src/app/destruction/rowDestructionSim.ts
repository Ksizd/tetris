import { CubeVisual } from '../../render';
import { DestructionPreset } from './destructionPresets';
import { DestructionQuality } from './destructionQuality';

/**
 * Симуляция разрушения одного уровня: содержит отсортированные по окружности кубы,
 * расписание их взрывов и флаг полного завершения.
 */
export interface RowDestructionSim {
  level: number;
  cubes: CubeVisual[];
  explosions: CubeExplosionSlot[];
  allCubesExploded: boolean;
  cubeSize: { sx: number; sy: number; sz: number };
  preset: DestructionPreset;
  quality: DestructionQuality;
}

export interface CubeExplosionSlot {
  cubeIndex: number; // индекс в массиве cubes
  startTimeMs: number; // когда этот куб должен начать взрыв
  started: boolean; // уже запущена симуляция разрушения этого куба
}

export function createCubeExplosionSlot(
  cubeIndex: number,
  startTimeMs: number,
  started = false
): CubeExplosionSlot {
  return { cubeIndex, startTimeMs, started };
}
