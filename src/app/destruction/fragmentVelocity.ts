import { Vector3 } from 'three';

export interface VelocityComponents {
  outward: Vector3;
  tangent: Vector3;
}

export interface VelocityConfig {
  radialSpeed: number;
  tangentialSpeed: number;
  up?: Vector3;
}

/**
 * Рассчитывает базовые направления для фрагментов: outward (от центра башни) и tangent (вдоль окружности).
 */
export function computeVelocityBasis(
  cubeWorldPos: Vector3,
  towerCenter: Vector3,
  up: Vector3 = new Vector3(0, 1, 0)
): VelocityComponents {
  const outward = cubeWorldPos.clone().sub(towerCenter).normalize();
  const tangent = up.clone().cross(outward).normalize();
  return { outward, tangent };
}

/**
 * Задаёт начальную скорость фрагмента как линейную комбинацию радиального и тангенциального направлений.
 */
export function composeInitialVelocity(
  cubeWorldPos: Vector3,
  towerCenter: Vector3,
  config: VelocityConfig
): Vector3 {
  const { outward, tangent } = computeVelocityBasis(
    cubeWorldPos,
    towerCenter,
    config.up ?? new Vector3(0, 1, 0)
  );
  const velocity = new Vector3();
  if (config.radialSpeed !== 0) {
    velocity.addScaledVector(outward, config.radialSpeed);
  }
  if (config.tangentialSpeed !== 0) {
    velocity.addScaledVector(tangent, config.tangentialSpeed);
  }
  return velocity;
}
