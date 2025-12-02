import { DestructionSimulationState } from './destructionSimulationState';
import { CubeDestructionSim, createCubeDestructionSim, Fragment } from './cubeDestructionSim';
import { updateCubeDestructionSim, FragmentPhysicsConfig } from './fragmentSimulation';
import { RowDestructionSim } from './rowDestructionSim';
import { GameState } from '../../core/state/gameState';
import { finishLineDestruction } from '../../core/state/clearing';

export interface SimulationStepResult {
  state: DestructionSimulationState;
  updatedCubes: CubeDestructionSim[];
}

function groupActiveByLevel(active: readonly CubeDestructionSim[]): Map<number, CubeDestructionSim[]> {
  const map = new Map<number, CubeDestructionSim[]>();
  for (const sim of active) {
    const level = sim.cube.id.y;
    const list = map.get(level);
    if (list) {
      list.push(sim);
    } else {
      map.set(level, [sim]);
    }
  }
  return map;
}

function markCompletionFlags(
  rows: Map<number, RowDestructionSim>,
  activeByLevel: Map<number, CubeDestructionSim[]>
): boolean {
  let allFinished = true;
  rows.forEach((row) => {
    const allSlotsStarted = row.explosions.every((slot) => slot.started);
    const hasActive = (activeByLevel.get(row.level) ?? []).length > 0;
    const completed = allSlotsStarted && !hasActive;
    row.allCubesExploded = completed;
    if (!completed) {
      allFinished = false;
    }
  });
  return allFinished;
}

/**
 * Обновляет активные симуляции кубов (пер-фрейм), удаляет завершённые и проставляет флаги завершения уровней/сценария.
 */
export function stepDestructionSimulations(
  state: DestructionSimulationState,
  dtMs: number,
  physicsConfig?: FragmentPhysicsConfig
): SimulationStepResult {
  const updatedCubes: CubeDestructionSim[] = [];
  for (const sim of state.activeCubes) {
    const { sim: nextSim, finished } = updateCubeDestructionSim(sim, dtMs, physicsConfig);
    if (!finished) {
      updatedCubes.push(nextSim);
    }
  }

  const activeByLevel = groupActiveByLevel(updatedCubes);
  const allRowsFinished = markCompletionFlags(state.rows.perLevel, activeByLevel);

  const nextState: DestructionSimulationState = {
    ...state,
    rows: { ...state.rows, finished: allRowsFinished },
    activeCubes: updatedCubes,
  };

  return { state: nextState, updatedCubes };
}

/**
 * Утилита: быстро создать симуляцию куба без фрагментов (заполнится позже).
 */
export function createEmptyCubeSim(cube: CubeDestructionSim['cube'], startedAtMs: number): CubeDestructionSim {
  return createCubeDestructionSim(cube, [] as Fragment[], startedAtMs);
}

export interface DestructionCompletionResult {
  game: GameState;
  completed: boolean;
}

/**
 * Если сценарий разрушения завершён, вызывает доменный finishLineDestruction и возвращает обновлённое состояние игры.
 * Использует внедряемый колбэк для удобства тестирования.
 */
export function completeLineDestructionIfFinished(
  game: GameState,
  sim: DestructionSimulationState,
  finishFn: (state: GameState) => GameState = finishLineDestruction
): DestructionCompletionResult {
  if (!sim.rows.finished) {
    return { game, completed: false };
  }
  return { game: finishFn(game), completed: true };
}
