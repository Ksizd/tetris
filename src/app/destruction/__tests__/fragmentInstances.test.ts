import { describe, expect, it } from 'vitest';
import { buildFragmentInstanceUpdates, toInstanceMatrices } from '../fragmentInstances';
import { createFragment } from '../cubeDestructionSim';
import { Quaternion, Vector3 } from 'three';

describe('fragmentInstances', () => {
  it('builds instance updates with clones of transform data', () => {
    const fragment = createFragment({
      kind: 'edgeShard',
      position: new Vector3(1, 2, 3),
      velocity: new Vector3(),
      rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4),
      scale: new Vector3(1, 1, 1),
      angularVelocity: new Vector3(),
      lifetimeMs: 1000,
      instanceId: 7,
      materialId: 'gold',
    });

    const updates = buildFragmentInstanceUpdates([fragment]);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u.instanceId).toBe(7);
    expect(u.position.equals(fragment.position)).toBe(true);
    expect(u.rotation.equals(fragment.rotation)).toBe(true);
    // mutate original to ensure clones were used
    fragment.position.set(0, 0, 0);
    expect(u.position.equals(new Vector3(1, 2, 3))).toBe(true);
  });

  it('produces matrices from updates', () => {
    const fragment = createFragment({
      kind: 'edgeShard',
      position: new Vector3(0, 0, 0),
      velocity: new Vector3(),
      rotation: new Quaternion(),
      scale: new Vector3(1, 1, 1),
      angularVelocity: new Vector3(),
      lifetimeMs: 1000,
      instanceId: 1,
      materialId: 'gold',
    });
    const updates = buildFragmentInstanceUpdates([fragment]);
    const matrices = toInstanceMatrices(updates);
    expect(matrices).toHaveLength(1);
    // identity rotation/position => identity matrix
    const identity = new Vector3();
    const decomposed: [Vector3, Quaternion, Vector3] = [
      new Vector3(),
      new Quaternion(),
      new Vector3(),
    ];
    matrices[0].decompose(decomposed[0], decomposed[1], decomposed[2]);
    expect(decomposed[0].equals(identity)).toBe(true);
    expect(decomposed[1].equals(new Quaternion())).toBe(true);
  });
});
