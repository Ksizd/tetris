import * as THREE from 'three';
import {
  DEFAULT_CAMERA_ANGLE,
  DEFAULT_CAMERA_FOV,
  DEFAULT_CAMERA_HEIGHT_RATIO,
  DEFAULT_TARGET_HEIGHT_RATIO,
} from './cameraSetup';
import type { CameraGameMode, GoldenHallConfig, QualityLevel } from './renderConfig';

const GOLDEN_HALL_DEFAULTS: Record<QualityLevel, GoldenHallConfig> = {
  ultra: {
    enabled: true,
    baseRadiusMargin: 3.2,
    hallRadiusMargin: 8.5,
    baseHeight: 7.5,
    steps: 4,
    baseStepCount: 4,
    baseStepInsetRatio: 0.12,
    wallHeight: 38,
    wallCurvatureSegments: 128,
    useDustFx: true,
    useLightShafts: true,
  },
  ultra2: {
    enabled: true,
    baseRadiusMargin: 3.2,
    hallRadiusMargin: 8.5,
    baseHeight: 7.5,
    steps: 4,
    baseStepCount: 4,
    baseStepInsetRatio: 0.12,
    wallHeight: 38,
    wallCurvatureSegments: 128,
    useDustFx: true,
    useLightShafts: true,
  },
  medium: {
    enabled: true,
    baseRadiusMargin: 2.8,
    hallRadiusMargin: 7.5,
    baseHeight: 6.2,
    steps: 2,
    baseStepCount: 2,
    baseStepInsetRatio: 0.1,
    wallHeight: 32,
    wallCurvatureSegments: 64,
    useDustFx: true,
    useLightShafts: false,
  },
  low: {
    enabled: true,
    baseRadiusMargin: 2.4,
    hallRadiusMargin: 6.0,
    baseHeight: 5.4,
    steps: 1,
    baseStepCount: 1,
    baseStepInsetRatio: 0.08,
    wallHeight: 26,
    wallCurvatureSegments: 32,
    useDustFx: false,
    useLightShafts: false,
  },
};

export const VISUAL_DEFAULTS = {
  quality: {
    level: 'ultra' as QualityLevel,
  },
  goldenHall: GOLDEN_HALL_DEFAULTS,
  environment: {
    intensity: 1.1,
    resolution: 2048,
    useAsBackground: false,
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
      color: 0xfff1c4,
      intensity: 2.35,
      positionMultiplier: new THREE.Vector3(0.32, 0.95, 0.38),
    },
    rim: {
      color: 0xb7d5ff,
      intensity: 0.55,
      positionMultiplier: new THREE.Vector3(-0.8, 0.9, -0.8),
    },
    fill: {
      color: 0xe8f1ff,
      intensity: 0.55,
    },
  },
  postProcessing: {
    bloom: { enabled: true, strength: 1.0, threshold: 1.15, radius: 0.7 },
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
  fog: { enabled: true, color: 0x050608, density: 0.006 },
  camera: {
    fov: DEFAULT_CAMERA_FOV,
    angleRadians: DEFAULT_CAMERA_ANGLE,
    cameraHeightRatio: DEFAULT_CAMERA_HEIGHT_RATIO,
    targetHeightRatio: DEFAULT_TARGET_HEIGHT_RATIO,
    gameMode: 'followPiece' as CameraGameMode,
  },
  bevel: {
    smoothness: 3,
  },
};
