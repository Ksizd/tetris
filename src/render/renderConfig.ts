import * as THREE from 'three';
import { DEFAULT_BOARD_DIMENSIONS } from '../core/constants';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig, createBoardRenderConfig } from './boardConfig';
import {
  DEFAULT_CAMERA_FOV,
  computeGameCameraPose,
  computeTowerHeight,
} from './cameraSetup';
import { VISUAL_DEFAULTS } from './visualDefaults';
import { getTowerBounds } from './towerBounds';

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

export type LightType = 'directional' | 'spot' | 'point';

export interface DirectionalLightConfig {
  type?: LightType;
  color: THREE.ColorRepresentation;
  intensity: number;
  position: THREE.Vector3;
  target?: THREE.Vector3;
  castShadow?: boolean;
  shadow?: DirectionalLightShadowConfig;
  angle?: number;
  penumbra?: number;
  distance?: number;
  decay?: number;
  width?: number;
  height?: number;
}

export interface DirectionalLightShadowConfig {
  mapSize: number;
  radius: number;
  bias: number;
  normalBias: number;
  cameraNear: number;
  cameraFar: number;
  cameraMargin: number;
  cameraFov?: number;
}

export interface RingLightBandConfig {
  count: number;
  radius: number;
  height: number;
  angleDown: number;
  penumbra: number;
  spread: number;
  color: THREE.ColorRepresentation;
  colorVariance?: number;
  intensity: number;
  distance?: number;
  decay?: number;
  castShadow?: boolean;
}

export interface LightRigConfig {
  ambient: AmbientLightConfig;
  hemisphere: HemisphereLightConfig;
  key: DirectionalLightConfig;
  rim: DirectionalLightConfig;
  fill?: DirectionalLightConfig;
  top?: DirectionalLightConfig;
  ringBands?: RingLightBandConfig[];
  accents?: DirectionalLightConfig[];
}

export type ToneMappingMode = 'aces' | 'reinhard' | 'none';

export interface ToneMappingConfig {
  mode: ToneMappingMode;
  exposure: number;
}

export interface BloomConfig {
  enabled: boolean;
  strength: number;
  threshold: number;
  radius: number;
}

export interface VignetteConfig {
  enabled: boolean;
  offset: number;
  darkness: number;
}

export interface ColorGradeConfig {
  enabled: boolean;
  saturation: number;
  contrast: number;
  lift: number;
  gamma: number;
  gain: number;
  warmShift: number;
  coolShift: number;
}

export interface DepthOfFieldConfig {
  enabled: boolean;
  focus: number;
  aperture: number;
  maxBlur: number;
}

export interface SsaoConfig {
  enabled: boolean;
  kernelRadius: number;
  minDistance: number;
  maxDistance: number;
  intensity: number;
  bias: number;
}

export interface PostProcessingConfig {
  bloom: BloomConfig;
  toneMapping: ToneMappingConfig;
  vignette: VignetteConfig;
  colorGrade: ColorGradeConfig;
  depthOfField: DepthOfFieldConfig;
  ssao: SsaoConfig;
}

export interface MaterialLayerConfig {
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
}

export interface MaterialConfig {
  front: MaterialLayerConfig;
  side: MaterialLayerConfig;
}

export interface FogConfig {
  enabled: boolean;
  color: THREE.ColorRepresentation;
  density: number;
}

export interface EnvironmentConfig {
  enabled: boolean;
  useAsBackground: boolean;
  intensity: number;
  resolution: number;
  variant?: 'studio' | 'ultra2';
}

export type RenderModeKind = 'game' | 'visualDebug' | 'textureProbe';

export interface RenderModeConfig {
  kind: RenderModeKind;
  showGuides: boolean;
  showDebugRing: boolean;
  showColliders: boolean;
}

