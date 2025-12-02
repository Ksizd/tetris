import { CubeDestructionSim } from './cubeDestructionSim';
import { DestructionSimulationState } from './destructionSimulationState';
import { startCubeExplosion } from './explosionLifecycle';

export interface OrchestratorUpdateResult {
  state: DestructionSimulationState;
  started: CubeDestructionSim[];
}

/**
 * Запускает взрывы кубов согласно расписанию слотов, добавляя их в activeCubes.
 */
export function launchScheduledExplosions(
  state: DestructionSimulationState,
  timeNowMs: number
): OrchestratorUpdateResult {
  const started: CubeDestructionSim[] = [];
  const nextActive = [...state.activeCubes];

  for (const row of state.rows.perLevel.values()) {
    for (const slot of row.explosions) {
      if (!slot.started && timeNowMs >= slot.startTimeMs) {
        const sim = startCubeExplosion(row, slot.cubeIndex, timeNowMs);
        started.push(sim);
        nextActive.push(sim);
      }
    }
  }

  return {
    state: {
      ...state,
      activeCubes: nextActive,
    },
    started,
  };
}
