export function clampToLockBounds(elapsed: number, delay: number): number {
  if (delay <= 0) {
    return 0;
  }
  if (elapsed < 0) {
    return 0;
  }
  if (elapsed > delay) {
    return delay;
  }
  return elapsed;
}