export interface RenderConfig {
  boardDimensions: BoardDimensions;
  board: BoardRenderConfig;
  materials: MaterialConfig;
  camera: CameraConfig;
  cameraMotion: CameraMotionConfig;
  lights: LightRigConfig;
  postProcessing: PostProcessingConfig;
  environment: EnvironmentConfig;
  fog: FogConfig;
  quality: QualityConfig;
  renderMode: RenderModeConfig;
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
  materials?: Partial<MaterialConfig>;
  fog?: Partial<FogConfig>;
  quality?: Partial<QualityConfig>;
  renderMode?: Partial<RenderModeConfig>;
}

export interface PartialLightRigConfig {
  ambient?: Partial<AmbientLightConfig>;
  hemisphere?: Partial<HemisphereLightConfig>;
  key?: Partial<DirectionalLightConfig>;
  rim?: Partial<DirectionalLightConfig>;
  fill?: Partial<DirectionalLightConfig>;
  top?: Partial<DirectionalLightConfig>;
  ringBands?: RingLightBandConfig[];
  accents?: Partial<DirectionalLightConfig>[];
}

export interface PostProcessingOverrides {
  bloom?: Partial<BloomConfig> | boolean;
  toneMapping?: Partial<ToneMappingConfig>;
  vignette?: Partial<VignetteConfig>;
  colorGrade?: Partial<ColorGradeConfig>;
  depthOfField?: Partial<DepthOfFieldConfig>;
  ssao?: Partial<SsaoConfig>;
}

export interface CameraMotionConfig {
  enabled: boolean;
  orbitAmplitude: number; // radians offset from base azimuth
  orbitSpeed: number; // radians per second
  heightAmplitudeRatio: number; // of tower height
  heightSpeed: number; // radians per second
  targetFollowRatio: number; // how much target follows height wobble
}

export type QualityLevel = 'ultra' | 'medium' | 'low' | 'ultra2';

export interface QualityConfig {
  level: QualityLevel;
  shadowMapSize: number;
  envResolution: number;
}

const RENDER_MODE_DEFAULTS: Record<RenderModeKind, Omit<RenderModeConfig, 'kind'>> = {
  game: { showGuides: false, showDebugRing: false, showColliders: false },
  visualDebug: { showGuides: true, showDebugRing: true, showColliders: true },
  textureProbe: { showGuides: false, showDebugRing: false, showColliders: false },
};

export function createRenderConfig(
  overrides: RenderConfigOverrides = {},
  viewportAspect = 16 / 9
): RenderConfig {
  const quality = resolveQuality(overrides.quality?.level ?? VISUAL_DEFAULTS.quality.level);
  const boardDimensions: BoardDimensions = {
    width:
      overrides.boardWidth ?? overrides.boardDimensions?.width ?? DEFAULT_BOARD_DIMENSIONS.width,
    height: overrides.boardDimensions?.height ?? DEFAULT_BOARD_DIMENSIONS.height,
  };

  const board = createBoardRenderConfig(boardDimensions, overrides.board);

  const bounds = getTowerBounds(boardDimensions, board);
  const pose = computeGameCameraPose(bounds, viewportAspect, { fovDeg: VISUAL_DEFAULTS.camera.fov });
  const cameraFov = normalizeFov(overrides.camera?.fov ?? pose.fov);
  const cameraPosition = overrides.camera?.position ?? pose.position;
  const cameraTarget = overrides.camera?.target ?? pose.target;
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

  const materials = mergeMaterialConfig(VISUAL_DEFAULTS.materials, overrides.materials);

  const defaultLights = createDefaultLights(camera, quality);
  const lights: LightRigConfig = {
    ambient: {
      color: overrides.lights?.ambient?.color ?? defaultLights.ambient.color,
      intensity: overrides.lights?.ambient?.intensity ?? defaultLights.ambient.intensity,
    },
    hemisphere: {
      skyColor: overrides.lights?.hemisphere?.skyColor ?? defaultLights.hemisphere.skyColor,
      groundColor:
        overrides.lights?.hemisphere?.groundColor ?? defaultLights.hemisphere.groundColor,
      intensity: overrides.lights?.hemisphere?.intensity ?? defaultLights.hemisphere.intensity,
    },
    key: mergeLight(defaultLights.key, overrides.lights?.key, quality.shadowMapSize),
    rim: mergeLight(defaultLights.rim, overrides.lights?.rim, quality.shadowMapSize),
    fill: buildLight(defaultLights.fill, overrides.lights?.fill, quality.shadowMapSize),
    top: buildLight(defaultLights.top, overrides.lights?.top, quality.shadowMapSize),
    ringBands: overrides.lights?.ringBands ?? defaultLights.ringBands,
    accents: resolveAccentLights(
      defaultLights.accents,
      overrides.lights?.accents,
      quality.shadowMapSize
    ),
  };

  const postProcessing = mergePostProcessing(
    VISUAL_DEFAULTS.postProcessing,
    overrides.postProcessing
  );

  const environment: EnvironmentConfig = {
    enabled: overrides.environment?.enabled ?? true,
    useAsBackground:
      overrides.environment?.useAsBackground ?? VISUAL_DEFAULTS.environment.useAsBackground,
    intensity: overrides.environment?.intensity ?? VISUAL_DEFAULTS.environment.intensity,
    resolution: overrides.environment?.resolution ?? quality.envResolution,
    variant: overrides.environment?.variant ?? VISUAL_DEFAULTS.environment.variant ?? 'studio',
  };

  const fog = mergeFogConfig(VISUAL_DEFAULTS.fog, overrides.fog);

  const renderMode = resolveRenderMode(overrides.renderMode);

  let config: RenderConfig = {
    boardDimensions,
    board,
    materials,
    camera,
    cameraMotion,
    lights,
    postProcessing,
    environment,
    fog,
    quality,
    renderMode,
  };

  if (quality.level === 'ultra2') {
    config = applyUltra2Preset(config);
  }

  return config;
}

