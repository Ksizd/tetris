import * as THREE from 'three';
import { BoardToWorldMapper } from './boardToWorldMapper';
import { createBoardInstancedMesh } from './boardInstancedMesh';
import { createActivePieceInstancedMesh } from './activePieceInstancedMesh';
import { ActivePieceInstancedResources } from './activePieceInstancedMesh';
import { BoardInstancedResources } from './boardInstancedMesh';
import {
  createRenderConfig,
  LightRigConfig,
  RenderConfig,
  RenderConfigOverrides,
  ToneMappingConfig,
  RingLightBandConfig,
} from './renderConfig';
import {
  computeTowerHeight,
  computeGameCameraPose,
  computeTowerBoundingSphere,
} from './cameraSetup';
import { createEnvironmentMap, EnvironmentMapResources } from './environmentMap';
import { BoardRenderConfig } from './boardConfig';
import { BoardDimensions } from '../core/types';
import {
  PostProcessingContext,
  createPostProcessingContext,
  resizePostProcessing,
} from './postProcessing';
import { getTowerBounds } from './towerBounds';
import { createDebugOverlays } from './debugOverlays';
import {
  FragmentInstancedResources,
  createFragmentInstancedMeshes,
} from './destruction/fragmentInstancedMesh';

export interface RenderContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  boardPlaceholder: THREE.Group;
  board: BoardInstancedResources;
  activePiece: ActivePieceInstancedResources;
  mapper: BoardToWorldMapper;
  renderConfig: RenderConfig;
  cameraBasePlacement: { position: THREE.Vector3; target: THREE.Vector3 };
  environment?: EnvironmentMapResources | null;
  post?: PostProcessingContext | null;
  fragments?: FragmentInstancedResources | null;
}

function enforceColorPipeline(renderer: THREE.WebGLRenderer): void {
  THREE.ColorManagement.enabled = true;
  THREE.ColorManagement.workingColorSpace = THREE.LinearSRGBColorSpace;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

function applyToneMapping(renderer: THREE.WebGLRenderer, config: ToneMappingConfig): void {
  const mode =
    config.mode === 'aces'
      ? THREE.ACESFilmicToneMapping
      : config.mode === 'reinhard'
        ? THREE.ReinhardToneMapping
        : THREE.NoToneMapping;
  renderer.toneMapping = mode;
  renderer.toneMappingExposure = config.exposure;
}

function computeCameraNear(
  bounds: ReturnType<typeof getTowerBounds>,
  board: BoardRenderConfig,
  cameraPosition: THREE.Vector3
): number {
  const sphere = computeTowerBoundingSphere(bounds);
  const distanceToCenter = cameraPosition.distanceTo(sphere.center);
  const clearance = distanceToCenter - sphere.radius - board.blockSize * 0.5;
  // Keep near small enough to avoid clipping spawned blocks close to the camera, but not too small for precision.
  return Math.max(0.05, Math.min(clearance, 2));
}

/**
 * D~D«D,¥+D,DøD¯D,DúD,¥?¥ŸDæ¥, DñDøDúD_Dý¥Ÿ¥Z 3D-¥?¥+DæD«¥Ÿ D«Dø D¨Dæ¥?DæD'DøD«D«D_D¬ canvas.
 */
export function createRenderContext(
  canvas: HTMLCanvasElement,
  overrides?: RenderConfigOverrides
): RenderContext {
  const scene = new THREE.Scene();
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const renderConfig = createRenderConfig(overrides, aspect);
  const mapper = new BoardToWorldMapper(renderConfig.boardDimensions, renderConfig.board);
  const towerBounds = getTowerBounds(renderConfig.boardDimensions, renderConfig.board);

  scene.background = new THREE.Color(0x000000);
  if (renderConfig.fog.enabled) {
    scene.fog = new THREE.FogExp2(
      new THREE.Color(renderConfig.fog.color),
      renderConfig.fog.density
    );
    if (!renderConfig.environment.useAsBackground) {
      scene.background = new THREE.Color(renderConfig.fog.color);
    }
  }

  const camera = new THREE.PerspectiveCamera(
    renderConfig.camera.fov,
    canvas.clientWidth / canvas.clientHeight,
    computeCameraNear(towerBounds, renderConfig.board, renderConfig.camera.position),
    1000
  );
  camera.position.copy(renderConfig.camera.position);
  camera.lookAt(renderConfig.camera.target);

  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  }) as WebGL2RenderingContext | null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    context: gl ?? undefined,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  enforceColorPipeline(renderer);
  applyToneMapping(renderer, renderConfig.postProcessing.toneMapping);
  renderer.shadowMap.enabled = false;
  const glctx = renderer.getContext();
  // We don't use 3D/array textures; skip texImage3D to avoid driver spam on flipY checks.
  glctx.texImage3D = function noopTexImage3D() {
    return;
  };

  addLighting(
    scene,
    renderer,
    renderConfig.lights,
    renderConfig.boardDimensions,
    renderConfig.board
  );
  const environment = createEnvironmentMap(renderer, renderConfig.environment);
  if (environment) {
    scene.environment = environment.environmentMap;
    if (renderConfig.environment.useAsBackground && environment.backgroundTexture) {
      scene.background = environment.backgroundTexture;
    }
  }

  const debugOverlays = createDebugOverlays({
    dimensions: renderConfig.boardDimensions,
    board: renderConfig.board,
    renderMode: renderConfig.renderMode,
  });
  scene.add(debugOverlays.group);

  const boardInstanced = createBoardInstancedMesh(
    renderConfig.boardDimensions,
    renderConfig.board,
    renderConfig.materials
  );
  scene.add(boardInstanced.mesh);

  const activePieceInstanced = createActivePieceInstancedMesh(
    renderConfig.board,
    renderConfig.materials
  );
  scene.add(activePieceInstanced.mesh);

  const fragments = createFragmentInstancedMeshes(renderConfig.boardDimensions, renderConfig.board);
  Object.values(fragments.meshes).forEach((mesh) => scene.add(mesh));

  const shadowCatcher = createShadowCatcher(renderConfig.board);
  scene.add(shadowCatcher);

  const post = createPostProcessingContext(renderer, scene, camera, renderConfig.postProcessing);

  return {
    scene,
    camera,
    renderer,
    boardPlaceholder: debugOverlays.group,
    board: boardInstanced,
    activePiece: activePieceInstanced,
    mapper,
    renderConfig,
    cameraBasePlacement: {
      position: renderConfig.camera.position.clone(),
      target: renderConfig.camera.target.clone(),
    },
    environment,
    post,
    fragments,
  };
}

