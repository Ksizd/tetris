import { describe, expect, it } from 'vitest';
import { createRenderConfig } from '../renderConfig';

describe('environment config', () => {
  it('enables HDRI environment by default without forcing background', () => {
    const { environment } = createRenderConfig();

    expect(environment.enabled).toBe(true);
    expect(environment.useAsBackground).toBe(false);
    expect(environment.intensity).toBeGreaterThan(0);
  });

  it('derives golden hall steps/segments from quality defaults', () => {
    const ultra = createRenderConfig({ quality: { level: 'ultra' } });
    expect(ultra.goldenHall.steps).toBeGreaterThan(0);
    expect(ultra.goldenHall.wallCurvatureSegments).toBeGreaterThanOrEqual(64);

    const medium = createRenderConfig({ quality: { level: 'medium' } });
    expect(medium.goldenHall.steps).toBeLessThanOrEqual(ultra.goldenHall.steps);
    expect(medium.goldenHall.wallCurvatureSegments).toBeLessThan(ultra.goldenHall.wallCurvatureSegments);

    const overridden = createRenderConfig({
      quality: { level: 'ultra' },
      goldenHall: { steps: 6, wallCurvatureSegments: 72 },
    });
    expect(overridden.goldenHall.steps).toBe(6);
    expect(overridden.goldenHall.wallCurvatureSegments).toBe(72);
  });
});