function createDefaultLights(camera: CameraConfig, quality: QualityConfig): LightRigConfig {
  const keyPosition = camera.position
    .clone()
    .multiply(VISUAL_DEFAULTS.lights.key.positionMultiplier);
  const rimPosition = camera.position
    .clone()
    .multiply(VISUAL_DEFAULTS.lights.rim.positionMultiplier);
  return {
    hemisphere: {
      skyColor: VISUAL_DEFAULTS.lights.hemisphere.skyColor,
      groundColor: VISUAL_DEFAULTS.lights.hemisphere.groundColor,
      intensity: VISUAL_DEFAULTS.lights.hemisphere.intensity,
    },
    ambient: {
      color: VISUAL_DEFAULTS.lights.ambient.color,
      intensity: VISUAL_DEFAULTS.lights.ambient.intensity,
    },
    key: {
      color: VISUAL_DEFAULTS.lights.key.color,
      intensity: VISUAL_DEFAULTS.lights.key.intensity,
      position: keyPosition,
      target: camera.target.clone(),
      castShadow: true,
      shadow: {
        mapSize: quality.shadowMapSize,
        radius: 2.4,
        bias: -0.00018,
        normalBias: 0.012,
        cameraNear: 0.6,
        cameraFar: 60,
        cameraMargin: 3.5,
      },
    },
    rim: {
      color: VISUAL_DEFAULTS.lights.rim.color,
      intensity: VISUAL_DEFAULTS.lights.rim.intensity,
      position: rimPosition,
      target: camera.target.clone(),
      castShadow: false,
      shadow: undefined,
    },
    fill: {
      color: VISUAL_DEFAULTS.lights.fill.color,
      intensity: VISUAL_DEFAULTS.lights.fill.intensity,
      position: camera.target.clone().add(new THREE.Vector3(-2.5, 1.2, -3.5)),
      target: camera.target.clone(),
      castShadow: false,
      shadow: undefined,
    },
  };
}

