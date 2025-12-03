import { describe, expect, it } from 'vitest';
import { launchScheduledExplosions } from '../orchestrator';
import { createLineDestructionScenario } from '../lineDestructionScenario';
import { RowDestructionSim, createCubeExplosionSlot } from '../rowDestructionSim';
import { CubeVisual } from '../../../render';
import { Vector3 } from 'three';
import { createDestructionSimulationState } from '../destructionSimulationState';
import { ULTRA_DESTRUCTION_PRESET } from '../destructionPresets';
import { DEFAULT_DESTRUCTION_QUALITY } from '../destructionQuality';

function makeRow(startTimeMs: number): RowDestructionSim {
  const cubes: CubeVisual[] = [
    { id: { x: 0, y: 0 }, worldPos: new Vector3(0, 0, 0) },
    { id: { x: 1, y: 0 }, worldPos: new Vector3(1, 0, 0) },
  ];
  return {
    level: 0,
    cubes,
    explosions: [
      createCubeExplosionSlot(0, startTimeMs),
      createCubeExplosionSlot(1, startTimeMs + 50),
    ],
    allCubesExploded: false,
    cubeSize: { sx: 1, sy: 1, sz: 1 },
    preset: ULTRA_DESTRUCTION_PRESET,
    quality: DEFAULT_DESTRUCTION_QUALITY,
  };
}

describe('orchestrator launchScheduledExplosions', () => {
  it('starts due explosions and marks slots started', () => {
    const scenario = createLineDestructionScenario([0], 0);
    const row = makeRow(100);
    scenario.perLevel.set(0, row);
    const state = createDestructionSimulationState(scenario);

    const { state: after, started } = launchScheduledExplosions(state, 120);

    expect(started.length).toBe(1);
    expect(after.activeCubes.length).toBe(1);
    expect(row.explosions[0].started).toBe(true);
    expect(row.explosions[1].started).toBe(false);
  });

  it('does not double-start already started slots', () => {
    const scenario = createLineDestructionScenario([0], 0);
    const row = makeRow(0);
    scenario.perLevel.set(0, row);
    const state = createDestructionSimulationState(scenario);

    const first = launchScheduledExplosions(state, 100);
    const second = launchScheduledExplosions(first.state, 200);

    expect(first.started.length).toBe(2);
    expect(first.state.activeCubes.length).toBe(2);
    expect(second.started.length).toBe(0);
    expect(second.state.activeCubes.length).toBe(2);
  });
});
