import { Board } from '../../core/board';
import { BoardToWorldMapper } from '../../render';
import { FragmentInstanceUpdate } from './fragmentInstances';
import { FragmentMaterialId } from './cubeDestructionSim';
import { DestructionSimulationState } from './destructionSimulationState';
import { startLineDestructionFromBoard } from './destructionStarter';
import { launchScheduledExplosions } from './orchestrator';
import { stepDestructionSimulations } from './simulationManager';
import { getHiddenCubeIds } from './visualMask';

export interface DestructionOrchestratorState {
  simulation: DestructionSimulationState | null;
}

export interface FragmentBucket {
  materialId: FragmentMaterialId;
  updates: FragmentInstanceUpdate[];
}

export interface DestructionStepResult {
  state: DestructionOrchestratorState;
  hiddenCells: Set<string>;
  fragmentsByTemplate: Map<number, FragmentBucket>;
  finished: boolean;
}

export function createDestructionOrchestratorState(): DestructionOrchestratorState {
  return { simulation: null };
}

export function startDestructionFromEvent(
  state: DestructionOrchestratorState,
  board: Board,
  mapper: BoardToWorldMapper,
  levels: number[],
  startedAtMs: number
): DestructionOrchestratorState {
  if (!levels.length) {
    return state;
  }
  const started = startLineDestructionFromBoard({
    board,
    mapper,
    levels,
    startedAtMs,
  });
  return { simulation: started.simulation };
}

export function stepDestruction(
  state: DestructionOrchestratorState,
  dtMs: number,
  nowMs: number
): DestructionStepResult {
  if (!state.simulation) {
    return emptyStepResult(state);
  }

  const withStarts = launchScheduledExplosions(state.simulation, nowMs);
  const stepped = stepDestructionSimulations(withStarts.state, dtMs);
  const nextSim = stepped.state;

  const fragmentsByTemplate = collectFragmentBuckets(nextSim);
  const hiddenCells = collectHiddenCells(nextSim);
  const finished = Boolean(nextSim.rows.finished);

  return {
    state: { simulation: nextSim },
    hiddenCells,
    fragmentsByTemplate,
    finished,
  };
}

export function clearDestruction(state: DestructionOrchestratorState): DestructionOrchestratorState {
  return { simulation: null };
}

function emptyStepResult(state: DestructionOrchestratorState): DestructionStepResult {
  return {
    state,
    hiddenCells: new Set<string>(),
    fragmentsByTemplate: new Map(),
    finished: false,
  };
}

function collectHiddenCells(sim: DestructionSimulationState): Set<string> {
  const hidden = new Set<string>();
  sim.rows.perLevel.forEach((row) => {
    getHiddenCubeIds(row).forEach((id) => hidden.add(id));
  });
  return hidden;
}

function collectFragmentBuckets(sim: DestructionSimulationState): Map<number, FragmentBucket> {
  const map = new Map<number, FragmentBucket>();
  sim.activeCubes.forEach((cubeSim) => {
    cubeSim.fragments.forEach((fragment) => {
      const templateId = fragment.templateId ?? -1;
      const bucket =
        map.get(templateId) ??
        (() => {
          const created: FragmentBucket = {
            materialId: fragment.materialId,
            updates: [],
          };
          map.set(templateId, created);
          return created;
        })();
      bucket.updates.push({
        instanceId: bucket.updates.length,
        position: fragment.position.clone(),
        rotation: fragment.rotation.clone(),
        scale: fragment.scale.clone(),
        fade: fragment.fade,
        uvRect: fragment.uvRect,
        colorTint: fragment.colorTint,
        templateId,
        materialId: fragment.materialId,
        shardId: fragment.shardId,
      });
    });
  });
  return map;
}
