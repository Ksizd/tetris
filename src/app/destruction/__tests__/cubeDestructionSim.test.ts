import { describe, expect, it } from 'vitest';
import { createCubeDestructionSim, createFragment } from '../cubeDestructionSim';
import { CubeVisual } from '../../../render';
import { Quaternion, Vector3 } from 'three';

describe('CubeDestructionSim', () => {
  it('creates sim with provided cube, fragments and timing', () => {
    const cube: CubeVisual = {
      id: { x: 1, y: 2 },
      worldPos: new Vector3(1, 2, 3),
    };
    const fragments = [
      createFragment({
        kind: 'edgeShard',
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(1, 0, 0),
        rotation: new Quaternion(),
        angularVelocity: new Vector3(0, 1, 0),
        lifetimeMs: 1200,
        instanceId: 0,
        materialId: 'gold',
      }),
    ];
    const sim = createCubeDestructionSim(cube, fragments, 150);

    expect(sim.cube).toBe(cube);
    expect(sim.fragments).toBe(fragments);
    expect(sim.startedAtMs).toBe(150);
    expect(sim.finished).toBe(false);
  });

  it('respects custom finished flag', () => {
    const cube: CubeVisual = {
      id: { x: 0, y: 0 },
      worldPos: new Vector3(),
    };
    const sim = createCubeDestructionSim(cube, [], 0, true);
    expect(sim.finished).toBe(true);
  });
});
