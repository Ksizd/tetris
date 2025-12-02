import { describe, expect, it } from 'vitest';
import { stepDestructionSimulations } from '../simulationManager';
import { createLineDestructionScenario } from '../lineDestructionScenario';
import { createDestructionSimulationState } from '../destructionSimulationState';
import { RowDestructionSim, createCubeExplosionSlot } from '../rowDestructionSim';
import { CubeVisual } from '../../../render';
import { Vector3, Quaternion } from 'three';
import { createCubeDestructionSim, createFragment } from '../cubeDestructionSim';
import { completeLineDestructionIfFinished } from '../simulationManager';
import { GameState } from '../../../core/state/gameState';
import { createInitialGameState } from '../../../core/state/initialState';
import { ULTRA_DESTRUCTION_PRESET } from '../destructionPresets';

function makeRow(started: boolean): RowDestructionSim {
  const cubes: CubeVisual[] = [
    { id: { x: 0, y: 0 }, worldPos: new Vector3(0, 0, 0) },
  ];
  return {
    level: 0,
    cubes,
    explosions: [createCubeExplosionSlot(0, 0)],
    allCubesExploded: false,
    cubeSize: { sx: 1, sy: 1, sz: 1 },
    preset: ULTRA_DESTRUCTION_PRESET,
  };
}

describe('simulationManager', () => {
  it('marks row finished when all slots started and no active cubes', () => {
    const scenario = createLineDestructionScenario([0], 0);
    const row = makeRow(true);
    row.explosions[0].started = true;
    scenario.perLevel.set(0, row);
    const state = createDestructionSimulationState(scenario);

    const { state: next } = stepDestructionSimulations(state, 16);

    expect(next.rows.perLevel.get(0)?.allCubesExploded).toBe(true);
    expect(next.rows.finished).toBe(true);
  });

  it('keeps row unfinished if active cube fragments remain', () => {
    const scenario = createLineDestructionScenario([0], 0);
    const row = makeRow(true);
    row.explosions[0].started = true;
    scenario.perLevel.set(0, row);
    const frag = createFragment({
      kind: 'edgeShard',
      position: new Vector3(),
      velocity: new Vector3(0, 0, 0),
      rotation: new Quaternion(),
      angularVelocity: new Vector3(),
      lifetimeMs: 2000,
      instanceId: 1,
      materialId: 'gold',
    });
    const activeSim = createCubeDestructionSim(row.cubes[0], [frag], 0);
    const state = createDestructionSimulationState(scenario);
    state.activeCubes.push(activeSim);

    const { state: next } = stepDestructionSimulations(state, 16, {
      gravity: new Vector3(0, 0, 0),
      drag: 0,
      angularDrag: 0,
      fadeStart: 0.7,
      fadeEnd: 1.0,
      floor: null,
      radiusLimit: null,
    });

    expect(next.rows.perLevel.get(0)?.allCubesExploded).toBe(false);
    expect(next.rows.finished).toBe(false);
    expect(next.activeCubes.length).toBe(1);
  });

  it('does not finish row if not all slots started', () => {
    const scenario = createLineDestructionScenario([0], 0);
    const row = makeRow(false);
    row.explosions[0].started = false;
    scenario.perLevel.set(0, row);
    const state = createDestructionSimulationState(scenario);

    const { state: next } = stepDestructionSimulations(state, 16);

    expect(next.rows.perLevel.get(0)?.allCubesExploded).toBe(false);
    expect(next.rows.finished).toBe(false);
  });

  it('calls domain finish when scenario finished', () => {
    const game = createInitialGameState();
    const scenario = createLineDestructionScenario([0], 0);
    scenario.finished = true;
    const state = createDestructionSimulationState(scenario);
    let called = 0;
    const finishFn = (s: GameState) => {
      called += 1;
      return s;
    };

    const result = completeLineDestructionIfFinished(game, state, finishFn);

    expect(result.completed).toBe(true);
    expect(called).toBe(1);
  });

  it('does not call finish when scenario not finished', () => {
    const game = createInitialGameState();
    const scenario = createLineDestructionScenario([0], 0);
    scenario.finished = false;
    const state = createDestructionSimulationState(scenario);
    let called = 0;

    const result = completeLineDestructionIfFinished(game, state, () => {
      called += 1;
      return game;
    });

    expect(result.completed).toBe(false);
    expect(called).toBe(0);
    expect(result.game).toBe(game);
  });
});
