import { Board } from '../../core/board';
import { Vector3, Quaternion } from 'three';
import { BoardToWorldMapper } from '../../render';
import { FragmentInstanceUpdate } from './fragmentInstances';
import { Fragment, FragmentMaterialId, createFragment } from './cubeDestructionSim';
import { DestructionSimulationState } from './destructionSimulationState';
import { startLineDestructionFromBoard } from './destructionStarter';
import { launchScheduledExplosions } from './orchestrator';
import { stepDestructionSimulations } from './simulationManager';
import { getHiddenCubeIds } from './visualMask';
import { DestructionPreset, LOCK_FX_PRESET, ULTRA_DESTRUCTION_PRESET } from './destructionPresets';
import { createLockFxState, spawnLockFxBursts, stepLockFx, LockFxState } from './lockFxSimulation';
import { DEFAULT_ANGULAR_DRAG, DEFAULT_FRAGMENT_PHYSICS, DEFAULT_LINEAR_DRAG } from './fragmentSimulation';

export interface DestructionOrchestratorState {
  simulation: DestructionSimulationState | null;
  lockFx: LockFxState;
  pendingLockFx: PendingLockFx[];
}

interface PendingLockFx {
  fragments: Fragment[];
  ttlMs: number;
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
  return { simulation: null, lockFx: createLockFxState(), pendingLockFx: [] };
}

const GAME_TUNING = {
  explosionStrength: 0.2,
  gravityScale: 1.0,
  dragScale: 1.5,
};

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
    preset: buildGamePreset(ULTRA_DESTRUCTION_PRESET),
  });
  return { ...state, simulation: started.simulation };
}

export function addLockFxFromCells(
  state: DestructionOrchestratorState,
  mapper: BoardToWorldMapper,
  cells: { x: number; y: number }[],
  startedAtMs: number
): DestructionOrchestratorState {
  if (!cells.length) {
    return state;
  }
  const lift = mapper.getVerticalSpacing() * 0.6;
  const outward = mapper.getBlockDepth() * 0.35;
  const offsetY = new Vector3(0, lift, 0);
  const origins = cells.map((cell) => {
    const pos = mapper.cellToWorldPosition(cell.x, cell.y, { allowOverflowY: true }).add(offsetY);
    const dir = new Vector3(pos.x, 0, pos.z).normalize();
    if (dir.lengthSq() > 0) {
      pos.addScaledVector(dir, outward);
    }
    return pos;
  });
  const lockFx = spawnLockFxBursts(state.lockFx, origins, LOCK_FX_PRESET, startedAtMs);
  const flashFragments = createFallbackFragments(origins);
  if (process.env.NODE_ENV !== 'production') {
    // Lightweight debug to verify spawn locations in dev builds.
    console.debug('[lock-fx] spawn', {
      cells,
      origins: origins.map((o) => o.toArray()),
      bursts: lockFx.bursts.length,
    });
  }
  return {
    ...state,
    lockFx,
    pendingLockFx: [...state.pendingLockFx, { fragments: flashFragments, ttlMs: 900 }],
  };
}

export function stepDestruction(
  state: DestructionOrchestratorState,
  dtMs: number,
  nowMs: number
): DestructionStepResult {
  if (!state.simulation) {
    const lockStep = stepLockFx(state.lockFx, dtMs);
    const pending = decayPending(state.pendingLockFx, dtMs);
    return emptyStepResult(
      { ...state, lockFx: lockStep.state, pendingLockFx: pending.remaining },
      [...lockStep.fragments, ...pending.fragments]
    );
  }

  const withStarts = launchScheduledExplosions(state.simulation, nowMs);
  const stepped = stepDestructionSimulations(withStarts.state, dtMs, {
    ...DEFAULT_FRAGMENT_PHYSICS,
    gravity: DEFAULT_FRAGMENT_PHYSICS.gravity.clone().multiplyScalar(GAME_TUNING.gravityScale),
  });
  const nextSim = stepped.state;

  const destructionBuckets = collectFragmentBuckets(nextSim);
  const lockStep = stepLockFx(state.lockFx, dtMs);
  const pending = decayPending(state.pendingLockFx, dtMs);
  const lockFragments = [...lockStep.fragments, ...pending.fragments];
  const fragmentsByTemplate = mergeBuckets(destructionBuckets, lockFragments);
  const hiddenCells = collectHiddenCells(nextSim);
  const finished = Boolean(nextSim.rows.finished);

  return {
    state: { simulation: nextSim, lockFx: lockStep.state, pendingLockFx: pending.remaining },
    hiddenCells,
    fragmentsByTemplate,
    finished,
  };
}

