import { Quaternion, Vector3 } from 'three';
import { CubeDestructionSim, Fragment } from './cubeDestructionSim';

export interface FragmentPhysicsConfig {
  gravity: Vector3; // units per second^2
  drag: number; // linear drag coefficient (0..1)
  angularDrag: number; // angular drag coefficient (0..1)
  fadeStart: number; // normalized lifetime fraction to start fading (0..1)
  fadeEnd: number; // normalized lifetime fraction to end fading (<=1)
  floor?: FloorCollisionConfig | null;
  radiusLimit?: RadiusLimitConfig | null;
}

export const DEFAULT_FRAGMENT_PHYSICS: FragmentPhysicsConfig = {
  gravity: new Vector3(0, -9.81, 0),
  drag: 0.6,
  angularDrag: 0.2,
  fadeStart: 0.7,
  fadeEnd: 1.0,
  floor: null,
  radiusLimit: null,
};

export interface FragmentUpdateResult {
  fragment: Fragment;
  alive: boolean;
}

export interface FloorCollisionConfig {
  floorY: number;
  smallOffset?: number;
  minBounceSpeed?: number;
  bounceFactor?: number;
}

export interface RadiusLimitConfig {
  center: Vector3;
  maxRadius: number;
  radialDamping?: number; // coefficient for damping radial velocity when clamped (per second)
  killOutside?: boolean; // if true, fragments beyond radius are immediately removed
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function integrateRotation(quat: Quaternion, angularVelocity: Vector3, dtSec: number): Quaternion {
  const omegaMag = angularVelocity.length();
  if (omegaMag === 0) {
    return quat.clone();
  }
  const axis = angularVelocity.clone().multiplyScalar(1 / omegaMag);
  const angle = omegaMag * dtSec;
  const delta = new Quaternion().setFromAxisAngle(axis, angle);
  return quat.clone().multiply(delta).normalize();
}

/**
 * Пер-фреймовое обновление одного фрагмента. Возвращает обновлённый фрагмент и alive-флаг.
 */
export function updateFragmentPhysics(
  fragment: Fragment,
  dtMs: number,
  config: FragmentPhysicsConfig = DEFAULT_FRAGMENT_PHYSICS
): FragmentUpdateResult {
  const dtSec = dtMs / 1000;
  const nextAge = fragment.ageMs + dtMs;
  if (nextAge >= fragment.lifetimeMs) {
    return {
      fragment: { ...fragment, ageMs: nextAge, fade: 0 },
      alive: false,
    };
  }

  const velocity = fragment.velocity.clone().addScaledVector(config.gravity, dtSec);
  const dragFactor = Math.max(0, 1 - config.drag * dtSec);
  velocity.multiplyScalar(dragFactor);

  const position = fragment.position.clone().addScaledVector(velocity, dtSec);

  const angularVelocity = fragment.angularVelocity.clone().multiplyScalar(
    Math.max(0, 1 - config.angularDrag * dtSec)
  );
  const rotation = integrateRotation(fragment.rotation, angularVelocity, dtSec);

  if (config.floor) {
    const floorCfg = config.floor;
    const smallOffset = floorCfg.smallOffset ?? 1e-3;
    const minBounceSpeed = floorCfg.minBounceSpeed ?? 1;
    const bounceFactor = floorCfg.bounceFactor ?? 0.4;
    if (position.y <= floorCfg.floorY) {
      position.y = floorCfg.floorY + smallOffset;
      if (Math.abs(velocity.y) > minBounceSpeed) {
        velocity.y *= -bounceFactor;
      } else {
        velocity.y = 0;
      }
    }
  }

  if (config.radiusLimit) {
    const { center, maxRadius, killOutside, radialDamping = 3 } = config.radiusLimit;
    if (maxRadius <= 0) {
      throw new Error('radiusLimit.maxRadius must be positive');
    }
    const offset = position.clone().sub(center);
    const radialDist = Math.sqrt(offset.x * offset.x + offset.z * offset.z);
    if (radialDist > maxRadius) {
      if (killOutside) {
        return {
          fragment: { ...fragment, ageMs: nextAge, fade: 0 },
          alive: false,
        };
      }
      // Clamp position onto the boundary and damp radial component of velocity.
      const scale = maxRadius / radialDist;
      position.x = center.x + offset.x * scale;
      position.z = center.z + offset.z * scale;
      const outwardDir = new Vector3(offset.x, 0, offset.z).normalize();
      const radialSpeed = velocity.dot(outwardDir);
      const dampingFactor = Math.max(0, 1 - radialDamping * dtSec);
      const correctedRadial = radialSpeed * dampingFactor;
      const radialComponent = outwardDir.clone().multiplyScalar(correctedRadial);
      const tangentialComponent = velocity.clone().sub(outwardDir.multiplyScalar(radialSpeed));
      velocity.copy(radialComponent.add(tangentialComponent));
    }
  }

  const lifeT = nextAge / fragment.lifetimeMs;
  const fade =
    lifeT >= config.fadeEnd
      ? 0
      : 1 - smoothstep(config.fadeStart, config.fadeEnd, clamp01(lifeT));

  return {
    alive: true,
    fragment: {
      ...fragment,
      ageMs: nextAge,
      position,
      velocity,
      angularVelocity,
      rotation,
      fade,
    },
  };
}

export interface CubeSimUpdateResult {
  sim: CubeDestructionSim;
  finished: boolean;
}

/**
 * Обновляет все фрагменты конкретного куба; если все погибли, помечает симуляцию завершённой.
 */
export function updateCubeDestructionSim(
  sim: CubeDestructionSim,
  dtMs: number,
  config: FragmentPhysicsConfig = DEFAULT_FRAGMENT_PHYSICS
): CubeSimUpdateResult {
  const updatedFragments: Fragment[] = [];
  for (const fragment of sim.fragments) {
    const { fragment: next, alive } = updateFragmentPhysics(fragment, dtMs, config);
    if (alive) {
      updatedFragments.push(next);
    }
  }
  const finished = updatedFragments.length === 0;
  return {
    finished,
    sim: {
      ...sim,
      fragments: updatedFragments,
      finished,
    },
  };
}
