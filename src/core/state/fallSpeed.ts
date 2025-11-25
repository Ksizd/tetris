export interface FallSpeedParams {
  baseIntervalMs: number;
  decayPerLevel: number;
  minIntervalMs: number;
}

export const DEFAULT_FALL_SPEED: FallSpeedParams = Object.freeze({
  baseIntervalMs: 1000,
  decayPerLevel: 0.92,
  minIntervalMs: 50,
});

export function getFallIntervalMs(level: number, params: FallSpeedParams): number {
  const levelIndex = Math.max(0, level - 1);
  const interval = params.baseIntervalMs * Math.pow(params.decayPerLevel, levelIndex);
  return Math.max(params.minIntervalMs, Math.floor(interval));
}
