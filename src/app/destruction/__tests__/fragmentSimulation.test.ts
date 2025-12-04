import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createFragment, createCubeDestructionSim } from '../cubeDestructionSim';
import {
  DEFAULT_FRAGMENT_PHYSICS,
  updateCubeDestructionSim,
  updateFragmentPhysics,
} from '../fragmentSimulation';
import { CubeVisual } from '../../../render';

function makeFragment(): ReturnType<typeof createFragment> {
  return createFragment({
    kind: 'edgeShard',
    position: new Vector3(0, 0, 0),
    velocity: new Vector3(1, 0, 0),
    rotation: new Quaternion(),
    angularVelocity: new Vector3(0, Math.PI, 0),
    lifetimeMs: 1000,
    instanceId: 0,
    materialId: 'gold',
  });
}

describe('fragmentSimulation', () => {
  it('updates position, velocity, rotation and fade over time', () => {
    const frag = makeFragment();
    const { fragment: next, alive } = updateFragmentPhysics(frag, 500, {
      ...DEFAULT_FRAGMENT_PHYSICS,
      gravity: new Vector3(0, -10, 0),
      linearDrag: 0,
      angularDrag: 0,
      fadeStart: 0.7,
      fadeEnd: 1.0,
    });

    expect(alive).toBe(true);
    expect(next.ageMs).toBeCloseTo(500);
    // velocity should gain downward speed
    expect(next.velocity.y).toBeCloseTo(-5); // a*dtSec = -10 * 0.5
    // position advance along x plus drop along y (semi-implicit Euler)
    expect(next.position.x).toBeCloseTo(0.5);
    expect(next.position.y).toBeCloseTo(-2.5);
    // rotation should change
    expect(next.rotation.equals(frag.rotation)).toBe(false);
    // fade still ~1 before fade window
    expect(next.fade).toBeCloseTo(1);
  });

  it('kills fragment after lifetime and sets fade to 0', () => {
    const frag = makeFragment();
    const { fragment: dead, alive } = updateFragmentPhysics(frag, 1200);
    expect(alive).toBe(false);
    expect(dead.fade).toBe(0);
  });

  it('updates cube sim and marks finished when no fragments remain', () => {
    const cube: CubeVisual = { id: { x: 0, y: 0 }, worldPos: new Vector3() };
    const frag = makeFragment();
    const sim = createCubeDestructionSim(cube, [frag], 0);
    const { sim: after, finished } = updateCubeDestructionSim(sim, 1500);
    expect(finished).toBe(true);
    expect(after.fragments.length).toBe(0);
    expect(after.finished).toBe(true);
  });

  it('bounces on floor when above min speed, else settles', () => {
    const frag = createFragment({
      kind: 'edgeShard',
      position: new Vector3(0, 0.1, 0),
      velocity: new Vector3(0, -5, 0),
      rotation: new Quaternion(),
      angularVelocity: new Vector3(),
      lifetimeMs: 2000,
      instanceId: 0,
      materialId: 'gold',
    });
    const { fragment: bounced } = updateFragmentPhysics(frag, 100, {
      ...DEFAULT_FRAGMENT_PHYSICS,
      gravity: new Vector3(0, 0, 0),
      linearDrag: 0,
      angularDrag: 0,
      floor: { floorY: 0, minBounceSpeed: 1, bounceFactor: 0.5, smallOffset: 0, floorFriction: 0.5 },
    });
    expect(bounced.velocity.y).toBeCloseTo(2.5);
    expect(bounced.velocity.x).toBeCloseTo(0);
    expect(bounced.position.y).toBeCloseTo(0);

    const slow = { ...bounced, velocity: new Vector3(1, -0.5, 0) };
    const { fragment: settled } = updateFragmentPhysics(slow, 100, {
      ...DEFAULT_FRAGMENT_PHYSICS,
      gravity: new Vector3(0, 0, 0),
      linearDrag: 0,
      angularDrag: 0,
      floor: { floorY: 0, minBounceSpeed: 1, bounceFactor: 0.5, smallOffset: 0, floorFriction: 0.5 },
    });
    expect(settled.velocity.y).toBe(0);
    expect(settled.velocity.x).toBeLessThan(slow.velocity.x); // friction applied on contact
    expect(settled.position.y).toBeCloseTo(0);
  });

  it('kills fragment when radius limit exceeded with killOutside', () => {
    const frag = createFragment({
      kind: 'edgeShard',
      position: new Vector3(10, 0, 0),
      velocity: new Vector3(1, 0, 0),
      rotation: new Quaternion(),
      angularVelocity: new Vector3(),
      lifetimeMs: 2000,
      instanceId: 0,
      materialId: 'gold',
    });
    const { alive } = updateFragmentPhysics(frag, 16, {
      ...DEFAULT_FRAGMENT_PHYSICS,
      gravity: new Vector3(0, 0, 0),
      linearDrag: 0,
      angularDrag: 0,
      radiusLimit: { center: new Vector3(), maxRadius: 5, killOutside: true },
    });
    expect(alive).toBe(false);
  });

  it('clamps radius and damps radial velocity when soft limit', () => {
    const frag = createFragment({
      kind: 'edgeShard',
      position: new Vector3(6, 0, 0),
      velocity: new Vector3(4, 0, 0),
      rotation: new Quaternion(),
      angularVelocity: new Vector3(),
      lifetimeMs: 2000,
      instanceId: 0,
      materialId: 'gold',
    });
    const { fragment: next, alive } = updateFragmentPhysics(frag, 100, {
      ...DEFAULT_FRAGMENT_PHYSICS,
      gravity: new Vector3(0, 0, 0),
      linearDrag: 0,
      angularDrag: 0,
      radiusLimit: {
        center: new Vector3(),
        maxRadius: 5,
        radialDamping: 1,
        killOutside: false,
        wallRestitution: 0.5,
        wallFriction: 0.8,
        minWallBounceSpeed: 0.1,
      },
    });
    expect(alive).toBe(true);
    expect(next.position.x).toBeCloseTo(5); // clamped to boundary
    expect(next.velocity.x).toBeLessThan(0); // bounced inward
    expect(Math.abs(next.velocity.x)).toBeLessThan(frag.velocity.x); // restitution applied
  });

  it('starts fading early when resting below speed/height threshold', () => {
    const frag = createFragment({
      kind: 'edgeShard',
      position: new Vector3(0, 0, 0),
      velocity: new Vector3(0.05, 0, 0),
      rotation: new Quaternion(),
      angularVelocity: new Vector3(),
      lifetimeMs: 5000,
      instanceId: 0,
      materialId: 'gold',
    });
    const config = {
      ...DEFAULT_FRAGMENT_PHYSICS,
      gravity: new Vector3(0, 0, 0),
      linearDrag: 0,
      angularDrag: 0,
      restFade: { minSpeed: 0.1, belowHeight: 0.2, durationMs: 200 },
      floor: null,
      radiusLimit: null,
    };
    const step1 = updateFragmentPhysics(frag, 100, config);
    expect(step1.alive).toBe(true);
    expect(step1.fragment.fade).toBeLessThan(1);
    const step2 = updateFragmentPhysics(step1.fragment, 120, config);
    expect(step2.alive).toBe(false);
    expect(step2.fragment.fade).toBe(0);
  });

  it('applies wind acceleration when configured', () => {
    const frag = createFragment({
      kind: 'edgeShard',
      position: new Vector3(1, 0, 0),
      velocity: new Vector3(0, 0, 0),
      rotation: new Quaternion(),
      angularVelocity: new Vector3(),
      lifetimeMs: 2000,
      instanceId: 0,
      materialId: 'gold',
    });
    const { fragment: next } = updateFragmentPhysics(frag, 100, {
      ...DEFAULT_FRAGMENT_PHYSICS,
      gravity: new Vector3(0, 0, 0),
      linearDrag: 0,
      angularDrag: 0,
      wind: { strength: 0.5, spatialFrequency: 2, timeScale: 1 },
      floor: null,
      radiusLimit: null,
    });
    expect(next.velocity.length()).toBeGreaterThan(0);
  });
});
