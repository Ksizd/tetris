import * as THREE from 'three';
import { Board } from '../core/board';
import { CellContent, BoardDimensions, GameStatus } from '../core/types';
import { createInitialGameState } from '../core/state/initialState';
import { GameState } from '../core/state/gameState';
import {
  createRenderContext,
  RenderConfig,
  RenderConfigOverrides,
  RenderContext,
  renderScene,
  resizeRenderer,
} from '../render';
import { updateCameraMotion } from '../render/cameraMotion';
import {
  createVisualDebugControls,
  VisualControlState,
  VisualDebugControls,
} from './visualDebugControls';

const QUERY_FLAG = 'visualDebug';

export function isVisualDebugModeEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(QUERY_FLAG);
  return value === '1' || value === 'true';
}

export function startVisualDebugMode(canvas: HTMLCanvasElement): void {
  let renderCtx = createRenderContext(canvas);
  let snapshot = createStaticSnapshot(renderCtx.renderConfig.boardDimensions);
  let controlState = configToControlState(renderCtx.renderConfig);
  const cameraOrientation = extractCameraOrientation(renderCtx.renderConfig);
  const controls = createVisualDebugControls(controlState, (next) => {
    controlState = next;
    pendingRebuild = true;
  });

  logVisualParameters(renderCtx);

  let pendingRebuild = false;

  function rebuildContextIfNeeded() {
    if (!pendingRebuild) {
      return;
    }
    pendingRebuild = false;

    disposeRenderResources(renderCtx);
    const overrides = controlStateToOverrides(controlState, cameraOrientation);
    renderCtx = createRenderContext(canvas, overrides);
    snapshot = createStaticSnapshot(renderCtx.renderConfig.boardDimensions);
    logVisualParameters(renderCtx);
  }

  function loop() {
    rebuildContextIfNeeded();
    renderScene(renderCtx, snapshot);
    updateCameraMotion(renderCtx, performance.now());
    renderCtx.renderer.render(renderCtx.scene, renderCtx.camera);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  window.addEventListener('resize', () => {
    resizeRenderer(renderCtx, canvas.clientWidth, canvas.clientHeight);
  });

  attachControlsDisposalOnUnload(controls);
}

function createStaticSnapshot(dimensions: BoardDimensions): GameState {
  const base = createInitialGameState({ board: dimensions });
  const board = buildStaticBoard(dimensions);
  return {
    ...base,
    board,
    currentPiece: null,
    gameStatus: GameStatus.Paused,
    timing: { ...base.timing, fallProgressMs: 0 },
  };
}

function buildStaticBoard(dimensions: BoardDimensions): Board {
  const board = Board.createEmpty(dimensions);
  const filledLayers = Math.min(dimensions.height, Math.max(4, Math.floor(dimensions.height * 0.3)));

  for (let y = 0; y < filledLayers; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      board.setCell({ x, y }, CellContent.Block);
    }
  }

  const accentLayer = Math.min(dimensions.height - 1, filledLayers + 1);
  for (let x = 0; x < dimensions.width; x += 2) {
    board.setCell({ x, y: accentLayer }, CellContent.Block);
  }

  return board;
}

function configToControlState(config: RenderConfig): VisualControlState {
  const delta = config.camera.position.clone().sub(config.camera.target);
  return {
    fov: config.camera.fov,
    cameraDistance: delta.length(),
    cameraHeight: config.camera.position.y,
    towerRadius: config.board.towerRadius,
    ambientIntensity: config.lights.ambient.intensity,
    hemisphereIntensity: config.lights.hemisphere.intensity,
    keyIntensity: config.lights.key.intensity,
  };
}

interface CameraOrientation {
  target: THREE.Vector3;
  azimuthXZ: THREE.Vector2;
}

function extractCameraOrientation(config: RenderConfig): CameraOrientation {
  const target = config.camera.target.clone();
  const azimuthVector = new THREE.Vector2(
    config.camera.position.x - target.x,
    config.camera.position.z - target.z
  );
  const azimuthXZ = azimuthVector.lengthSq() > 0 ? azimuthVector.normalize() : new THREE.Vector2(1, 0);
  return { target, azimuthXZ };
}

function controlStateToOverrides(
  state: VisualControlState,
  orientation: CameraOrientation
): RenderConfigOverrides {
  const dy = state.cameraHeight - orientation.target.y;
  const horizontal = Math.max(0.01, Math.sqrt(Math.max(state.cameraDistance ** 2 - dy ** 2, 0)));
  const position = new THREE.Vector3(
    orientation.target.x + orientation.azimuthXZ.x * horizontal,
    state.cameraHeight,
    orientation.target.z + orientation.azimuthXZ.y * horizontal
  );

  return {
    camera: {
      fov: state.fov,
      position,
      target: orientation.target.clone(),
    },
    board: {
      towerRadius: state.towerRadius,
    },
    lights: {
      ambient: { intensity: state.ambientIntensity },
      hemisphere: { intensity: state.hemisphereIntensity },
      key: { intensity: state.keyIntensity },
    },
  };
}

function disposeRenderResources(ctx: RenderContext): void {
  ctx.board.geometry.dispose();
  disposeMaterials(ctx.board.material);
  ctx.activePiece.geometry.dispose();
  disposeMaterials(ctx.activePiece.material);
  disposeMeshes(ctx.boardPlaceholder);
  ctx.renderer.dispose();
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

function disposeMaterials(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
    return;
  }
  material.dispose();
}

function attachControlsDisposalOnUnload(controls: VisualDebugControls): void {
  window.addEventListener(
    'beforeunload',
    () => {
      controls.dispose();
    },
    { once: true }
  );
}

function logVisualParameters(ctx: RenderContext): void {
  const { boardDimensions, board, camera, lights, postProcessing } = ctx.renderConfig;
  console.groupCollapsed('Visual debug mode');
  console.log('board', {
    dimensions: boardDimensions,
    blockSize: board.blockSize,
    verticalSpacing: board.verticalSpacing,
    towerRadius: board.towerRadius,
  });
  console.log('camera', {
    fov: camera.fov,
    position: camera.position.toArray(),
    target: camera.target.toArray(),
  });
  console.log('lights', {
    ambient: lights.ambient,
    hemisphere: lights.hemisphere,
    key: {
      ...lights.key,
      position: lights.key.position.toArray(),
      target: lights.key.target?.toArray(),
    },
  });
  console.log('postProcessing', postProcessing);
  console.groupEnd();
}
