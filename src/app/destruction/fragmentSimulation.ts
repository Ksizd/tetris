import { Quaternion, Vector3 } from 'three';
import { CubeDestructionSim, Fragment } from './cubeDestructionSim';

// PHYSICS_UNITS: 1 world unit ~ one cube side (~1 meter). Time in seconds.
export const STANDARD_GRAVITY_MS2 = 9.81;
export const DEFAULT_LINEAR_DRAG = 0.6; // per-second exponential damping factor
export const DEFAULT_ANGULAR_DRAG = 0.2;

export interface FragmentPhysicsConfig {
  gravity: Vector3; // units per second^2
  linearDrag: number; // linear drag coefficient (0..1)
  angularDrag: number; // angular drag coefficient (0..1)
  fadeStart: number; // normalized lifetime fraction to start fading (0..1)
  fadeEnd: number; // normalized lifetime fraction to end fading (<=1)
  floor?: FloorCollisionConfig | null;
  radiusLimit?: RadiusLimitConfig | null;
  restFade?: RestFadeConfig | null;
  wind?: WindConfig | null;
}

export const DEFAULT_FRAGMENT_PHYSICS: FragmentPhysicsConfig = {
  gravity: new Vector3(0, -STANDARD_GRAVITY_MS2, 0),
  linearDrag: DEFAULT_LINEAR_DRAG,
  angularDrag: DEFAULT_ANGULAR_DRAG,
  fadeStart: 0.7,
  fadeEnd: 1.0,
  floor: null,
  radiusLimit: null,
  restFade: null,
  wind: null,
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
  floorFriction?: number; // multiplier applied to tangential velocity on contact (0..1]
  sleepSpeed?: number; // if total speed drops below, fragment stops
}

export interface RadiusLimitConfig {
  center: Vector3;
  maxRadius: number;
  radialDamping?: number; // coefficient for damping radial velocity when clamped (per second)
  killOutside?: boolean; // if true, fragments beyond radius are immediately removed
  wallRestitution?: number; // bounce factor for cylindrical wall (0..1)
  wallFriction?: number; // tangential damping on wall contact (0..1]
  minWallBounceSpeed?: number; // below this radial speed, stop instead of bouncing
}

export interface RestFadeConfig {
  minSpeed: number; // below this, fragment considered resting
  belowHeight: number; // y threshold to consider near floor/camera
  durationMs: number; // fade duration after rest detected
}

