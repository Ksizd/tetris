import * as THREE from 'three';
import {
  DEFAULT_CAMERA_ANGLE,
  DEFAULT_CAMERA_FOV,
  DEFAULT_CAMERA_HEIGHT_RATIO,
  DEFAULT_TARGET_HEIGHT_RATIO,
} from './cameraSetup';
import { QualityLevel } from './renderConfig';

export const VISUAL_DEFAULTS = {
  quality: {
    level: 'ultra' as QualityLevel,
  },
  environment: {
    intensity: 1.25,
    resolution: 2048,
    useAsBackground: true,
    variant: 'studio' as const,
  },
  materials: {
    front: { roughness: 0.22, metalness: 0.04, envMapIntensity: 0.9 },
    side: { roughness: 0.28, metalness: 1.0, envMapIntensity: 1.8 },
  },
  lights: {
    ambient: { color: 0xffffff, intensity: 0.22 },
    hemisphere: { skyColor: 0xfff8e1, groundColor: 0x2a1a0a, intensity: 0.55 },
    key: {
      color: 0xffefdb,
      intensity: 2.1,
      positionMultiplier: new THREE.Vector3(0.32, 0.95, 0.38),
    },
    rim: {
      color: 0xb7d5ff,
      intensity: 0.6,
      positionMultiplier: new THREE.Vector3(-0.8, 0.9, -0.8),
    },
    fill: {
      color: 0xe5ecfa,
      intensity: 0.65,
    },
  },
  postProcessing: {
    bloom: { enabled: false, strength: 0.0, threshold: 1.1, radius: 0.6 },
    toneMapping: { mode: 'aces' as const, exposure: 1.05 },
    vignette: { enabled: false, offset: 1.0, darkness: 1.0 },
    colorGrade: {
      enabled: false,
      saturation: 1.0,
      contrast: 1.0,
      lift: 0.0,
      gamma: 1.0,
      gain: 1.0,
      warmShift: 0.0,
      coolShift: 0.0,
    },
    depthOfField: { enabled: false, focus: 24, aperture: 0.0003, maxBlur: 0.0045 },
    ssao: {
      enabled: false,
      kernelRadius: 16,
      minDistance: 0.0008,
      maxDistance: 0.18,
      intensity: 0.9,
      bias: 0.02,
    },
  },
  fog: { enabled: false, color: 0x000000, density: 0 },
  camera: {
    fov: DEFAULT_CAMERA_FOV,
    angleRadians: DEFAULT_CAMERA_ANGLE,
    cameraHeightRatio: DEFAULT_CAMERA_HEIGHT_RATIO,
    targetHeightRatio: DEFAULT_TARGET_HEIGHT_RATIO,
  },
  bevel: {
    smoothness: 3,
  },
};