function buildLight(
  base: DirectionalLightConfig | undefined,
  override?: Partial<DirectionalLightConfig>,
  fallbackMapSize?: number
): DirectionalLightConfig | undefined {
  if (!base && !override) {
    return undefined;
  }
  const seed: DirectionalLightConfig = base ?? {
    type: override?.type,
    color: override?.color ?? 0xffffff,
    intensity: override?.intensity ?? 1,
    position: (override?.position ?? new THREE.Vector3()).clone(),
    target: override?.target?.clone(),
    castShadow: override?.castShadow ?? false,
    shadow: override?.shadow as DirectionalLightShadowConfig | undefined,
    angle: override?.angle,
    penumbra: override?.penumbra,
    distance: override?.distance,
    decay: override?.decay,
    width: override?.width,
    height: override?.height,
  };
  return mergeLight(seed, override, fallbackMapSize);
}

function mergeLight(
  base: DirectionalLightConfig,
  override?: Partial<DirectionalLightConfig>,
  fallbackMapSize?: number
): DirectionalLightConfig {
  const castShadow = override?.castShadow ?? base.castShadow;
  return {
    type: override?.type ?? base.type,
    color: override?.color ?? base.color,
    intensity: override?.intensity ?? base.intensity,
    position: (override?.position ?? base.position).clone(),
    target: (override?.target ?? base.target)?.clone(),
    castShadow,
    angle: override?.angle ?? base.angle,
    penumbra: override?.penumbra ?? base.penumbra,
    distance: override?.distance ?? base.distance,
    decay: override?.decay ?? base.decay,
    width: override?.width ?? base.width,
    height: override?.height ?? base.height,
    shadow: castShadow ? mergeShadow(base.shadow, override?.shadow, fallbackMapSize) : undefined,
  };
}

function mergeShadow(
  base: DirectionalLightShadowConfig | undefined,
  override: Partial<DirectionalLightShadowConfig> | undefined,
  fallbackMapSize?: number
): DirectionalLightShadowConfig | undefined {
  if (!base && !override && fallbackMapSize === undefined) {
    return undefined;
  }
  const seed: DirectionalLightShadowConfig = base ?? {
    mapSize: fallbackMapSize ?? 2048,
    radius: 1.5,
    bias: -0.00025,
    normalBias: 0.02,
    cameraNear: 1.0,
    cameraFar: 50,
    cameraMargin: 2.5,
  };
  return {
    mapSize: override?.mapSize ?? seed.mapSize ?? fallbackMapSize ?? 2048,
    radius: override?.radius ?? seed.radius,
    bias: override?.bias ?? seed.bias,
    normalBias: override?.normalBias ?? seed.normalBias,
    cameraNear: override?.cameraNear ?? seed.cameraNear,
    cameraFar: override?.cameraFar ?? seed.cameraFar,
    cameraMargin: override?.cameraMargin ?? seed.cameraMargin,
    cameraFov: override?.cameraFov ?? seed.cameraFov,
  };
}

function resolveAccentLights(
  base: DirectionalLightConfig[] | undefined,
  overrides: Partial<DirectionalLightConfig>[] | undefined,
  fallbackMapSize?: number
): DirectionalLightConfig[] | undefined {
  if (overrides && overrides.length > 0) {
    return overrides
      .map((ov, idx) => {
        const seed = base?.[idx] ?? buildLight(undefined, ov, fallbackMapSize);
        return seed ? mergeLight(seed, ov, fallbackMapSize) : null;
      })
      .filter((item): item is DirectionalLightConfig => Boolean(item));
  }
  if (base && base.length > 0) {
    return base.map((light) => mergeLight(light, undefined, fallbackMapSize));
  }
  return undefined;
}

function normalizeFov(fov: number): number {
  if (!Number.isFinite(fov)) {
    return DEFAULT_CAMERA_FOV;
  }
  return Math.min(85, Math.max(25, fov));
}