function addLighting(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  config: LightRigConfig,
  dimensions: BoardDimensions,
  boardConfig: BoardRenderConfig
): void {
  const towerHeight = computeTowerHeight(dimensions, boardConfig);
  const towerRadius = boardConfig.towerRadius;
  const margin = boardConfig.blockSize * 2;
  const shadowHalf = towerRadius + margin;
  const shadowTop = towerHeight + margin;

  renderer.shadowMap.enabled = hasShadowCastingLight(config);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const hemi = new THREE.HemisphereLight(
    config.hemisphere.skyColor,
    config.hemisphere.groundColor,
    config.hemisphere.intensity
  );
  hemi.position.set(0, 1, 0);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(config.ambient.color, config.ambient.intensity);
  scene.add(ambient);

  const bounds = { shadowHalf, shadowTop, margin };
  const baseLights = [
    config.key,
    config.rim,
    config.fill,
    config.top,
    ...(config.accents ?? []),
  ].filter((item): item is DirectionalLightConfig => Boolean(item));

  baseLights.forEach((lightConfig, idx) => {
    const built = createLightFromConfig(lightConfig, bounds, renderer, `main-${idx}`);
    scene.add(built.light);
    if (built.target) {
      scene.add(built.target);
    }
  });

  config.ringBands?.forEach((band, idx) => {
    const ringLights = createRingLights(band, bounds, renderer, `ring-${idx}`);
    ringLights.forEach((entry) => {
      scene.add(entry.light);
      if (entry.target) {
        scene.add(entry.target);
      }
    });
  });
}

interface BuiltLight {
  light: THREE.Light;
  target?: THREE.Object3D;
}

function hasShadowCastingLight(config: LightRigConfig): boolean {
  return Boolean(
    config.key.castShadow ||
      config.rim.castShadow ||
      config.fill?.castShadow ||
      config.top?.castShadow ||
      config.accents?.some((l) => l.castShadow) ||
      config.ringBands?.some((band) => band.castShadow)
  );
}

