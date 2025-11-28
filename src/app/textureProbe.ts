import * as THREE from 'three';
import { createBoardRenderConfig } from '../render/boardConfig';
import { createBeveledBoxGeometry } from '../render/beveledBoxGeometry';
import { applyMahjongUVLayout } from '../render/uv';
import { createMahjongMaterialMaps, createMahjongTileTexture } from '../render/textures';

const QUERY_FLAG = 'textureProbe';

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
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1016);

  const camera = new THREE.PerspectiveCamera(35, getAspect(canvas), 0.1, 100);
  const target = new THREE.Vector3(0, 0, 0);

  const dims = { width: 12, height: 24 };
  const config = createBoardRenderConfig(dims);
  const geometry = createBeveledBoxGeometry({
    width: config.blockSize,
    height: config.blockSize,
    depth: config.blockDepth,
    radius: config.edgeRadius,
    smoothness: 3,
  });
  applyMahjongUVLayout(geometry);

  const tileTexture = createMahjongTileTexture(1024);
  const { roughnessMap, metalnessMap, aoMap } = createMahjongMaterialMaps(tileTexture.image.width ?? 1024);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tileTexture,
    roughness: 1.0,
    metalness: 1.0,
    roughnessMap,
    metalnessMap,
    aoMap,
    envMapIntensity: 1.1,
  });

  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(0, 0, 0);
  scene.add(cube);

  addLights(scene);

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

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.6);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(4, 6, 3);
  scene.add(dir);
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
