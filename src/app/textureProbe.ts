import * as THREE from 'three';
import { createBoardRenderConfig } from '../render/boardConfig';
import { createBeveledBoxGeometry } from '../render/beveledBoxGeometry';
import { applyMahjongUVLayout } from '../render/uv';
import { createMahjongMaterialMaps, createMahjongTileTexture } from '../render/textures';
import { ToneMappingConfig } from '../render/renderConfig';
import { createEnvironmentMap, EnvironmentConfig } from '../render/environmentMap';

const QUERY_FLAG = 'textureProbe';
const EXPOSURE_PRESETS = [1.0, 1.25, 1.5];

export function isTextureProbeEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(QUERY_FLAG);
  return value === '1' || value === 'true';
}

/**
 * Renders a single mahjong cube with orbit controls for close inspection of the front and side faces.
 * Pointer drag rotates, wheel zooms.
 */
export function startTextureProbe(canvas: HTMLCanvasElement): void {
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
  const glctx = renderer.getContext();
  glctx.texImage3D = function noopTexImage3D() {
    return;
  };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  enforceColorPipeline(renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1016);
  const envConfig: EnvironmentConfig = {
    enabled: true,
    useAsBackground: true,
    intensity: 1.1,
    resolution: 1024,
    variant: 'studio',
  };
  const envResources = createEnvironmentMap(renderer, envConfig);
  if (envResources) {
    scene.environment = envResources.environmentMap;
    if (envResources.backgroundTexture) {
      scene.background = envResources.backgroundTexture;
    }
  }

  const camera = new THREE.PerspectiveCamera(35, getAspect(canvas), 0.1, 100);
  const target = new THREE.Vector3(0, 0, 0);

  const dims = { width: 12, height: 24 };
  const config = createBoardRenderConfig(dims);
  buildExposureScene(scene, config);

  const toneMappingConfig: ToneMappingConfig = { mode: 'aces', exposure: EXPOSURE_PRESETS[2] };
  applyToneMapping(renderer, toneMappingConfig);
  const updateOverlay = createExposureOverlay(toneMappingConfig.exposure);
  const updateExposure = (next: number) => {
    toneMappingConfig.exposure = next;
    applyToneMapping(renderer, toneMappingConfig);
    updateOverlay(next);
  };
  setupExposureControls(updateExposure, toneMappingConfig.exposure);

  const orbit = createOrbitController({
    camera,
    target,
    radius: config.blockSize * 4.5,
    minRadius: config.blockSize * 2,
    maxRadius: config.blockSize * 9,
    phi: Math.PI / 2.4,
    theta: Math.PI / 4,
    canvas,
  });

  function render() {
    orbit.update();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = getAspect(canvas);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  window.addEventListener('resize', () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = getAspect(canvas);
    camera.updateProjectionMatrix();
  });

  requestAnimationFrame(render);
}

function getAspect(canvas: HTMLCanvasElement): number {
  return canvas.clientWidth / Math.max(canvas.clientHeight, 1);
}

interface OrbitOptions {
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  radius: number;
  minRadius: number;
  maxRadius: number;
  phi: number;
  theta: number;
  canvas: HTMLCanvasElement;
}

