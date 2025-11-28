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

  const source = createStudioGradientTexture();
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

function createStudioGradientTexture(): THREE.Texture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to acquire 2D context for environment map');
  }

  // Base vertical gradient: warm top, dark bottom, neutral mid.
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#f7f0e3');
  gradient.addColorStop(0.35, '#e8e6e1');
  gradient.addColorStop(0.65, '#1b1d22');
  gradient.addColorStop(1, '#050607');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add soft horizontal streaks to create more interesting reflections.
  addBand(ctx, width, height, 0.18, 'rgba(255, 240, 210, 0.35)', 0.24);
  addBand(ctx, width, height, 0.42, 'rgba(200, 215, 255, 0.25)', 0.18);
  addBand(ctx, width, height, 0.68, 'rgba(120, 130, 150, 0.15)', 0.12);

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
