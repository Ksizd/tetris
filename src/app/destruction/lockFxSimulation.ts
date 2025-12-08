import { Quaternion, Vector3 } from 'three';
import { Fragment, FragmentMaterialId, createFragment } from './cubeDestructionSim';
import { updateFragmentPhysics, FragmentPhysicsConfig, DEFAULT_FRAGMENT_PHYSICS } from './fragmentSimulation';

export interface Range {
  min: number;
  max: number;
}

export interface LockFxBurst {
  id: number;
  originWorld: Vector3;
  startTime: number;
  fragments: Fragment[];
}

export interface LockFxState {
  bursts: LockFxBurst[];
  nextId: number;
}

export interface LockFxPreset {
  fragmentCount: Range;
  lifetimeMs: Range;
  radialSpeed: Range;
  upwardSpeed: Range;
  angularSpeed: Range;
  scale: Range;
  materials: FragmentMaterialId[];
}

export interface LockFxStepResult {
  state: LockFxState;
  fragments: Fragment[];
}

export const DEFAULT_LOCK_FX_PRESET: LockFxPreset = {
  fragmentCount: { min: 14, max: 22 },
  lifetimeMs: { min: 800, max: 1300 },
  radialSpeed: { min: 2.6, max: 4.2 },
  upwardSpeed: { min: 1.8, max: 2.9 },
  angularSpeed: { min: 4, max: 11 },
  scale: { min: 0.28, max: 0.42 },
  materials: ['gold'],
};

export function createLockFxState(): LockFxState {
  return { bursts: [], nextId: 1 };
}

export function spawnLockFxBursts(
  state: LockFxState,
  origins: Vector3[],
  preset: LockFxPreset,
  startedAtMs: number
): LockFxState {
  if (!origins.length) {
    return state;
  }
  const bursts = [...state.bursts];
  let nextId = state.nextId;
  origins.forEach((origin) => {
    const fragments = createLockFragments(origin, preset, nextId);
    bursts.push({
      id: nextId,
      originWorld: origin.clone(),
      startTime: startedAtMs,
      fragments,
    });
    nextId += 1;
  });
  return { bursts, nextId };
}

export function stepLockFx(
  state: LockFxState,
  dtMs: number,
  physics: FragmentPhysicsConfig = DEFAULT_FRAGMENT_PHYSICS
): LockFxStepResult {
  const nextBursts: LockFxBurst[] = [];
  const collected: Fragment[] = [];

  state.bursts.forEach((burst) => {
    const updatedFragments: Fragment[] = [];
    burst.fragments.forEach((frag) => {
      const { fragment, alive } = updateFragmentPhysics(frag, dtMs, physics);
      if (alive) {
        updatedFragments.push(fragment);
        collected.push(fragment);
      }
    });
    if (updatedFragments.length > 0) {
      nextBursts.push({ ...burst, fragments: updatedFragments });
    }
  });

  return { state: { bursts: nextBursts, nextId: state.nextId }, fragments: collected };
}

function createLockFragments(origin: Vector3, preset: LockFxPreset, seedId: number): Fragment[] {
  const fragments: Fragment[] = [];
  const count = randomInt(preset.fragmentCount.min, preset.fragmentCount.max);
  const baseUp = new Vector3(0, 1, 0);
  for (let i = 0; i < count; i += 1) {
    const dir = randomUnitVector();
    dir.y = Math.abs(dir.y) * 0.5; // bias upward
    dir.addScaledVector(baseUp, 1).normalize();
    const speed = randomRange(preset.radialSpeed.min, preset.radialSpeed.max);
    const upBoost = randomRange(preset.upwardSpeed.min, preset.upwardSpeed.max);
    dir.y += upBoost;
    const velocity = dir.multiplyScalar(speed);
    const rotation = new Quaternion().setFromAxisAngle(randomUnitVector(), randomRange(0, Math.PI * 2));
    const angVel = randomUnitVector().multiplyScalar(
      randomRange(preset.angularSpeed.min, preset.angularSpeed.max)
    );
    const scale = randomRange(preset.scale.min, preset.scale.max);
    const material = preset.materials[i % preset.materials.length] ?? 'dust';
    const lifetime = randomRange(preset.lifetimeMs.min, preset.lifetimeMs.max);
    fragments.push(
      createFragment({
        kind: 'dust',
        position: origin.clone(),
        velocity,
        rotation,
        scale: new Vector3(scale, scale, scale),
        angularVelocity: angVel,
        lifetimeMs: lifetime,
        instanceId: seedId * 100 + i,
        materialId: material,
        mass: 0.35,
        linearDrag: 1.4,
        angularDrag: 0.8,
      })
    );
  }
  return fragments;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

function randomUnitVector(): Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const z = Math.random() * 2 - 1;
  const r = Math.sqrt(1 - z * z);
  return new Vector3(r * Math.cos(theta), z, r * Math.sin(theta));
}