function mergeMaterialConfig(
  defaults: MaterialConfig,
  overrides?: Partial<MaterialConfig>
): MaterialConfig {
  return {
    front: {
      roughness: overrides?.front?.roughness ?? defaults.front.roughness,
      metalness: overrides?.front?.metalness ?? defaults.front.metalness,
      envMapIntensity: overrides?.front?.envMapIntensity ?? defaults.front.envMapIntensity,
      emissive: overrides?.front?.emissive ?? defaults.front.emissive,
      emissiveIntensity: overrides?.front?.emissiveIntensity ?? defaults.front.emissiveIntensity,
    },
    side: {
      roughness: overrides?.side?.roughness ?? defaults.side.roughness,
      metalness: overrides?.side?.metalness ?? defaults.side.metalness,
      envMapIntensity: overrides?.side?.envMapIntensity ?? defaults.side.envMapIntensity,
      emissive: overrides?.side?.emissive ?? defaults.side.emissive,
      emissiveIntensity: overrides?.side?.emissiveIntensity ?? defaults.side.emissiveIntensity,
    },
  };
}

function mergePostProcessing(
  defaults: PostProcessingConfig,
  overrides?: PostProcessingOverrides
): PostProcessingConfig {
  return {
    bloom: normalizeBloom(defaults.bloom, overrides?.bloom),
    toneMapping: {
      mode: overrides?.toneMapping?.mode ?? defaults.toneMapping.mode,
      exposure: overrides?.toneMapping?.exposure ?? defaults.toneMapping.exposure,
    },
    vignette: {
      enabled: overrides?.vignette?.enabled ?? defaults.vignette.enabled,
      offset: overrides?.vignette?.offset ?? defaults.vignette.offset,
      darkness: overrides?.vignette?.darkness ?? defaults.vignette.darkness,
    },
    colorGrade: {
      enabled: overrides?.colorGrade?.enabled ?? defaults.colorGrade.enabled,
      saturation: overrides?.colorGrade?.saturation ?? defaults.colorGrade.saturation,
      contrast: overrides?.colorGrade?.contrast ?? defaults.colorGrade.contrast,
      lift: overrides?.colorGrade?.lift ?? defaults.colorGrade.lift,
      gamma: overrides?.colorGrade?.gamma ?? defaults.colorGrade.gamma,
      gain: overrides?.colorGrade?.gain ?? defaults.colorGrade.gain,
      warmShift: overrides?.colorGrade?.warmShift ?? defaults.colorGrade.warmShift,
      coolShift: overrides?.colorGrade?.coolShift ?? defaults.colorGrade.coolShift,
    },
    depthOfField: {
      enabled: overrides?.depthOfField?.enabled ?? defaults.depthOfField.enabled,
      focus: overrides?.depthOfField?.focus ?? defaults.depthOfField.focus,
      aperture: overrides?.depthOfField?.aperture ?? defaults.depthOfField.aperture,
      maxBlur: overrides?.depthOfField?.maxBlur ?? defaults.depthOfField.maxBlur,
    },
    ssao: {
      enabled: overrides?.ssao?.enabled ?? defaults.ssao.enabled,
      kernelRadius: overrides?.ssao?.kernelRadius ?? defaults.ssao.kernelRadius,
      minDistance: overrides?.ssao?.minDistance ?? defaults.ssao.minDistance,
      maxDistance: overrides?.ssao?.maxDistance ?? defaults.ssao.maxDistance,
      intensity: overrides?.ssao?.intensity ?? defaults.ssao.intensity,
      bias: overrides?.ssao?.bias ?? defaults.ssao.bias,
    },
  };
}

function normalizeBloom(
  defaultBloom: BloomConfig,
  override?: Partial<BloomConfig> | boolean
): BloomConfig {
  if (typeof override === 'boolean') {
    return { ...defaultBloom, enabled: override };
  }
  return {
    enabled: override?.enabled ?? defaultBloom.enabled,
    strength: override?.strength ?? defaultBloom.strength,
    threshold: override?.threshold ?? defaultBloom.threshold,
    radius: override?.radius ?? defaultBloom.radius,
  };
}

function mergeFogConfig(defaults: FogConfig, overrides?: Partial<FogConfig>): FogConfig {
  return {
    enabled: overrides?.enabled ?? defaults.enabled,
    color: overrides?.color ?? defaults.color,
    density: overrides?.density ?? defaults.density,
  };
}

