import * as THREE from 'three';
import { DEFAULT_BOARD_DIMENSIONS } from '../core/constants';
import { createBoardRenderConfig } from './boardConfig';
import { BoardToWorldMapper } from './boardToWorldMapper';
import { createBoardPlaceholder } from './boardPlaceholder';
import { createBoardInstancedMesh } from './boardInstancedMesh';
import { computeCameraPlacement } from './cameraSetup';
import { createActivePieceInstancedMesh } from './activePieceInstancedMesh';
import { ActivePieceInstancedResources } from './activePieceInstancedMesh';
import { BoardInstancedResources } from './boardInstancedMesh';

export interface RenderContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  boardPlaceholder: THREE.Group;
  board: BoardInstancedResources;
  activePiece: ActivePieceInstancedResources;
  mapper: BoardToWorldMapper;
  renderConfig: ReturnType<typeof createBoardRenderConfig>;
}

/**
 * D~D«D,¥+D,DøD¯D,DúD,¥?¥ŸDæ¥, DñDøDúD_Dý¥Ÿ¥Z 3D-¥?¥+DæD«¥Ÿ D«Dø D¨Dæ¥?DæD'DøD«D«D_D¬ canvas.
 */
export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const renderConfig = createBoardRenderConfig(DEFAULT_BOARD_DIMENSIONS);
  const mapper = new BoardToWorldMapper(DEFAULT_BOARD_DIMENSIONS, renderConfig);

  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
  );
  const cameraPlacement = computeCameraPlacement(DEFAULT_BOARD_DIMENSIONS, renderConfig);
  camera.position.copy(cameraPlacement.position);
  camera.lookAt(cameraPlacement.target);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  addLighting(scene, cameraPlacement);

  const placeholder = createBoardPlaceholder(DEFAULT_BOARD_DIMENSIONS, renderConfig);
  scene.add(placeholder.group);

  const boardInstanced = createBoardInstancedMesh(DEFAULT_BOARD_DIMENSIONS, renderConfig);
  scene.add(boardInstanced.mesh);

  const activePieceInstanced = createActivePieceInstancedMesh(renderConfig);
  scene.add(activePieceInstanced.mesh);

  return {
    scene,
    camera,
    renderer,
    boardPlaceholder: placeholder.group,
    board: boardInstanced,
    activePiece: activePieceInstanced,
    mapper,
    renderConfig,
  };
}

function addLighting(
  scene: THREE.Scene,
  cameraPlacement: ReturnType<typeof computeCameraPlacement>
): void {
  const hemi = new THREE.HemisphereLight(0xfff8e1, 0x2a1a0a, 0.55);
  hemi.position.set(0, 1, 0);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff3cc, 0.9);
  key.position.set(
    cameraPlacement.position.x * 0.4,
    cameraPlacement.position.y * 0.8,
    cameraPlacement.position.z * 0.4
  );
  key.castShadow = false;
  scene.add(key);
}

export function resizeRenderer(ctx: RenderContext, width: number, height: number): void {
  ctx.renderer.setSize(width, height, false);
  ctx.camera.aspect = width / height;
  ctx.camera.updateProjectionMatrix();
}
