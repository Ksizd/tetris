export interface LifetimeConfig {
  minMs?: number;
  maxMs?: number;
  randomFn?: () => number;
}

const DEFAULT_LIFETIME_MIN = 1000;
const DEFAULT_LIFETIME_MAX = 2000;

function validateRange(minMs: number, maxMs: number): void {
  if (minMs <= 0 || maxMs <= 0 || maxMs < minMs) {
    throw new Error('lifetimeMs range must be positive and maxMs >= minMs');
  }
}

export function generateLifetimeMs(config: LifetimeConfig = {}): number {
  const minMs = config.minMs ?? DEFAULT_LIFETIME_MIN;
  const maxMs = config.maxMs ?? DEFAULT_LIFETIME_MAX;
  validateRange(minMs, maxMs);
  if (maxMs === minMs) {
    return minMs;
  }
  const rnd = config.randomFn ?? Math.random;
  const t = rnd();
  return minMs + (maxMs - minMs) * t;
}
