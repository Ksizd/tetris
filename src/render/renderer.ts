import * as THREE from 'three';

export interface RenderContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cube?: THREE.Mesh;
}

/**
 * Инициализирует базовую 3D-сцену на переданном canvas.
 */
export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
  );
  // Камера нацелена на центр башни, чуть сверху, чтобы башня целиком помещалась в кадр.
  const towerHeight = 30;
  const distance = 60;
  camera.position.set(0, towerHeight * 0.6, distance);
  camera.lookAt(new THREE.Vector3(0, towerHeight * 0.5, 0));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 10);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0x404040);
  scene.add(ambient);

  const cube = createTestCube();
  scene.add(cube);

  return { scene, camera, renderer, cube };
}

export function resizeRenderer(ctx: RenderContext, width: number, height: number): void {
  ctx.renderer.setSize(width, height, false);
  ctx.camera.aspect = width / height;
  ctx.camera.updateProjectionMatrix();
}

function createTestCube(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 1, 0);
  return mesh;
}
