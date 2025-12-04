import { Vector3 } from 'three';

export interface VelocityComponents {
  outward: Vector3;
  tangent: Vector3;
  up: Vector3;
}

export interface VelocityConfig {
  radialSpeed: number;
  tangentialSpeed: number;
  upSpeed?: number;
  waveDirectionSign?: number;
  jitterAngleRad?: number; // max deviation angle from base direction
  jitterStrength?: number; // fraction of base speed used for jitter magnitude
  random?: () => number;
  up?: Vector3;
  mass?: number; // optional effective mass to scale speeds
}

export function computeVelocityBasis(
  cubeWorldPos: Vector3,
  towerCenter: Vector3,
  up: Vector3 = new Vector3(0, 1, 0)
): VelocityComponents {
  const outward = cubeWorldPos.clone().sub(towerCenter).normalize();
  const upDir = up.clone().normalize();
  const tangent = upDir.clone().cross(outward).normalize();
  return { outward, tangent, up: upDir };
}

function randomDirectionInCone(direction: Vector3, angleRad: number, rnd: () => number): Vector3 {
  const baseDir = direction.lengthSq() > 0 ? direction.clone().normalize() : new Vector3(0, 1, 0);
  if (angleRad <= 0) {
    return baseDir;
  }
  const axis = new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
  if (axis.lengthSq() === 0) {
    axis.set(1, 0, 0);
  }
  axis.normalize();
  const angle = (rnd() * 2 - 1) * angleRad;
  return baseDir.clone().applyAxisAngle(axis, angle).normalize();
}

/**
 * Составляет начальную скорость фрагмента из радиальной, тангенциальной и вертикальной компонент
 * с учётом массы и небольшого конусного шума для живости взрыва.
 */
export function composeInitialVelocity(
  cubeWorldPos: Vector3,
  towerCenter: Vector3,
  config: VelocityConfig
): Vector3 {
  const { outward, tangent, up } = computeVelocityBasis(
    cubeWorldPos,
    towerCenter,
    config.up ?? new Vector3(0, 1, 0)
  );
  const mass = Math.max(0.05, config.mass ?? 1);
  const massScale = 1 / Math.sqrt(mass); // heavier -> slower
  const waveDir = config.waveDirectionSign ?? 1;
  const velocity = new Vector3();
  if (config.radialSpeed !== 0) {
    velocity.addScaledVector(outward, config.radialSpeed * massScale);
  }
  if (config.tangentialSpeed !== 0) {
    velocity.addScaledVector(tangent, config.tangentialSpeed * waveDir * massScale);
  }
  if (config.upSpeed) {
    velocity.addScaledVector(up, config.upSpeed * massScale);
  }

  const jitterStrength = Math.max(0, config.jitterStrength ?? 0);
  const jitterAngle = Math.max(0, config.jitterAngleRad ?? 0);
  if (jitterStrength > 0 && velocity.lengthSq() > 0) {
    const rnd = config.random ?? Math.random;
    const dir = randomDirectionInCone(velocity, jitterAngle, rnd);
    const jitterMag = velocity.length() * jitterStrength;
    velocity.addScaledVector(dir, jitterMag);
  }
  return velocity;
}
