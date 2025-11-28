import * as THREE from 'three';
import { BoardToWorldMapper } from './boardToWorldMapper';
import { createBoardPlaceholder } from './boardPlaceholder';
import { createBoardInstancedMesh } from './boardInstancedMesh';
import { createActivePieceInstancedMesh } from './activePieceInstancedMesh';
import { ActivePieceInstancedResources } from './activePieceInstancedMesh';
import { BoardInstancedResources } from './boardInstancedMesh';
import { createRenderConfig, LightRigConfig, RenderConfig, RenderConfigOverrides } from './renderConfig';
import { recomputeCameraPlacementForFrame } from './cameraSetup';
import { createEnvironmentMap, EnvironmentMapResources } from './environmentMap';

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
}

/**
 * D~D«D,¥+D,DøD¯D,DúD,¥?¥ŸDæ¥, DñDøDúD_Dý¥Ÿ¥Z 3D-¥?¥+DæD«¥Ÿ D«Dø D¨Dæ¥?DæD'DøD«D«D_D¬ canvas.
 */
export function createRenderContext(
  canvas: HTMLCanvasElement,
  overrides?: RenderConfigOverrides
): RenderContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const renderConfig = createRenderConfig(overrides);
  const mapper = new BoardToWorldMapper(renderConfig.boardDimensions, renderConfig.board);

  const camera = new THREE.PerspectiveCamera(
    renderConfig.camera.fov,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  const glctx = renderer.getContext();
  // We don't use 3D/array textures; skip texImage3D to avoid driver spam on flipY checks.
  glctx.texImage3D = function noopTexImage3D() {
    return;
  };

  addLighting(scene, renderConfig.lights);
  const environment = createEnvironmentMap(renderer, renderConfig.environment);
  if (environment) {
    scene.environment = environment.environmentMap;
    if (renderConfig.environment.useAsBackground && environment.backgroundTexture) {
      scene.background = environment.backgroundTexture;
    }
  }

  const placeholder = createBoardPlaceholder(renderConfig.boardDimensions, renderConfig.board);
  scene.add(placeholder.group);

  const boardInstanced = createBoardInstancedMesh(renderConfig.boardDimensions, renderConfig.board);
  scene.add(boardInstanced.mesh);

  const activePieceInstanced = createActivePieceInstancedMesh(renderConfig.board);
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
    cameraBasePlacement: {
      position: renderConfig.camera.position.clone(),
      target: renderConfig.camera.target.clone(),
    },
    environment,
  };
}

function addLighting(scene: THREE.Scene, config: LightRigConfig): void {
  const hemi = new THREE.HemisphereLight(
    config.hemisphere.skyColor,
    config.hemisphere.groundColor,
    config.hemisphere.intensity
  );
  hemi.position.set(0, 1, 0);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(config.ambient.color, config.ambient.intensity);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(config.key.color, config.key.intensity);
  key.position.copy(config.key.position);
  if (config.key.target) {
    key.target.position.copy(config.key.target);
    scene.add(key.target);
  }
  key.castShadow = Boolean(config.key.castShadow);
  scene.add(key);

  const rim = new THREE.DirectionalLight(config.rim.color, config.rim.intensity);
  rim.position.copy(config.rim.position);
  if (config.rim.target) {
    rim.target.position.copy(config.rim.target);
    scene.add(rim.target);
  }
  rim.castShadow = Boolean(config.rim.castShadow);
  scene.add(rim);
}

export function resizeRenderer(ctx: RenderContext, width: number, height: number): void {
  ctx.renderer.setSize(width, height, false);
  ctx.camera.aspect = width / height;
  ctx.camera.updateProjectionMatrix();

  const adjustedPlacement = recomputeCameraPlacementForFrame(
    ctx.renderConfig.boardDimensions,
    ctx.renderConfig.board,
    ctx.renderConfig.camera,
    ctx.renderConfig.camera.fov
  );
  ctx.camera.position.copy(adjustedPlacement.position);
  ctx.camera.lookAt(adjustedPlacement.target);
  ctx.renderConfig.camera.position.copy(adjustedPlacement.position);
  ctx.renderConfig.camera.target.copy(adjustedPlacement.target);
  ctx.cameraBasePlacement.position.copy(adjustedPlacement.position);
  ctx.cameraBasePlacement.target.copy(adjustedPlacement.target);
}