function createLightFromConfig(
  config: DirectionalLightConfig,
  bounds: { shadowHalf: number; shadowTop: number; margin: number },
  renderer: THREE.WebGLRenderer,
  name?: string
): BuiltLight {
  const type = config.type ?? 'directional';
  if (type === 'spot') {
    const light = new THREE.SpotLight(config.color, config.intensity);
    light.name = name ?? 'spotLight';
    light.position.copy(config.position);
    light.angle = config.angle ?? Math.PI / 3;
    light.penumbra = config.penumbra ?? 0.4;
    light.decay = config.decay ?? 1.35;
    light.distance = config.distance ?? bounds.shadowTop * 1.6;
    const target = (config.target ?? new THREE.Vector3(0, bounds.shadowTop * 0.35, 0)).clone();
    light.target.position.copy(target);
    light.castShadow = Boolean(config.castShadow);
    if (light.castShadow && config.shadow) {
      const size = clampShadowMapSize(renderer, config.shadow.mapSize);
      light.shadow.mapSize.set(size, size);
      light.shadow.bias = config.shadow.bias;
      light.shadow.normalBias = config.shadow.normalBias;
      light.shadow.radius = config.shadow.radius;
      const perspective = light.shadow.camera as THREE.PerspectiveCamera;
      perspective.near = config.shadow.cameraNear;
      perspective.far = Math.max(
        config.shadow.cameraFar,
        bounds.shadowTop + config.shadow.cameraMargin
      );
      perspective.fov = config.shadow.cameraFov ?? THREE.MathUtils.radToDeg(light.angle) * 1.25;
      perspective.updateProjectionMatrix();
    }
    return { light, target: light.target };
  }
  if (type === 'point') {
    const light = new THREE.PointLight(
      config.color,
      config.intensity,
      config.distance,
      config.decay ?? 1.6
    );
    light.name = name ?? 'pointLight';
    light.position.copy(config.position);
    light.castShadow = Boolean(config.castShadow);
    if (light.castShadow && config.shadow) {
      const size = clampShadowMapSize(renderer, config.shadow.mapSize);
      light.shadow.mapSize.set(size, size);
      light.shadow.bias = config.shadow.bias;
      light.shadow.normalBias = config.shadow.normalBias;
      light.shadow.radius = config.shadow.radius;
      const perspective = light.shadow.camera as THREE.PerspectiveCamera;
      perspective.near = config.shadow.cameraNear;
      perspective.far = Math.max(
        config.shadow.cameraFar,
        bounds.shadowTop + config.shadow.cameraMargin
      );
      perspective.fov = config.shadow.cameraFov ?? 50;
      perspective.updateProjectionMatrix();
    }
    return { light };
  }

  const light = new THREE.DirectionalLight(config.color, config.intensity);
  light.name = name ?? 'dirLight';
  light.position.copy(config.position);
  if (config.target) {
    light.target.position.copy(config.target);
  }
  light.castShadow = Boolean(config.castShadow);
  if (light.castShadow && config.shadow) {
    const size = clampShadowMapSize(renderer, config.shadow.mapSize);
    light.shadow.mapSize.set(size, size);
    light.shadow.bias = config.shadow.bias;
    light.shadow.normalBias = config.shadow.normalBias;
    light.shadow.radius = config.shadow.radius;

    const orthoCam = light.shadow.camera as THREE.OrthographicCamera;
    orthoCam.left = -bounds.shadowHalf;
    orthoCam.right = bounds.shadowHalf;
    orthoCam.top = bounds.shadowTop;
    orthoCam.bottom = -bounds.margin;
    orthoCam.near = config.shadow.cameraNear;
    orthoCam.far = Math.max(config.shadow.cameraFar, bounds.shadowTop + config.shadow.cameraMargin);
    orthoCam.updateProjectionMatrix();
  }
  return { light, target: config.target ? light.target : undefined };
}