function createOrbitController(options: OrbitOptions) {
  let radius = options.radius;
  let phi = options.phi;
  let theta = options.theta;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function updateCamera() {
    const x = options.target.x + radius * Math.sin(phi) * Math.cos(theta);
    const y = options.target.y + radius * Math.cos(phi);
    const z = options.target.z + radius * Math.sin(phi) * Math.sin(theta);
    options.camera.position.set(x, y, z);
    options.camera.lookAt(options.target);
  }

  function onPointerDown(ev: PointerEvent) {
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    options.canvas.setPointerCapture(ev.pointerId);
  }

  function onPointerMove(ev: PointerEvent) {
    if (!dragging) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;

    const ROT_SPEED = 0.005;
    theta -= dx * ROT_SPEED;
    phi -= dy * ROT_SPEED;
    const EPS = 0.1;
    phi = Math.max(EPS, Math.min(Math.PI - EPS, phi));
  }

  function onPointerUp(ev: PointerEvent) {
    dragging = false;
    options.canvas.releasePointerCapture(ev.pointerId);
  }

  function onWheel(ev: WheelEvent) {
    const delta = ev.deltaY * 0.002;
    radius = Math.min(options.maxRadius, Math.max(options.minRadius, radius + delta));
  }

  options.canvas.addEventListener('pointerdown', onPointerDown);
  options.canvas.addEventListener('pointermove', onPointerMove);
  options.canvas.addEventListener('pointerup', onPointerUp);
  options.canvas.addEventListener('pointercancel', onPointerUp);
  options.canvas.addEventListener('wheel', onWheel, { passive: true });

  updateCamera();

  return {
    update: updateCamera,
  };
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

function buildExposureScene(
  scene: THREE.Scene,
  config: ReturnType<typeof createBoardRenderConfig>
): void {
  const geometry = createBeveledBoxGeometry({
    width: config.blockSize,
    height: config.blockSize,
    depth: config.blockDepth,
    radius: config.edgeRadius,
    smoothness: 3,
  });
  applyMahjongUVLayout(geometry);
  tagFrontGroup(geometry);

  const tileTexture = createMahjongTileTexture(1024);
  const { roughnessMap, metalnessMap, aoMap } = createMahjongMaterialMaps(
    tileTexture.image.width ?? 1024
  );

  const { frontMaterial, sideMaterial } = createProductionMaterials(tileTexture, {
    roughnessMap,
    metalnessMap,
    aoMap,
  });

  const cube = new THREE.Mesh(geometry, [frontMaterial, sideMaterial]);
  cube.position.set(0, config.blockSize * 0.5, 0);
  cube.castShadow = false;
  cube.receiveShadow = false;
  cube.name = 'productionCube';

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(config.blockSize * 8, config.blockSize * 8),
    new THREE.MeshStandardMaterial({
      color: 0x101010,
      metalness: 0,
      roughness: 0.8,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  floor.name = 'floor';

  const ambient = new THREE.AmbientLight(0xfff7e8, 0.85);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xfffbf2, 0x0b0c0e, 6.5);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff6dc, 8.5);
  keyLight.position.set(12, 12, 8);
  keyLight.target.position.set(0, 0, 0);
  scene.add(keyLight);
  scene.add(keyLight.target);

  const overhead = new THREE.DirectionalLight(0xfff5d7, 6.0);
  overhead.position.set(0, 15, 0);
  overhead.target.position.set(0, 0, 0);
  scene.add(overhead);
  scene.add(overhead.target);

  const rimLight = new THREE.DirectionalLight(0xcfe4ff, 4.5);
  rimLight.position.set(-9, 9, -7);
  rimLight.target.position.set(0, 0, 0);
  scene.add(rimLight);
  scene.add(rimLight.target);

  const backLight = new THREE.DirectionalLight(0xeaf3ff, 5.5);
  backLight.position.set(-12, 11, -10);
  backLight.target.position.set(0, 0, 0);
  scene.add(backLight);
  scene.add(backLight.target);

  const sideFill = new THREE.PointLight(0xfff2ce, 2.0, 35);
  sideFill.position.set(-5, config.blockSize * 0.8, -3);
  scene.add(sideFill);

  const bounce = new THREE.PointLight(0xffd8a0, 3.0, 50);
  bounce.position.set(0, config.blockSize * 0.6, 5);
  scene.add(bounce);

  scene.add(cube);
  scene.add(floor);
}

function createProductionMaterials(
  tileTexture: THREE.Texture,
  maps: { roughnessMap: THREE.Texture; metalnessMap: THREE.Texture; aoMap: THREE.Texture }
): { frontMaterial: THREE.MeshStandardMaterial; sideMaterial: THREE.MeshStandardMaterial } {
  const frontMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tileTexture,
    roughness: 0.22,
    metalness: 0.04,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    envMapIntensity: 0.9,
  });

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2c14b,
    map: tileTexture,
    roughness: 0.28,
    metalness: 1.0,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    envMapIntensity: 1.8,
  });

  return { frontMaterial, sideMaterial };
}

function tagFrontGroup(geometry: THREE.BufferGeometry): void {
  if (!geometry.groups.length) {
    return;
  }
  const FRONT_GROUP_INDEX = 4; // BoxGeometry order: +X, -X, +Y, -Y, +Z, -Z
  geometry.groups.forEach((group, idx) => {
    group.materialIndex = idx === FRONT_GROUP_INDEX ? 0 : 1;
  });
}

function setupExposureControls(onChange: (value: number) => void, start: number): void {
  let idx = Math.max(0, EXPOSURE_PRESETS.indexOf(start));
  const clampIndex = () => Math.max(0, Math.min(EXPOSURE_PRESETS.length - 1, idx));
  const apply = () => onChange(EXPOSURE_PRESETS[clampIndex()]);

  function handleKey(ev: KeyboardEvent) {
    if (ev.key === 'ArrowLeft') {
      idx -= 1;
      apply();
    } else if (ev.key === 'ArrowRight') {
      idx += 1;
      apply();
    } else if (ev.key >= '1' && ev.key <= String(EXPOSURE_PRESETS.length)) {
      idx = Number(ev.key) - 1;
      apply();
    }
  }

  window.addEventListener('keydown', handleKey);
  apply();
}

function createExposureOverlay(initial: number): (value: number) => void {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '12px';
  overlay.style.left = '12px';
  overlay.style.padding = '10px 12px';
  overlay.style.background = 'rgba(0, 0, 0, 0.65)';
  overlay.style.color = '#f5f5f5';
  overlay.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  overlay.style.fontSize = '12px';
  overlay.style.borderRadius = '8px';
  overlay.style.lineHeight = '1.5';
  overlay.style.zIndex = '9999';
  document.body.appendChild(overlay);

  const update = (value: number) => {
    overlay.textContent = `Exposure presets [1..${EXPOSURE_PRESETS.length}, ←/→]:
${EXPOSURE_PRESETS.map((v) => `${v.toFixed(2)}${v === value ? ' ◀ current' : ''}`).join('  |  ')}`;
  };

  update(initial);
  return update;
}
