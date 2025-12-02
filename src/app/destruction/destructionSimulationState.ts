import { LineDestructionScenario } from './lineDestructionScenario';
import { CubeDestructionSim } from './cubeDestructionSim';

/**
 * Глобальное состояние визуальной симуляции разрушения: какие уровни чистим и какие кубы уже взорваны и симулируются.
 */
export interface DestructionSimulationState {
  rows: LineDestructionScenario;
  activeCubes: CubeDestructionSim[];
}

export function createDestructionSimulationState(
  rows: LineDestructionScenario
): DestructionSimulationState {
  return {
    rows,
    activeCubes: [],
  };
}
