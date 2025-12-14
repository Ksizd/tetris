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
import { getTowerBounds, TowerBounds } from './towerBounds';
import { createDebugOverlays } from './debugOverlays';
import {
  FragmentInstancedResources,
  createFragmentInstancedMeshes,
} from './destruction/fragmentInstancedMesh';
import {
  GoldenHallInstance,
  createGoldenHall,
} from './goldenHallScene';
import { createGoldenHallMaterials } from './goldenHallMaterials';
import { createGoldenPlatform, GoldenPlatformInstance } from './goldenPlatform';
import { createFootprintDecor } from './footprintDecor';
import { computeHallLayout, createDefaultHallLayoutConfig, HallLayoutRadii } from './hallLayout';
import { deriveTowerRadii, measureCameraOrbit } from './hallRadiiSources';
import { runHallGeometryDiagnostics } from './hallGeometryMonitor';

export interface RenderContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;
  boardPlaceholder: THREE.Group;
  board: BoardInstancedResources;
  activePiece: ActivePieceInstancedResources;
  ghost?: ActivePieceInstancedResources;
  mapper: BoardToWorldMapper;
  renderConfig: RenderConfig;
  cameraBasePlacement: { position: THREE.Vector3; target: THREE.Vector3 };
  towerBounds: TowerBounds;
  hallLayout: HallLayoutRadii;
  environment?: EnvironmentMapResources | null;
  post?: PostProcessingContext | null;
  fragments?: FragmentInstancedResources | null;
  footprintDecor?: THREE.Group | null;
  goldenPlatform?: GoldenPlatformInstance | null;
  goldenHall?: GoldenHallInstance | null;
}

function findHallFloorTop(hall: GoldenHallInstance): number | null {
  let box: THREE.Box3 | null = null;
  hall.baseGroup.updateMatrixWorld(true);
  hall.baseGroup.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const tag = (mesh as any).userData?.debugTag;
    const name = mesh.name ?? '';
    const parentName = mesh.parent?.name ?? '';
    const isFloorTagged = tag?.kind === 'hallFloor';
    const isFloorByName =
      name.includes('step') ||
      name.includes('center') ||
      parentName.includes('hall-base');
    if (!isFloorTagged && !isFloorByName) return;
    const b = new THREE.Box3().setFromObject(mesh);
    box = box ? box.union(b) : b;
  });
  return box ? box.max.y : null;
}

