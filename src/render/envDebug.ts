import * as THREE from 'three';
import { RenderContext } from './renderer';
import { EnvironmentConfig } from './renderConfig';
import { createEnvironmentMap } from './environmentMap';

export type EnvDebugMode = 'full' | 'lightsOnly' | 'envOnly' | 'hallOnly' | 'noHall';

export function deriveEnvOverrides(mode: EnvDebugMode): Partial<EnvironmentConfig> {
  if (mode === 'lightsOnly') {
    return { enabled: false };
  }
  return {};
}

export function applyEnvDebugMode(ctx: RenderContext, mode: EnvDebugMode): void {
  if (mode === 'lightsOnly') {
    ctx.scene.environment = null;
    if (ctx.environment?.backgroundTexture && ctx.renderConfig.environment.useAsBackground) {
      ctx.scene.background = null;
    }
    return;
  }

  if (mode === 'envOnly') {
    ctx.scene.traverse((obj) => {
      const light = obj as THREE.Light;
      if (light.isLight) {
        light.visible = false;
      }
    });
    ctx.scene.environment = ctx.environment?.environmentMap ?? null;
    if (ctx.environment?.backgroundTexture && ctx.renderConfig.environment.useAsBackground) {
      ctx.scene.background = ctx.environment.backgroundTexture;
    }
    return;
  }

  // full / hallOnly / noHall
  ctx.scene.traverse((obj) => {
    const light = obj as THREE.Light;
    if (light.isLight) {
      light.visible = true;
    }
  });
  if (!ctx.environment && ctx.renderConfig.environment.enabled) {
    const env = createEnvironmentMap(ctx.renderer, ctx.renderConfig.environment);
    if (env) {
      ctx.environment = env;
      ctx.scene.environment = env.environmentMap;
      if (env.backgroundTexture && ctx.renderConfig.environment.useAsBackground) {
        ctx.scene.background = env.backgroundTexture;
      }
    }
  } else {
    ctx.scene.environment = ctx.environment?.environmentMap ?? null;
    if (ctx.environment?.backgroundTexture && ctx.renderConfig.environment.useAsBackground) {
      ctx.scene.background = ctx.environment.backgroundTexture;
    }
  }
}