function createRingLights(
  band: RingLightBandConfig,
  bounds: { shadowHalf: number; shadowTop: number; margin: number },
  renderer: THREE.WebGLRenderer,
  namePrefix: string
): BuiltLight[] {
  const lights: BuiltLight[] = [];
  const step = (Math.PI * 2) / Math.max(1, band.count);
  const center = new THREE.Vector3(0, band.height, 0);
  for (let i = 0; i < band.count; i += 1) {
    const angle = i * step;
    const hueShift = band.colorVariance ? (i / band.count - 0.5) * band.colorVariance : 0;
    const color = new THREE.Color(band.color);
    if (band.colorVariance) {
      const hsl = { h: 0, s: 0, l: 0 };
      color.getHSL(hsl);
      color.setHSL(hsl.h + hueShift * 0.1, hsl.s, hsl.l);
    }
    const position = new THREE.Vector3(
      Math.cos(angle) * band.radius,
      band.height,
      Math.sin(angle) * band.radius
    );
    const light = new THREE.SpotLight(color, band.intensity);
    light.name = `${namePrefix}-${i}`;
    light.position.copy(position);
    light.angle = band.spread;
    light.penumbra = band.penumbra;
    light.decay = band.decay ?? 1.6;
    light.distance = band.distance ?? band.radius * 3.2;

    const target = center.clone().multiplyScalar(0.92);
    target.y = Math.max(0.25, band.height - Math.tan(band.angleDown) * band.radius * 0.4);
    light.target.position.copy(target);
    light.castShadow = Boolean(band.castShadow);
    if (light.castShadow) {
      const size = clampShadowMapSize(renderer, band.castShadow ? band.penumbra * 2048 : 1024);
      light.shadow.mapSize.set(size, size);
      light.shadow.bias = -0.00008;
      light.shadow.normalBias = 0.01;
      light.shadow.radius = 2;
      const perspective = light.shadow.camera as THREE.PerspectiveCamera;
      perspective.near = 0.5;
      perspective.far = Math.max(bounds.shadowTop + bounds.margin, band.radius * 4);
      perspective.fov = THREE.MathUtils.radToDeg(light.angle) * 1.2;
      perspective.updateProjectionMatrix();
    }

    lights.push({ light, target: light.target });
  }
  return lights;
}

function clampShadowMapSize(renderer: THREE.WebGLRenderer, requested: number): number {
  const maxSize = renderer.capabilities.maxTextureSize;
  return Math.min(Math.max(256, Math.floor(requested)), maxSize);
}

function createShadowCatcher(boardConfig: BoardRenderConfig): THREE.Mesh {
  const radius = boardConfig.towerRadius * 1.6;
  const geometry = new THREE.CircleGeometry(radius, 48);
  const material = new THREE.ShadowMaterial({ opacity: 0.35 });
  const catcher = new THREE.Mesh(geometry, material);
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.005;
  catcher.receiveShadow = true;
  catcher.castShadow = false;
  catcher.name = 'shadowCatcher';
  return catcher;
}

function disposeMaterials(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
    return;
  }
  material.dispose();
}

function disposeMeshes(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material?.dispose();
      }
    }
  });
}

export function disposeRenderResources(ctx: RenderContext): void {
  ctx.board.geometry.dispose();
  disposeMaterials(ctx.board.material);
  ctx.activePiece.geometry.dispose();
  disposeMaterials(ctx.activePiece.material);
  if (ctx.fragments) {
    Object.values(ctx.fragments.geometries).forEach((geom) => geom.dispose());
    Object.values(ctx.fragments.materials).forEach((mat) => mat.dispose());
    Object.values(ctx.fragments.meshes).forEach((mesh) => mesh.dispose());
  }
  disposeMeshes(ctx.boardPlaceholder);
  ctx.environment?.dispose();
  ctx.post?.composer.dispose();
  ctx.renderer.dispose();
}

export function resizeRenderer(ctx: RenderContext, width: number, height: number): void {
  ctx.renderer.setSize(width, height, false);
  ctx.camera.aspect = width / height;
  ctx.camera.updateProjectionMatrix();

  const bounds = getTowerBounds(ctx.renderConfig.boardDimensions, ctx.renderConfig.board);
  const pose = computeGameCameraPose(bounds, ctx.camera.aspect, {
    fovDeg: ctx.renderConfig.camera.fov,
  });
  ctx.camera.position.copy(pose.position);
  ctx.camera.lookAt(pose.target);
  ctx.renderConfig.camera.position.copy(pose.position);
  ctx.renderConfig.camera.target.copy(pose.target);
  ctx.cameraBasePlacement.position.copy(pose.position);
  ctx.cameraBasePlacement.target.copy(pose.target);

  resizePostProcessing(ctx.post, width, height);
}

export function renderFrame(ctx: RenderContext, deltaMs?: number): void {
  if (ctx.post?.composer) {
    ctx.post.composer.render(deltaMs ? deltaMs / 1000 : undefined);
  } else {
    ctx.renderer.render(ctx.scene, ctx.camera);
  }
}

export function updateDebugOverlays(ctx: RenderContext): void {
  if (ctx.boardPlaceholder.parent) {
    ctx.boardPlaceholder.parent.remove(ctx.boardPlaceholder);
  }
  const overlays = createDebugOverlays({
    dimensions: ctx.renderConfig.boardDimensions,
    board: ctx.renderConfig.board,
    renderMode: ctx.renderConfig.renderMode,
  });
  ctx.boardPlaceholder = overlays.group;
  ctx.scene.add(overlays.group);
}
