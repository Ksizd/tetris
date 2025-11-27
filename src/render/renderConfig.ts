import * as THREE from 'three';
import { DEFAULT_BOARD_DIMENSIONS } from '../core/constants';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig, createBoardRenderConfig } from './boardConfig';
import { computeCameraPlacement, DEFAULT_CAMERA_FOV } from './cameraSetup';

export interface CameraConfig {
  fov: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface AmbientLightConfig {
  color: THREE.ColorRepresentation;
  intensity: number;
}

export interface HemisphereLightConfig {
  skyColor: THREE.ColorRepresentation;
  groundColor: THREE.ColorRepresentation;
  intensity: number;
}

export interface DirectionalLightConfig {
  color: THREE.ColorRepresentation;
  intensity: number;
  position: THREE.Vector3;
  target?: THREE.Vector3;
  castShadow?: boolean;
}

export interface LightRigConfig {
  ambient: AmbientLightConfig;
  hemisphere: HemisphereLightConfig;
  key: DirectionalLightConfig;
}

export interface PostProcessingConfig {
  bloom: boolean;
}

export interface RenderConfig {
  boardDimensions: BoardDimensions;
  board: BoardRenderConfig;
  camera: CameraConfig;
  cameraMotion: CameraMotionConfig;
  lights: LightRigConfig;
  postProcessing: PostProcessingConfig;
}

export interface RenderConfigOverrides {
  boardDimensions?: Partial<BoardDimensions>;
  /**
   * Convenience alias to override boardDimensions.width without touching height.
   */
  boardWidth?: number;
  board?: Partial<BoardRenderConfig>;
  camera?: Partial<CameraConfig>;
  cameraMotion?: Partial<CameraMotionConfig>;
  lights?: PartialLightRigConfig;
  postProcessing?: Partial<PostProcessingConfig>;
}

export interface PartialLightRigConfig {
  ambient?: Partial<AmbientLightConfig>;
  hemisphere?: Partial<HemisphereLightConfig>;
  key?: Partial<DirectionalLightConfig>;
}

export interface CameraMotionConfig {
  enabled: boolean;
  orbitAmplitude: number; // radians offset from base azimuth
  orbitSpeed: number; // radians per second
  heightAmplitudeRatio: number; // of tower height
  heightSpeed: number; // radians per second
  targetFollowRatio: number; // how much target follows height wobble
}

const DEFAULT_KEY_LIGHT_MULTIPLIER = new THREE.Vector3(0.4, 0.8, 0.4);

export function createRenderConfig(overrides: RenderConfigOverrides = {}): RenderConfig {
  const boardDimensions: BoardDimensions = {
    width: overrides.boardWidth ?? overrides.boardDimensions?.width ?? DEFAULT_BOARD_DIMENSIONS.width,
    height: overrides.boardDimensions?.height ?? DEFAULT_BOARD_DIMENSIONS.height,
  };

  const board = createBoardRenderConfig(boardDimensions, overrides.board);

  const cameraFov = normalizeFov(overrides.camera?.fov ?? DEFAULT_CAMERA_FOV);
  const computedPlacement = computeCameraPlacement(boardDimensions, board, { fovDeg: cameraFov });
  const cameraPosition = overrides.camera?.position ?? computedPlacement.position;
  const cameraTarget = overrides.camera?.target ?? computedPlacement.target;
  const camera: CameraConfig = {
    fov: cameraFov,
    position: cameraPosition.clone(),
    target: cameraTarget.clone(),
  };

  const cameraMotion: CameraMotionConfig = {
    enabled: overrides.cameraMotion?.enabled ?? true,
    orbitAmplitude: overrides.cameraMotion?.orbitAmplitude ?? 0.045, // ~2.5 degrees
    orbitSpeed: overrides.cameraMotion?.orbitSpeed ?? 0.12,
    heightAmplitudeRatio: overrides.cameraMotion?.heightAmplitudeRatio ?? 0.02,
    heightSpeed: overrides.cameraMotion?.heightSpeed ?? 0.16,
    targetFollowRatio: overrides.cameraMotion?.targetFollowRatio ?? 0.35,
  };

  const defaultLights = createDefaultLights(camera);
  const lights: LightRigConfig = {
    ambient: {
      color: overrides.lights?.ambient?.color ?? defaultLights.ambient.color,
      intensity: overrides.lights?.ambient?.intensity ?? defaultLights.ambient.intensity,
    },
    hemisphere: {
      skyColor: overrides.lights?.hemisphere?.skyColor ?? defaultLights.hemisphere.skyColor,
      groundColor: overrides.lights?.hemisphere?.groundColor ?? defaultLights.hemisphere.groundColor,
      intensity: overrides.lights?.hemisphere?.intensity ?? defaultLights.hemisphere.intensity,
    },
    key: {
      color: overrides.lights?.key?.color ?? defaultLights.key.color,
      intensity: overrides.lights?.key?.intensity ?? defaultLights.key.intensity,
      position: (overrides.lights?.key?.position ?? defaultLights.key.position).clone(),
      target: (overrides.lights?.key?.target ?? defaultLights.key.target)?.clone(),
      castShadow: overrides.lights?.key?.castShadow ?? defaultLights.key.castShadow,
    },
  };

  const postProcessing: PostProcessingConfig = {
    bloom: overrides.postProcessing?.bloom ?? false,
  };

  return {
    boardDimensions,
    board,
    camera,
    cameraMotion,
    lights,
    postProcessing,
  };
}

function createDefaultLights(camera: CameraConfig): LightRigConfig {
  const keyPosition = camera.position.clone().multiply(DEFAULT_KEY_LIGHT_MULTIPLIER);
  return {
    hemisphere: {
      skyColor: 0xfff8e1,
      groundColor: 0x2a1a0a,
      intensity: 0.55,
    },
    ambient: {
      color: 0xffffff,
      intensity: 0.25,
    },
    key: {
      color: 0xfff3cc,
      intensity: 0.9,
      position: keyPosition,
      target: camera.target.clone(),
      castShadow: false,
    },
  };
}

function normalizeFov(fov: number): number {
  if (!Number.isFinite(fov)) {
    return DEFAULT_CAMERA_FOV;
  }
  return Math.min(85, Math.max(25, fov));
}
