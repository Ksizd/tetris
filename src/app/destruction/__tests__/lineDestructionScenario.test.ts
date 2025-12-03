import { describe, expect, it } from 'vitest';
import { createLineDestructionScenario } from '../lineDestructionScenario';
import { createCubeExplosionSlot, RowDestructionSim } from '../rowDestructionSim';
import { CubeVisual } from '../../../render';
import { ULTRA_DESTRUCTION_PRESET } from '../destructionPresets';
import { DEFAULT_DESTRUCTION_QUALITY } from '../destructionQuality';

describe('LineDestructionScenario', () => {
  it('creates scenario with copied levels and empty perLevel map', () => {
    const levels = [2, 0, 5];
    const scenario = createLineDestructionScenario(levels, 123);

    expect(scenario.levels).toEqual(levels);
    expect(scenario.levels).not.toBe(levels);
    expect(scenario.startedAtMs).toBe(123);
    expect(scenario.finished).toBe(false);
    expect(scenario.perLevel.size).toBe(0);
  });

  it('allows storing per-level RowDestructionSim entries', () => {
    const scenario = createLineDestructionScenario([1], 0);
    const cubes: CubeVisual[] = [];
    const rowSim: RowDestructionSim = {
      level: 1,
      cubes,
      explosions: [createCubeExplosionSlot(0, 120)],
      allCubesExploded: false,
      cubeSize: { sx: 1, sy: 1, sz: 1 },
      preset: ULTRA_DESTRUCTION_PRESET,
      quality: DEFAULT_DESTRUCTION_QUALITY,
    };
    scenario.perLevel.set(1, rowSim);

    const stored = scenario.perLevel.get(1);
    expect(stored?.level).toBe(1);
    expect(stored?.cubes).toBe(cubes);
    expect(stored?.explosions).toEqual([{ cubeIndex: 0, startTimeMs: 120, started: false }]);
    expect(stored?.allCubesExploded).toBe(false);
  });
});
