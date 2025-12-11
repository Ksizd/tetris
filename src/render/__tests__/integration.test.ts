import { describe, expect, it } from 'vitest';
import { createRenderConfig } from '../renderConfig';
import { VISUAL_DEFAULTS } from '../visualDefaults';

describe('integration: render config + golden hall', () => {
  it('includes enabled Golden Hall for ultra quality with defaults', () => {
    const cfg = createRenderConfig({ quality: { level: 'ultra' } });
    expect(cfg.goldenHall.enabled).toBe(true);
    expect(cfg.goldenHall.steps).toBe(VISUAL_DEFAULTS.goldenHall.ultra.steps);
    expect(cfg.goldenHall.wallCurvatureSegments).toBe(
      VISUAL_DEFAULTS.goldenHall.ultra.wallCurvatureSegments
    );
  });

  it('honors low quality defaults disabling FX', () => {
    const cfg = createRenderConfig({ quality: { level: 'low' } });
    expect(cfg.goldenHall.enabled).toBe(true);
    expect(cfg.goldenHall.useDustFx).toBe(false);
    expect(cfg.goldenHall.useLightShafts).toBe(false);
  });
});
