import { describe, expect, it } from 'vitest';
import { computeHallLayout, createDefaultHallLayoutConfig } from '../hallLayout';

describe('hallLayout (15.1.2)', () => {
  it('base case keeps hall outside camera/tower and platform inside hall', () => {
    const cfg = {
      cameraInnerMargin: 1,
      towerInnerMargin: 0.5,
      shellThickness: 0.5,
      platformWallGap: 0.25,
    };
    const res = computeHallLayout({ towerOuterRadius: 5, cameraOrbitRadius: 7 }, cfg);
    expect(res.hallInnerRadius).toBeGreaterThan(7 + 0.999);
    expect(res.hallInnerRadius).toBeGreaterThan(5 + 0.499);
    expect(res.hallOuterRadius).toBeCloseTo(res.hallInnerRadius + 0.5);
    expect(res.platformOuterRadius).toBeGreaterThanOrEqual(5 + 0.01);
    expect(res.platformOuterRadius).toBeLessThan(res.hallInnerRadius);
  });

  it('prefers max between tower and camera constraints', () => {
    const cfg = {
      cameraInnerMargin: 0.8,
      towerInnerMargin: 1.4,
      shellThickness: 0.6,
      platformWallGap: 0.5,
    };
    const result = computeHallLayout({ towerOuterRadius: 6, cameraOrbitRadius: 4 }, cfg);
    // tower drives because camera + margin is smaller
    expect(result.hallInnerRadius).toBeCloseTo(7.4);
    expect(result.platformOuterRadius).toBeGreaterThanOrEqual(6.01);
    expect(result.platformOuterRadius).toBeLessThan(result.hallInnerRadius);
  });

  it('builds default config from blockSize', () => {
    const cfg = createDefaultHallLayoutConfig(2);
    expect(cfg.cameraInnerMargin).toBeCloseTo(2);
    expect(cfg.towerInnerMargin).toBeCloseTo(1.5);
    expect(cfg.shellThickness).toBeCloseTo(2.5);
    expect(cfg.platformWallGap).toBeCloseTo(0.7);
  });
});
