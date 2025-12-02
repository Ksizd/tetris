import { describe, expect, it } from 'vitest';
import { createDestructionSimulationState } from '../destructionSimulationState';
import { createLineDestructionScenario } from '../lineDestructionScenario';

describe('DestructionSimulationState', () => {
  it('creates state with provided rows and empty activeCubes', () => {
    const rows = createLineDestructionScenario([0, 1], 200);
    const state = createDestructionSimulationState(rows);

    expect(state.rows).toBe(rows);
    expect(state.activeCubes).toEqual([]);
  });
});