export function clearDestruction(state: DestructionOrchestratorState): DestructionOrchestratorState {
  return { simulation: null, lockFx: state.lockFx, pendingLockFx: state.pendingLockFx };
}

function emptyStepResult(
  state: DestructionOrchestratorState,
  lockFragments: Fragment[] = []
): DestructionStepResult {
  return {
    state,
    hiddenCells: new Set<string>(),
    fragmentsByTemplate: mergeBuckets(new Map(), lockFragments),
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
    mergeFragmentsIntoBuckets(map, cubeSim.fragments);
  });
  return map;
}

function scaleRange(range: DestructionPreset['radialSpeed'], factor: number): DestructionPreset['radialSpeed'] {
  return { min: range.min * factor, max: range.max * factor };
}

function mergeBuckets(
  base: Map<number, FragmentBucket>,
  lockFragments: Fragment[]
): Map<number, FragmentBucket> {
  if (lockFragments.length === 0) {
    return base;
  }
  mergeFragmentsIntoBuckets(base, lockFragments);
  return base;
}

function mergeFragmentsIntoBuckets(map: Map<number, FragmentBucket>, fragments: Fragment[]): void {
  fragments.forEach((fragment) => {
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
}

function decayPending(
  pending: PendingLockFx[],
  dtMs: number
): { fragments: Fragment[]; remaining: PendingLockFx[] } {
  if (!pending.length) {
    return { fragments: [], remaining: [] };
  }
  const remaining: PendingLockFx[] = [];
  const out: Fragment[] = [];
  pending.forEach((entry) => {
    const nextTtl = entry.ttlMs - dtMs;
    out.push(...entry.fragments);
    if (nextTtl > 0) {
      remaining.push({ fragments: entry.fragments, ttlMs: nextTtl });
    }
  });
  return { fragments: out, remaining };
}

function createFallbackFragments(origins: Vector3[]): Fragment[] {
  const fragments: Fragment[] = [];
  origins.forEach((origin, idx) => {
    const jitterDir = new Vector3(Math.random() - 0.5, 0.2 + Math.random() * 0.8, Math.random() - 0.5).normalize();
    const speed = 0.4 + Math.random() * 0.8;
    const velocity = jitterDir.multiplyScalar(speed);
    const scale = 0.26 + Math.random() * 0.16;
    fragments.push(
      createFragment({
        kind: 'dust',
        position: origin.clone(),
        velocity,
        rotation: new Quaternion(),
        scale: new Vector3(scale, scale, scale),
        angularVelocity: new Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2),
        lifetimeMs: 900,
        instanceId: idx,
        materialId: 'gold',
        templateId: -1,
        mass: 0.2,
        linearDrag: 1.2,
        angularDrag: 0.8,
      })
    );
  });
  return fragments;
}

function buildGamePreset(base: DestructionPreset): DestructionPreset {
  const strength = GAME_TUNING.explosionStrength;
  const dragScale = GAME_TUNING.dragScale;
  return {
    ...base,
    radialSpeed: scaleRange(base.radialSpeed, strength),
    tangentialSpeed: scaleRange(base.tangentialSpeed, strength),
    verticalSpeed: scaleRange(base.verticalSpeed, strength),
    linearDrag: (base.linearDrag ?? DEFAULT_LINEAR_DRAG) * dragScale,
    angularDrag: (base.angularDrag ?? DEFAULT_ANGULAR_DRAG) * dragScale,
    gravityScale: GAME_TUNING.gravityScale,
  };
}
