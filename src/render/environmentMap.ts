import * as THREE from 'three';
import { EnvironmentConfig } from './renderConfig';

export interface EnvironmentMapResources {
  environmentMap: THREE.Texture;
  backgroundTexture?: THREE.Texture;
  dispose: () => void;
}

export function createEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  config: EnvironmentConfig
): EnvironmentMapResources | null {
  if (!config.enabled) {
    return null;
  }

  const source =
    config.variant === 'ultra2'
      ? createCinematicPanelTexture(config.resolution, config.intensity)
      : createStudioGradientTexture(config.resolution);
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const renderTarget = pmremGenerator.fromEquirectangular(source);
  pmremGenerator.dispose();

  const environmentMap = renderTarget.texture;
  environmentMap.needsUpdate = true;

  // Optionally keep the unfiltered equirectangular texture as background.
  const backgroundTexture = config.useAsBackground ? source : undefined;
  if (!backgroundTexture) {
    source.dispose();
  }

  const dispose = () => {
    environmentMap.dispose();
    renderTarget.dispose();
    backgroundTexture?.dispose();
  };

  return { environmentMap, backgroundTexture, dispose };
}

function createStudioGradientTexture(resolution = 1024): THREE.Texture {
  const width = Math.max(256, Math.floor(resolution));
  const height = Math.max(128, Math.floor(width / 2));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to acquire 2D context for environment map');
  }

  // Base vertical gradient: bright studio top, soft neutral mid, grounded dark base.
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#fbf7ef');
  gradient.addColorStop(0.25, '#f0f2f7');
  gradient.addColorStop(0.55, '#cfd5df');
  gradient.addColorStop(0.75, '#1a1d22');
  gradient.addColorStop(1, '#060708');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Horizontal bands emulate softboxes / panels at different heights.
  addBand(ctx, width, height, 0.18, 'rgba(255, 245, 225, 0.45)', 0.26);
  addBand(ctx, width, height, 0.38, 'rgba(210, 225, 255, 0.32)', 0.16);
  addBand(ctx, width, height, 0.58, 'rgba(160, 175, 195, 0.18)', 0.14);

  // Vertical panels for richer reflections.
  addPanel(ctx, width, height, 0.15, 0.22, 'rgba(255, 250, 235, 0.55)');
  addPanel(ctx, width, height, 0.5, 0.16, 'rgba(255, 245, 215, 0.6)');
  addPanel(ctx, width, height, 0.82, 0.18, 'rgba(220, 235, 255, 0.45)');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.generateMipmaps = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;

  return texture;
}

function createCinematicPanelTexture(resolution = 2048, intensity = 1): THREE.Texture {
  const width = Math.max(512, Math.floor(resolution));
  const height = Math.max(256, Math.floor(width / 2));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to acquire 2D context for environment map');
  }

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#f5f8ff');
  base.addColorStop(0.32, '#e1e6ef');
  base.addColorStop(0.58, '#8e98ab');
  base.addColorStop(0.78, '#0f1219');
  base.addColorStop(1, '#030407');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Horizon and vertical accents.
  addBand(ctx, width, height, 0.42, `rgba(255, 246, 232, ${0.18 * intensity})`, 0.18);
  addBand(ctx, width, height, 0.62, `rgba(160, 184, 220, ${0.16 * intensity})`, 0.2);
  addPanel(ctx, width, height, 0.12, 0.12, `rgba(250, 244, 234, ${0.32 * intensity})`);
  addPanel(ctx, width, height, 0.36, 0.1, `rgba(224, 234, 248, ${0.25 * intensity})`);
  addPanel(ctx, width, height, 0.62, 0.12, `rgba(210, 228, 255, ${0.34 * intensity})`);
  addPanel(ctx, width, height, 0.84, 0.15, `rgba(245, 250, 255, ${0.22 * intensity})`);

  // Hero panels: top-left warm and rear cool.
  addEllipticalGlow(
    ctx,
    width,
    height,
    0.2,
    0.22,
    0.62,
    0.48,
    `rgba(255, 248, 233, ${0.72 * intensity})`
  );
  addEllipticalGlow(
    ctx,
    width,
    height,
    0.78,
    0.36,
    0.48,
    0.42,
    `rgba(213, 233, 255, ${0.64 * intensity})`
  );
  addEllipticalGlow(
    ctx,
    width,
    height,
    0.52,
    0.12,
    0.36,
    0.28,
    `rgba(255, 255, 255, ${0.28 * intensity})`
  );

  // Subtle vignette to keep focus near center.
  addCornerShade(ctx, width, height, 0.12);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.generateMipmaps = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function addBand(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  center: number,
  color: string,
  thicknessRatio: number
): void {
  const thickness = height * thicknessRatio;
  const y = height * center - thickness * 0.5;
  const grad = ctx.createLinearGradient(0, y, 0, y + thickness);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y, width, thickness);
}

function addPanel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  panelWidthRatio: number,
  color: string
): void {
  const panelWidth = width * panelWidthRatio;
  const x = width * centerX - panelWidth * 0.5;
  const grad = ctx.createLinearGradient(x, 0, x + panelWidth, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, 0, panelWidth, height);
}

function addEllipticalGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: string
): void {
  ctx.save();
  ctx.translate(width * centerX, height * centerY);
  ctx.scale(width * radiusX, height * radiusY);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function addCornerShade(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number
): void {
  const radial = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.2,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72
  );
  radial.addColorStop(0, 'rgba(0,0,0,0)');
  radial.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);
}
