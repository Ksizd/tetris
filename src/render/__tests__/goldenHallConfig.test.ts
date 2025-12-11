import { describe, expect, it } from 'vitest';
import { createRenderConfig } from '../renderConfig';

describe('golden hall FX switches', () => {
  it('disables all FX on low even if overrides ask for them', () => {
    const cfg = createRenderConfig({
      quality: { level: 'low' },
      goldenHall: { useDustFx: true, useLightShafts: true },
    });

    expect(cfg.goldenHall.useDustFx).toBe(false);
    expect(cfg.goldenHall.useLightShafts).toBe(false);
  });

  it('keeps a single FX on medium by default and clamps dual overrides', () => {
    const mediumDefault = createRenderConfig({ quality: { level: 'medium' } });
    expect(mediumDefault.goldenHall.useDustFx).toBe(true);
    expect(mediumDefault.goldenHall.useLightShafts).toBe(false);

    const mediumOverrideBoth = createRenderConfig({
      quality: { level: 'medium' },
      goldenHall: { useDustFx: true, useLightShafts: true },
    });
    expect(mediumOverrideBoth.goldenHall.useDustFx).toBe(true);
    expect(mediumOverrideBoth.goldenHall.useLightShafts).toBe(false);
  });

  it('allows opting into shafts-only on medium when dust is off', () => {
    const mediumShaftsOnly = createRenderConfig({
      quality: { level: 'medium' },
      goldenHall: { useDustFx: false, useLightShafts: true },
    });
    expect(mediumShaftsOnly.goldenHall.useDustFx).toBe(false);
    expect(mediumShaftsOnly.goldenHall.useLightShafts).toBe(true);
  });
});