export interface WindConfig {
  strength: number; // multiplier for wind acceleration
  spatialFrequency: number; // frequency for position-based variation
  timeScale?: number; // multiplier for time input (seconds)
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

function pseudoWind(pos: Vector3, ageMs: number, cfg: WindConfig): Vector3 {
  const t = (ageMs / 1000) * (cfg.timeScale ?? 1);
  const f = cfg.spatialFrequency;
  const wx = Math.sin(pos.x * f + t * 1.1) + Math.sin(pos.z * f * 0.7 - t * 0.8);
  const wy = Math.sin(pos.y * f * 0.8 + t * 0.6);
  const wz = Math.cos(pos.z * f + t * 1.3) + Math.sin(pos.x * f * 0.6 + t * 0.4);
  return new Vector3(wx, wy, wz).multiplyScalar(0.5 * cfg.strength);
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

  const linearDrag = Math.max(
    0,
    fragment.linearDrag ?? config.linearDrag ?? DEFAULT_LINEAR_DRAG
  );
  const angularDrag = Math.max(
    0,
    fragment.angularDrag ?? config.angularDrag ?? DEFAULT_ANGULAR_DRAG
  );

  const acceleration = config.gravity;
  const velocity = fragment.velocity.clone().addScaledVector(acceleration, dtSec);
  if (config.wind && config.wind.strength > 0) {
    const windAccel = pseudoWind(fragment.position, nextAge, config.wind);
    velocity.addScaledVector(windAccel, dtSec);
  }
  const dragFactor = Math.max(0, 1 - linearDrag * dtSec);
  velocity.multiplyScalar(dragFactor);

  const position = fragment.position.clone().addScaledVector(velocity, dtSec);

  const angularVelocity = fragment.angularVelocity
    .clone()
    .multiplyScalar(Math.max(0, 1 - angularDrag * dtSec));
  const rotation = integrateRotation(fragment.rotation, angularVelocity, dtSec);

  if (config.floor) {
    const floorCfg = config.floor;
    const smallOffset = floorCfg.smallOffset ?? 1e-3;
    const minBounceSpeed = floorCfg.minBounceSpeed ?? 1;
    const restitution = floorCfg.bounceFactor ?? 0.4;
    const friction = floorCfg.floorFriction ?? 1;
    const sleepSpeed = floorCfg.sleepSpeed ?? 0;
    if (position.y <= floorCfg.floorY) {
      position.y = floorCfg.floorY + smallOffset;
      if (velocity.y < 0) {
        const bouncedVy = -velocity.y * restitution;
        velocity.y = Math.abs(bouncedVy) > minBounceSpeed ? bouncedVy : 0;
      } else {
        velocity.y = 0;
      }
      velocity.x *= friction;
      velocity.z *= friction;
      if (sleepSpeed > 0 && velocity.length() < sleepSpeed) {
        velocity.setScalar(0);
      }
    }
  }

  if (config.radiusLimit) {
    const {
      center,
      maxRadius,
      killOutside,
      radialDamping = 3,
      wallRestitution = 0.3,
      wallFriction = 0.85,
      minWallBounceSpeed = 0.2,
    } = config.radiusLimit;
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
      // Clamp position onto the boundary and bounce/damp radial component of velocity.
      const scale = maxRadius / radialDist;
      position.x = center.x + offset.x * scale;
      position.z = center.z + offset.z * scale;
      const outwardDir = new Vector3(offset.x, 0, offset.z).normalize();
      const radialSpeed = velocity.dot(outwardDir);
      const radialComponent = outwardDir.clone().multiplyScalar(radialSpeed);
      const tangentialComponent = velocity.clone().sub(radialComponent);

      if (radialSpeed > 0) {
        const bounced = -radialSpeed * wallRestitution;
        const finalRadial = Math.abs(bounced) > minWallBounceSpeed ? bounced : 0;
        velocity.copy(
          outwardDir
            .clone()
            .multiplyScalar(finalRadial)
            .add(tangentialComponent.multiplyScalar(wallFriction))
        );
      } else {
        // sliding along wall; apply radial damping to keep inside boundary
        const dampingFactor = Math.max(0, 1 - radialDamping * dtSec);
        const correctedRadial = radialSpeed * dampingFactor;
        const radialComponent = outwardDir.clone().multiplyScalar(correctedRadial);
        velocity.copy(radialComponent.add(tangentialComponent.multiplyScalar(wallFriction)));
      }
    }
  }

  let restFadeMs = fragment.restFadeMs ?? 0;
  const restFadeCfg = config.restFade;
  if (restFadeCfg) {
    const resting =
      velocity.length() < restFadeCfg.minSpeed && position.y <= restFadeCfg.belowHeight;
    if (resting || restFadeMs > 0) {
      restFadeMs += dtMs;
    }
  }

  const lifeT = nextAge / fragment.lifetimeMs;
  const fadeByAge =
    lifeT >= config.fadeEnd
      ? 0
      : 1 - smoothstep(config.fadeStart, config.fadeEnd, clamp01(lifeT));

  let fade = fadeByAge;
  let alive = true;
  if (restFadeCfg && restFadeCfg.durationMs > 0) {
    const restT = clamp01(restFadeMs / restFadeCfg.durationMs);
    const fadeByRest = 1 - restT;
    fade = Math.min(fadeByAge, fadeByRest);
    if (restT >= 1) {
      fade = 0;
      alive = false;
    }
  }

  return {
    alive,
    fragment: {
      ...fragment,
      ageMs: nextAge,
      position,
      velocity,
      angularVelocity,
      rotation,
      fade,
      restFadeMs,
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