function resolveRenderMode(override?: Partial<RenderModeConfig>): RenderModeConfig {
  const kind = override?.kind ?? 'game';
  const fallback = RENDER_MODE_DEFAULTS[kind] ?? RENDER_MODE_DEFAULTS.game;
  return {
    kind,
    showGuides: override?.showGuides ?? fallback.showGuides,
    showDebugRing: override?.showDebugRing ?? fallback.showDebugRing,
    showColliders: override?.showColliders ?? fallback.showColliders,
  };
}

function applyUltra2Preset(config: RenderConfig): RenderConfig {
  const towerHeight = computeTowerHeight(config.boardDimensions, config.board);
  const radius = config.board.towerRadius;
  const cameraAzimuth = Math.atan2(config.camera.position.z, config.camera.position.x);
  const cameraDistance = config.camera.position.distanceTo(config.camera.target);
  const enhancedShadowSize = Math.max(6144, config.quality.shadowMapSize);
  const envResolution = Math.max(4096, config.environment.resolution, config.quality.envResolution);

  const keyAzimuth = cameraAzimuth - Math.PI * 0.28;
  const fillAzimuth = cameraAzimuth + Math.PI * 0.18;
  const rimAzimuth = cameraAzimuth + Math.PI * 0.92;

  const key: DirectionalLightConfig = {
    type: 'spot',
    color: 0xfff1d2,
    intensity: 4.25,
    position: new THREE.Vector3(
      Math.cos(keyAzimuth) * radius * 3,
      towerHeight * 1.32,
      Math.sin(keyAzimuth) * radius * 2.4
    ),
    target: new THREE.Vector3(0, towerHeight * 0.52, 0),
    castShadow: true,
    angle: THREE.MathUtils.degToRad(42),
    penumbra: 0.35,
    distance: radius * 8,
    decay: 1.35,
    shadow: {
      mapSize: enhancedShadowSize,
      radius: 3.1,
      bias: -0.00012,
      normalBias: 0.01,
      cameraNear: 0.45,
      cameraFar: Math.max(towerHeight * 3.6, radius * 10),
      cameraMargin: 4.5,
      cameraFov: 40,
    },
  };

  const fill: DirectionalLightConfig = {
    type: 'spot',
    color: 0xe8f1ff,
    intensity: 1.3,
    position: new THREE.Vector3(
      Math.cos(fillAzimuth) * radius * 2.6,
      towerHeight * 0.9,
      Math.sin(fillAzimuth) * radius * 1.6
    ),
    target: new THREE.Vector3(0, towerHeight * 0.45, 0),
    castShadow: false,
    angle: THREE.MathUtils.degToRad(68),
    penumbra: 0.62,
    distance: radius * 5.2,
    decay: 1.24,
  };

  const rim: DirectionalLightConfig = {
    type: 'directional',
    color: 0x9bd8ff,
    intensity: 1.6,
    position: new THREE.Vector3(
      Math.cos(rimAzimuth) * radius * 2.6,
      towerHeight * 0.92,
      Math.sin(rimAzimuth) * radius * 2.6
    ),
    target: new THREE.Vector3(0, towerHeight * 0.52, 0),
    castShadow: false,
    shadow: undefined,
  };

  const top: DirectionalLightConfig = {
    type: 'spot',
    color: 0xfdfdfc,
    intensity: 3.5,
    position: new THREE.Vector3(0, towerHeight * 1.85, 0),
    target: new THREE.Vector3(0, towerHeight * 0.92, 0),
    castShadow: true,
    angle: THREE.MathUtils.degToRad(56),
    penumbra: 0.55,
    distance: towerHeight * 3.4,
    decay: 1.35,
    shadow: {
      mapSize: enhancedShadowSize,
      radius: 2.6,
      bias: -0.0001,
      normalBias: 0.012,
      cameraNear: 0.35,
      cameraFar: towerHeight * 3.4,
      cameraMargin: 3.6,
      cameraFov: 55,
    },
  };

  const ringRadius = radius * 1.22;
  const ringBands: RingLightBandConfig[] = [
    {
      count: 8,
      radius: ringRadius,
      height: towerHeight * 0.34,
      angleDown: THREE.MathUtils.degToRad(18),
      penumbra: 0.6,
      spread: THREE.MathUtils.degToRad(28),
      color: 0xf8f0e4,
      colorVariance: 0.08,
      intensity: 0.28,
      distance: ringRadius * 3.1,
      decay: 1.5,
      castShadow: false,
    },
    {
      count: 8,
      radius: ringRadius * 1.05,
      height: towerHeight * 0.68,
      angleDown: THREE.MathUtils.degToRad(16),
      penumbra: 0.55,
      spread: THREE.MathUtils.degToRad(24),
      color: 0xf2e9dd,
      colorVariance: 0.08,
      intensity: 0.22,
      distance: ringRadius * 3.4,
      decay: 1.45,
      castShadow: false,
    },
  ];

  config.quality = { level: 'ultra2', shadowMapSize: enhancedShadowSize, envResolution };
  config.environment = {
    ...config.environment,
    enabled: true,
    useAsBackground: true,
    intensity: 1.65,
    resolution: envResolution,
    variant: 'ultra2',
  };
  config.materials = {
    front: {
      roughness: 0.18,
      metalness: 0.05,
      envMapIntensity: 0.62,
      emissive: 0x1b0f05,
      emissiveIntensity: 0.05,
    },
    side: {
      roughness: 0.16,
      metalness: 1.0,
      envMapIntensity: 2.75,
      emissive: 0x2a1706,
      emissiveIntensity: 0.09,
    },
  };
  config.lights = {
    ambient: { color: 0xfdf9f1, intensity: 0.1 },
    hemisphere: { skyColor: 0xf8fbff, groundColor: 0x0c0f16, intensity: 0.34 },
    key,
    rim,
    fill,
    top,
    ringBands,
    accents: [
      {
        type: 'directional',
        color: 0xbedcff,
        intensity: 0.55,
        position: new THREE.Vector3(radius * 1.1, Math.max(0.3, towerHeight * 0.15), -radius * 1.8),
        target: new THREE.Vector3(0, towerHeight * 0.25, 0),
        castShadow: false,
      },
    ],
  };
  config.postProcessing = {
    bloom: { enabled: true, strength: 1.5, threshold: 1.05, radius: 0.9 },
    toneMapping: { mode: 'aces', exposure: 1.18 },
    vignette: { enabled: true, offset: 0.82, darkness: 1.32 },
    colorGrade: {
      enabled: true,
      saturation: 1.08,
      contrast: 1.12,
      lift: -0.02,
      gamma: 0.95,
      gain: 1.08,
      warmShift: 0.06,
      coolShift: -0.035,
    },
    depthOfField: {
      enabled: true,
      focus: Math.max(cameraDistance * 0.92, radius * 2.2),
      aperture: 0.00036,
      maxBlur: 0.0062,
    },
    ssao: {
      enabled: true,
      kernelRadius: 22,
      minDistance: 0.0011,
      maxDistance: 0.32,
      intensity: 1.08,
      bias: 0.02,
    },
  };
  config.cameraMotion = {
    ...config.cameraMotion,
    orbitAmplitude: 0.024,
    orbitSpeed: 0.08,
    heightAmplitudeRatio: 0.016,
    heightSpeed: 0.12,
    targetFollowRatio: 0.32,
  };
  config.fog = { enabled: true, color: 0x05070a, density: 0.012 };
  return config;
}

function resolveQuality(level: QualityLevel = 'ultra'): QualityConfig {
  switch (level) {
    case 'low':
      return { level, shadowMapSize: 1024, envResolution: 512 };
    case 'medium':
      return { level, shadowMapSize: 2048, envResolution: 1024 };
    case 'ultra2':
      return { level, shadowMapSize: 6144, envResolution: 4096 };
    case 'ultra':
    default:
      return { level: 'ultra', shadowMapSize: 4096, envResolution: 2048 };
  }
}