function enforceColorPipeline(renderer: THREE.WebGLRenderer): void {
  THREE.ColorManagement.enabled = true;
  THREE.ColorManagement.workingColorSpace = THREE.LinearSRGBColorSpace;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

function alignHallToPlatform(ringATop: number, hall: GoldenHallInstance): void {
  hall.baseGroup.position.y = ringATop;
  hall.hallGroup.position.y = ringATop;
  hall.fxGroup.position.y = ringATop;
  const hallFloorTop = findHallFloorTop(hall);
  if (hallFloorTop === null) {
    return;
  }
  const blockSize = hall.layout.footprint.blockSize;
  const grooveD = THREE.MathUtils.clamp(blockSize * 0.08, blockSize * 0.04, blockSize * 0.08);
  const desiredTop = ringATop - grooveD - 0.002; // keep hall floor below footprint grooves
  const delta = hallFloorTop - desiredTop;
  if (Math.abs(delta) > 1e-6) {
    hall.baseGroup.position.y -= delta;
    hall.hallGroup.position.y -= delta;
    hall.fxGroup.position.y -= delta;
  }
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
  bounds: TowerBounds,
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
  const clock = new THREE.Clock();
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

  const hallLayoutConfig = createDefaultHallLayoutConfig(renderConfig.board.blockSize);
  const towerRadii = deriveTowerRadii(renderConfig.board, towerBounds.center);
  const cameraOrbit = measureCameraOrbit(renderConfig.camera.position, towerBounds.center);
  const hallLayout = computeHallLayout(
    {
      towerOuterRadius: towerRadii.outerRadius,
      cameraOrbitRadius: cameraOrbit.radius,
    },
    hallLayoutConfig
  );
  if (typeof console !== 'undefined') {
    console.assert(
      hallLayout.hallInnerRadius > hallLayout.cameraOrbitRadius + 0.001,
      'Hall inner radius must exceed camera orbit'
    );
    console.assert(
      hallLayout.hallInnerRadius > hallLayout.towerOuterRadius + 0.001,
      'Hall inner radius must exceed tower outer radius'
    );
  }
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

  let goldenPlatform: GoldenPlatformInstance | null = null;
  let goldenHall: GoldenHallInstance | null = null;
  goldenPlatform = createGoldenPlatform({
    hallLayout,
    board: renderConfig.board,
    dimensions: renderConfig.boardDimensions,
    quality: renderConfig.quality.level,
  });
  scene.add(goldenPlatform.mesh);
  applyFootprintInlayDebugFlags(goldenPlatform, renderConfig);

  if (renderConfig.goldenHall.enabled) {
    const hallMaterials = createGoldenHallMaterials({
      quality: renderConfig.quality.level,
      envMap: environment?.environmentMap ?? null,
      useDustFx: renderConfig.goldenHall.useDustFx,
      useLightShafts: renderConfig.goldenHall.useLightShafts,
    });
    goldenHall = createGoldenHall({
      towerBounds,
      dimensions: renderConfig.boardDimensions,
      board: renderConfig.board,
      goldenHall: renderConfig.goldenHall,
      quality: renderConfig.quality.level,
      materials: hallMaterials,
      hallLayout,
    });
    if (goldenHall) {
      const ringATop = goldenPlatform.layout.baseY + goldenPlatform.layout.ringA.height;
      alignHallToPlatform(ringATop, goldenHall);
      scene.add(goldenHall.baseGroup);
      scene.add(goldenHall.hallGroup);
      scene.add(goldenHall.fxGroup);
    }
  }

  let footprintDecor: THREE.Group | null = null;
  if (renderConfig.showFootprintDecor !== false && goldenPlatform?.layout) {
    footprintDecor = createFootprintDecor({
      dimensions: renderConfig.boardDimensions,
      board: renderConfig.board,
      platformLayout: goldenPlatform.layout,
    });
    scene.add(footprintDecor);
  }

  if (typeof console !== 'undefined') {
    const footprintInlayCore =
      goldenPlatform?.mesh.getObjectByName('footprintInlayCore') ?? null;
    const diag = runHallGeometryDiagnostics({
      board: renderConfig.board,
      hallLayout,
      platformLayout: goldenPlatform?.layout ?? null,
      platformObject: goldenPlatform?.mesh ?? null,
      footprintObject: footprintInlayCore ?? footprintDecor,
    });
    if (diag.errors.length || diag.warnings.length) {
      console.groupCollapsed('[hallGeometry] invariants (17.0)');
      diag.errors.forEach((msg) => console.error(msg));
      diag.warnings.forEach((msg) => console.warn(msg));
      console.info('report', diag.report);
      console.groupEnd();
    } else {
      console.info('[hallGeometry] invariants OK', diag.report);
    }
  }

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
  const ghostInstanced = createActivePieceInstancedMesh(renderConfig.board, {
    front: {
      roughness: 0.18,
      metalness: 0.0,
      envMapIntensity: 0.6,
      emissive: 0xffe9a6,
      emissiveIntensity: 0.55,
    },
    side: {
      roughness: 0.22,
      metalness: 0.0,
      envMapIntensity: 0.45,
      emissive: 0xffe9a6,
      emissiveIntensity: 0.4,
    },
  });
  ghostInstanced.mesh.renderOrder = -1;
  ghostInstanced.mesh.material = ghostInstanced.mesh.material.map((mat) => {
    const m = mat.clone();
    m.transparent = true;
    m.opacity = 0.35;
    m.depthWrite = false;
    m.depthTest = true;
    return m;
  });
  scene.add(ghostInstanced.mesh);

  const fragments = createFragmentInstancedMeshes(renderConfig.boardDimensions, renderConfig.board);
  fragments.meshesByTemplate.forEach((mesh) => scene.add(mesh));

  const shadowCatcher = createShadowCatcher(renderConfig.board);
  scene.add(shadowCatcher);

  const post = createPostProcessingContext(renderer, scene, camera, renderConfig.postProcessing);

  return {
    scene,
    camera,
    renderer,
    clock,
    boardPlaceholder: debugOverlays.group,
    board: boardInstanced,
    activePiece: activePieceInstanced,
    ghost: ghostInstanced,
    mapper,
    renderConfig,
    towerBounds,
    hallLayout,
    cameraBasePlacement: {
      position: renderConfig.camera.position.clone(),
      target: renderConfig.camera.target.clone(),
    },
    environment,
    post,
    fragments,
    footprintDecor,
    goldenPlatform,
    goldenHall,
  };
}

function applyFootprintInlayDebugFlags(
  platform: GoldenPlatformInstance,
  config: RenderConfig
): void {
  const mats = platform.mesh.material;
  if (!Array.isArray(mats) || mats.length < 3) {
    return;
  }
  const wireframe = Boolean(config.showFootprintInlayWireframe);
  for (const idx of [0, 1, 2]) {
    const mat = mats[idx] as THREE.Material & { wireframe?: boolean };
    if (typeof (mat as any).wireframe === 'boolean') {
      (mat as any).wireframe = wireframe;
    }
  }
  const lava = mats[2] as THREE.ShaderMaterial | THREE.Material;
  const uniforms = (lava as any).uniforms as Record<string, { value: any }> | undefined;
  if (uniforms?.uDebugLavaUV) {
    uniforms.uDebugLavaUV.value = config.showFootprintLavaUV ? 1 : 0;
  }
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
    ctx.fragments.meshesByTemplate.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    });
    Object.values(ctx.fragments.materials).forEach((mat) => mat.dispose());
  }
  if (ctx.goldenHall) {
    ctx.scene.remove(ctx.goldenHall.baseGroup);
    ctx.scene.remove(ctx.goldenHall.hallGroup);
    ctx.scene.remove(ctx.goldenHall.fxGroup);
    ctx.goldenHall.dispose();
  }
  if (ctx.footprintDecor) {
    ctx.scene.remove(ctx.footprintDecor);
    disposeMeshes(ctx.footprintDecor);
  }
  if (ctx.goldenPlatform) {
    ctx.scene.remove(ctx.goldenPlatform.mesh);
    ctx.goldenPlatform.dispose();
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

  ctx.towerBounds = getTowerBounds(ctx.renderConfig.boardDimensions, ctx.renderConfig.board);
  const pose = computeGameCameraPose(ctx.towerBounds, ctx.camera.aspect, {
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
