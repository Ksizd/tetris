import { Vector3 } from 'three';
import { FragmentMaterialId } from './cubeDestructionSim';

export interface AngularSpeedRange {
  min: number;
  max: number;
}

export interface AngularVelocityConfig {
  ranges?: Partial<Record<FragmentMaterialId, AngularSpeedRange>>;
  randomFn?: () => number;
  mass?: number;
}

const DEFAULT_ANGULAR_RANGES: Record<FragmentMaterialId, AngularSpeedRange> = {
  gold: { min: 2, max: 6 },
  face: { min: 3, max: 8 },
  inner: { min: 1.5, max: 5 },
  dust: { min: 4, max: 10 },
};

function validateRange(range: AngularSpeedRange): void {
  if (range.min < 0 || range.max < 0 || range.max < range.min) {
    throw new Error('Angular speed range must have non-negative min/max and max >= min');
  }
}

function randomUnitVector(randomFn: () => number): Vector3 {
  const u = randomFn();
  const v = randomFn();
  const theta = 2 * Math.PI * u;
  const z = 2 * v - 1;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  const x = r * Math.cos(theta);
  const y = r * Math.sin(theta);
  return new Vector3(x, y, z);
}

/**
 * Возвращает случайный вектор внутри сферической оболочки с длиной в [min, max].
 */
export function randomVectorWithinSphere(
  range: AngularSpeedRange,
  randomFn: () => number = Math.random
): Vector3 {
  validateRange(range);
  if (range.max === 0) {
    return new Vector3(0, 0, 0);
  }
  const unit = randomUnitVector(randomFn);
  const t = randomFn();
  const magnitude = range.min + (range.max - range.min) * t;
  return unit.multiplyScalar(magnitude);
}

/**
 * Подбирает диапазон по типу материала и генерирует угловую скорость.
 * Плоские фрагменты (face) получают больший диапазон по умолчанию.
 */
export function generateAngularVelocity(
  materialId: FragmentMaterialId,
  config: AngularVelocityConfig = {}
): Vector3 {
  const range = config.ranges?.[materialId] ?? DEFAULT_ANGULAR_RANGES[materialId];
  const mass = Math.max(0.05, config.mass ?? 1);
  const scale = 1 / Math.pow(mass, 0.35); // heavier -> slower spin
  return randomVectorWithinSphere(
    { min: range.min * scale, max: range.max * scale },
    config.randomFn ?? Math.random
  );
}
