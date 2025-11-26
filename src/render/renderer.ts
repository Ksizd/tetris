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

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(
    cameraPlacement.position.x * 0.1,
    cameraPlacement.position.y,
    cameraPlacement.position.z * 0.1
  );
  scene.add(light);

  const ambient = new THREE.AmbientLight(0x404040);
  scene.add(ambient);

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

export function resizeRenderer(ctx: RenderContext, width: number, height: number): void {
  ctx.renderer.setSize(width, height, false);
  ctx.camera.aspect = width / height;
  ctx.camera.updateProjectionMatrix();
}
