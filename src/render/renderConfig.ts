import * as THREE from 'three';
import { DEFAULT_BOARD_DIMENSIONS } from '../core/constants';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig, createBoardRenderConfig } from './boardConfig';
import {
  computeCameraPlacement,
  DEFAULT_CAMERA_FOV,
  DEFAULT_CAMERA_ANGLE,
  DEFAULT_CAMERA_HEIGHT_RATIO,
  DEFAULT_TARGET_HEIGHT_RATIO,
} from './cameraSetup';

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
  shadow?: DirectionalLightShadowConfig;
}

export interface DirectionalLightShadowConfig {
  mapSize: number;
  radius: number;
  bias: number;
  normalBias: number;
  cameraNear: number;
  cameraFar: number;
  cameraMargin: number;
}

export interface LightRigConfig {
  ambient: AmbientLightConfig;
  hemisphere: HemisphereLightConfig;
  key: DirectionalLightConfig;
  rim: DirectionalLightConfig;
  fill?: DirectionalLightConfig;
}

export type ToneMappingMode = 'aces' | 'reinhard' | 'none';

export interface ToneMappingConfig {
  mode: ToneMappingMode;
  exposure: number;
}

export interface PostProcessingConfig {
  bloom: boolean;
  toneMapping: ToneMappingConfig;
}

export interface EnvironmentConfig {
  enabled: boolean;
  useAsBackground: boolean;
  intensity: number;
}

export interface RenderConfig {
  boardDimensions: BoardDimensions;
  board: BoardRenderConfig;
  camera: CameraConfig;
  cameraMotion: CameraMotionConfig;
  lights: LightRigConfig;
  postProcessing: PostProcessingConfig;
  environment: EnvironmentConfig;
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
  postProcessing?: PostProcessingOverrides;
  environment?: Partial<EnvironmentConfig>;
}

export interface PartialLightRigConfig {
  ambient?: Partial<AmbientLightConfig>;
  hemisphere?: Partial<HemisphereLightConfig>;
  key?: Partial<DirectionalLightConfig>;
  rim?: Partial<DirectionalLightConfig>;
  fill?: Partial<DirectionalLightConfig>;
}

export interface PostProcessingOverrides {
  bloom?: boolean;
  toneMapping?: Partial<ToneMappingConfig>;
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
  const computedPlacement = computeCameraPlacement(boardDimensions, board, {
    fovDeg: cameraFov,
    angleRadians: DEFAULT_CAMERA_ANGLE,
    cameraHeightRatio: DEFAULT_CAMERA_HEIGHT_RATIO,
    targetHeightRatio: DEFAULT_TARGET_HEIGHT_RATIO,
  });
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
      shadow: {
        mapSize: overrides.lights?.key?.shadow?.mapSize ?? defaultLights.key.shadow?.mapSize ?? 2048,
        radius: overrides.lights?.key?.shadow?.radius ?? defaultLights.key.shadow?.radius ?? 1.5,
        bias: overrides.lights?.key?.shadow?.bias ?? defaultLights.key.shadow?.bias ?? -0.00025,
        normalBias:
          overrides.lights?.key?.shadow?.normalBias ?? defaultLights.key.shadow?.normalBias ?? 0.02,
        cameraNear:
          overrides.lights?.key?.shadow?.cameraNear ?? defaultLights.key.shadow?.cameraNear ?? 1.0,
        cameraFar:
          overrides.lights?.key?.shadow?.cameraFar ?? defaultLights.key.shadow?.cameraFar ?? 50,
        cameraMargin:
          overrides.lights?.key?.shadow?.cameraMargin ??
          defaultLights.key.shadow?.cameraMargin ??
          2.5,
      },
    },
    rim: {
      color: overrides.lights?.rim?.color ?? defaultLights.rim.color,
      intensity: overrides.lights?.rim?.intensity ?? defaultLights.rim.intensity,
      position: (overrides.lights?.rim?.position ?? defaultLights.rim.position).clone(),
      target: (overrides.lights?.rim?.target ?? defaultLights.rim.target)?.clone(),
      castShadow: overrides.lights?.rim?.castShadow ?? defaultLights.rim.castShadow,
      shadow: defaultLights.rim.shadow,
    },
  };

  const postProcessing: PostProcessingConfig = {
    bloom: overrides.postProcessing?.bloom ?? false,
    toneMapping: {
      mode: overrides.postProcessing?.toneMapping?.mode ?? 'aces',
      exposure: overrides.postProcessing?.toneMapping?.exposure ?? 1.05,
    },
  };

  const environment: EnvironmentConfig = {
    enabled: overrides.environment?.enabled ?? true,
    useAsBackground: overrides.environment?.useAsBackground ?? true,
    intensity: overrides.environment?.intensity ?? 1.25,
  };

  return {
    boardDimensions,
    board,
    camera,
    cameraMotion,
    lights,
    postProcessing,
    environment,
  };
}

function createDefaultLights(camera: CameraConfig): LightRigConfig {
  const keyPosition = camera.position
    .clone()
    .multiply(new THREE.Vector3(0.32, 0.95, 0.38)); // slightly higher/front-side
  const rimPosition = camera.position.clone().multiply(new THREE.Vector3(-0.8, 0.9, -0.8));
  return {
    hemisphere: {
      skyColor: 0xfff8e1,
      groundColor: 0x2a1a0a,
      intensity: 0.55,
    },
    ambient: {
      color: 0xffffff,
      intensity: 0.22,
    },
    key: {
      color: 0xffefdb,
      intensity: 2.1,
      position: keyPosition,
      target: camera.target.clone(),
      castShadow: true,
      shadow: {
        mapSize: 4096,
        radius: 2.4,
        bias: -0.00018,
        normalBias: 0.012,
        cameraNear: 0.6,
        cameraFar: 60,
        cameraMargin: 3.5,
      },
    },
    rim: {
      color: 0xb7d5ff,
      intensity: 0.6,
      position: rimPosition,
      target: camera.target.clone(),
      castShadow: false,
      shadow: undefined,
    },
    fill: {
      color: 0xe5ecfa,
      intensity: 0.65,
      position: camera.target.clone().add(new THREE.Vector3(-2.5, 1.2, -3.5)),
      target: camera.target.clone(),
      castShadow: false,
      shadow: undefined,
    },
  };
}

function normalizeFov(fov: number): number {
  if (!Number.isFinite(fov)) {
    return DEFAULT_CAMERA_FOV;
  }
  return Math.min(85, Math.max(25, fov));
}
