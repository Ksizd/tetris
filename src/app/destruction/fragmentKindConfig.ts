import { FragmentKind } from './cubeDestructionSim';

export interface FragmentKindInitialConfig {
  radialSpeed: [number, number]; // multiplier
  tangentialSpeed: [number, number]; // multiplier
  verticalSpeed: [number, number]; // multiplier
  lifetimeMs: [number, number]; // multiplier
  scaleJitter: [number, number]; // multiplier
  rotationJitterRad: number; // max random angle in radians
  colorTint: [number, number]; // multiplier
  linearDragMultiplier: number;
  angularDragMultiplier: number;
}

export const FRAGMENT_KIND_INITIAL_CONFIG: Record<FragmentKind, FragmentKindInitialConfig> = {
  faceShard: {
    radialSpeed: [0.9, 1.05],
    tangentialSpeed: [1.05, 1.2],
    verticalSpeed: [0.9, 1.05],
    lifetimeMs: [1.05, 1.2],
    scaleJitter: [0.9, 1.1],
    rotationJitterRad: 0.18,
    colorTint: [0.95, 1.05],
    linearDragMultiplier: 1,
    angularDragMultiplier: 1,
  },
  edgeShard: {
    radialSpeed: [0.8, 0.95],
    tangentialSpeed: [0.9, 1.05],
    verticalSpeed: [0.9, 1.05],
    lifetimeMs: [1.1, 1.25],
    scaleJitter: [0.9, 1.12],
    rotationJitterRad: 0.22,
    colorTint: [0.94, 1.06],
    linearDragMultiplier: 0.95,
    angularDragMultiplier: 1,
  },
  coreShard: {
    radialSpeed: [0.6, 0.8],
    tangentialSpeed: [0.8, 0.95],
    verticalSpeed: [0.85, 1.0],
    lifetimeMs: [1.2, 1.35],
    scaleJitter: [0.92, 1.18],
    rotationJitterRad: 0.25,
    colorTint: [0.92, 1.05],
    linearDragMultiplier: 0.75,
    angularDragMultiplier: 0.8,
  },
  dust: {
    radialSpeed: [1.1, 1.3],
    tangentialSpeed: [1.1, 1.3],
    verticalSpeed: [1.05, 1.2],
    lifetimeMs: [0.75, 0.95],
    scaleJitter: [0.85, 1.15],
    rotationJitterRad: 0.5,
    colorTint: [0.98, 1.08],
    linearDragMultiplier: 1.35,
    angularDragMultiplier: 1.2,
  },
};
