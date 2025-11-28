import { describe, expect, it } from 'vitest';
import { createRenderConfig } from '../renderConfig';

describe('environment config', () => {
  it('enables HDRI environment by default without forcing background', () => {
    const { environment } = createRenderConfig();

    expect(environment.enabled).toBe(true);
    expect(environment.useAsBackground).toBe(false);
    expect(environment.intensity).toBeGreaterThan(0);
  });
});
