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
import { OrbitCameraController } from './orbitCamera';
import { QualityLevel } from '../render/renderConfig';
import { applyMaterialDebugMode, createMaterialsSnapshot, MaterialDebugMode } from '../render/materialDebug';
import { deriveEnvOverrides, applyEnvDebugMode } from '../render/envDebug';

type CameraMode = 'game' | 'inspect';

const QUERY_FLAG = 'visualDebug';
const CAMERA_TOGGLE_KEY = 'c';
const CLOSEUP_KEY = 'v';
const TRANSITION_DURATION_MS = 450;
const GAME_MODE_ROTATION_LIMIT = THREE.MathUtils.degToRad(6);
const GAME_MODE_ROTATION_SPEED = 0.00035;

export function isVisualDebugModeEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(QUERY_FLAG);
  return value === '1' || value === 'true';
}

export function startVisualDebugMode(canvas: HTMLCanvasElement): void {
  const qualityFromUrl = parseQualityFromUrl(window.location.search);
  const renderOverrides: RenderConfigOverrides = qualityFromUrl ? { quality: { level: qualityFromUrl } } : {};
  let renderCtx = createRenderContext(canvas, renderOverrides);
  let snapshot = createStaticSnapshot(renderCtx.renderConfig.boardDimensions);
  let controlState = configToControlState(renderCtx.renderConfig);
  let materialsSnapshot = createMaterialsSnapshot(renderCtx.board, renderCtx.activePiece);
  const cameraOrientation = extractCameraOrientation(renderCtx.renderConfig);
  let cameraMode: CameraMode = 'game';
  let gameRotationAngle = 0;
  let lastFrameTime = performance.now();
  const orbitControllerRef: { current: OrbitCameraController | null } = { current: null };
  const createOrbit = (placement = renderCtx.cameraBasePlacement) => {
    const ctrl = new OrbitCameraController(renderCtx.camera, placement, {
      minDistance: renderCtx.renderConfig.board.towerRadius * 1.25,
      innerDistance: renderCtx.renderConfig.board.towerRadius + renderCtx.renderConfig.board.blockSize * 0.6,
      maxDistance: renderCtx.renderConfig.board.towerRadius * 3.2,
      minPolarAngle: THREE.MathUtils.degToRad(18),
      maxPolarAngle: THREE.MathUtils.degToRad(82),
      minTargetY: renderCtx.renderConfig.board.blockSize * 0.4,
      floorY: 0,
    });
    ctrl.attach(canvas);
    orbitControllerRef.current = ctrl;
  };
  createOrbit();
  const switchToGame = () => {
    cameraMode = 'game';
    orbitControllerRef.current?.detach(canvas);
    orbitControllerRef.current = null;
    transitionCamera(renderCtx, renderCtx.cameraBasePlacement);
  };

  const switchToInspect = (placement?: { position: THREE.Vector3; target: THREE.Vector3 }) => {
    cameraMode = 'inspect';
    const basePlacement = placement ?? orbitControllerRef.current?.getPlacement() ?? renderCtx.cameraBasePlacement;
    orbitControllerRef.current?.detach(canvas);
    createOrbit(basePlacement);
  };
  const controls = createVisualDebugControls(controlState, (next) => {
    controlState = next;
    if (controlState.materialDebugMode !== next.materialDebugMode) {
      applyMaterialDebugMode(renderCtx.board, renderCtx.activePiece, next.materialDebugMode, materialsSnapshot);
    }
    if (controlState.envDebugMode !== next.envDebugMode) {
      applyEnvDebugMode(renderCtx, next.envDebugMode);
    }
    pendingRebuild = true;
  }, () => {
    controlState = configToControlState(renderCtx.renderConfig);
    controlState.materialDebugMode = 'none';
    controlState.envDebugMode = 'full';
    controlState.autoRotateEnabled = false;
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
    orbitControllerRef.current?.detach(canvas);
    createOrbit();
    materialsSnapshot = createMaterialsSnapshot(renderCtx.board, renderCtx.activePiece);
    applyMaterialDebugMode(renderCtx.board, renderCtx.activePiece, controlState.materialDebugMode, materialsSnapshot);
    applyEnvDebugMode(renderCtx, controlState.envDebugMode);
    cameraMode = 'game';
    transitionCamera(renderCtx, renderCtx.cameraBasePlacement);
    logVisualParameters(renderCtx);
  }

  function loop() {
    rebuildContextIfNeeded();
    const now = performance.now();
    const dt = Math.max(0, now - lastFrameTime);
    lastFrameTime = now;
    renderScene(renderCtx, snapshot);
    applyCameraMode(renderCtx, cameraMode, orbitControllerRef, dt, controlState.autoRotateEnabled, () => {
      gameRotationAngle += GAME_MODE_ROTATION_SPEED * dt;
      return gameRotationAngle;
    });
    renderCtx.renderer.render(renderCtx.scene, renderCtx.camera);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  window.addEventListener('resize', () => {
    resizeRenderer(renderCtx, canvas.clientWidth, canvas.clientHeight);
  });

  attachControlsDisposalOnUnload(controls);
  attachOrbitDisposalOnUnload(orbitControllerRef, canvas);
  attachCameraModeToggle(() => {
    if (cameraMode === 'game') {
      switchToInspect();
    } else {
      switchToGame();
    }
  });
  attachCloseupHotkey(renderCtx, orbitControllerRef, () => {
    cameraMode = 'inspect';
    switchToInspect(createCloseupPlacement(renderCtx));
  });
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
    autoRotateEnabled: false,
    qualityLevel: config.quality.level,
    materialDebugMode: 'none',
    envDebugMode: 'full',
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
    quality: { level: state.qualityLevel as QualityLevel },
    environment: deriveEnvOverrides(state.envDebugMode),
  };
}

function disposeRenderResources(ctx: RenderContext): void {
  ctx.board.geometry.dispose();
  disposeMaterials(ctx.board.material);
  ctx.activePiece.geometry.dispose();
  disposeMaterials(ctx.activePiece.material);
  disposeMeshes(ctx.boardPlaceholder);
  ctx.environment?.dispose();
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

function attachOrbitDisposalOnUnload(
  ref: { current: OrbitCameraController | null },
  canvas: HTMLCanvasElement
): void {
  window.addEventListener(
    'beforeunload',
    () => {
      ref.current?.detach(canvas);
    },
    { once: true }
  );
}

function attachCameraModeToggle(onToggle: () => void): void {
  const handler = (ev: KeyboardEvent) => {
    if (ev.key.toLowerCase() === CAMERA_TOGGLE_KEY) {
      onToggle();
    }
  };
  window.addEventListener('keydown', handler);
  window.addEventListener(
    'beforeunload',
    () => {
      window.removeEventListener('keydown', handler);
    },
    { once: true }
  );
}

function attachCloseupHotkey(
  ctx: RenderContext,
  orbitRef: { current: OrbitCameraController | null },
  onCloseup: () => void
): void {
  const handler = (ev: KeyboardEvent) => {
    if (ev.key.toLowerCase() === CLOSEUP_KEY) {
      onCloseup();
    }
  };
  window.addEventListener('keydown', handler);
  window.addEventListener(
    'beforeunload',
    () => {
      window.removeEventListener('keydown', handler);
    },
    { once: true }
  );
}

function applyCameraPlacement(ctx: RenderContext, placement: { position: THREE.Vector3; target: THREE.Vector3 }): void {
  ctx.camera.position.copy(placement.position);
  ctx.camera.lookAt(placement.target);
  ctx.renderConfig.camera.position.copy(placement.position);
  ctx.renderConfig.camera.target.copy(placement.target);
}

function transitionCamera(
  ctx: RenderContext,
  targetPlacement: { position: THREE.Vector3; target: THREE.Vector3 }
): void {
  const startPos = ctx.camera.position.clone();
  const startTarget = ctx.renderConfig.camera.target.clone();
  const endPos = targetPlacement.position.clone();
  const endTarget = targetPlacement.target.clone();
  const startTime = performance.now();

  function step() {
    const t = Math.min(1, (performance.now() - startTime) / TRANSITION_DURATION_MS);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
    ctx.camera.position.lerpVectors(startPos, endPos, eased);
    const nextTarget = startTarget.clone().lerp(endTarget, eased);
    ctx.camera.lookAt(nextTarget);
    ctx.renderConfig.camera.position.copy(ctx.camera.position);
    ctx.renderConfig.camera.target.copy(nextTarget);
    if (t < 1) {
      requestAnimationFrame(step);
    }
  }

  step();
}

function applyCameraMode(
  ctx: RenderContext,
  mode: CameraMode,
  orbitRef: { current: OrbitCameraController | null },
  dtMs: number,
  autoRotateEnabled: boolean,
  nextAngle: () => number
): void {
  if (mode === 'inspect') {
    orbitRef.current?.update();
    return;
  }
  const offset = autoRotateEnabled ? nextAngle() : 0;
  const base = ctx.cameraBasePlacement;
  const rotated = new THREE.Vector3(
    base.position.x * Math.cos(offset) - base.position.z * Math.sin(offset),
    base.position.y,
    base.position.x * Math.sin(offset) + base.position.z * Math.cos(offset)
  );
  ctx.camera.position.copy(rotated);
  ctx.camera.lookAt(base.target);
  ctx.renderConfig.camera.position.copy(rotated);
  ctx.renderConfig.camera.target.copy(base.target);
}

function createCloseupPlacement(ctx: RenderContext): { position: THREE.Vector3; target: THREE.Vector3 } {
  const radius = Math.max(ctx.renderConfig.board.blockSize * 3.2, ctx.renderConfig.board.towerRadius * 0.9);
  const baseAzimuth = new THREE.Vector2(ctx.cameraBasePlacement.position.x, ctx.cameraBasePlacement.position.z);
  const dir = baseAzimuth.lengthSq() > 0 ? baseAzimuth.normalize() : new THREE.Vector2(1, 0);
  const targetY = Math.min(
    ctx.renderConfig.board.blockSize * 3,
    computeMidHeight(ctx.renderConfig.boardDimensions, ctx.renderConfig.board)
  );
  const target = new THREE.Vector3(0, targetY, 0);
  const position = new THREE.Vector3(dir.x * radius, targetY + ctx.renderConfig.board.blockSize * 0.6, dir.y * radius);
  return { position, target };
}

function computeMidHeight(dimensions: BoardDimensions, board: BoardRenderConfig): number {
  const towerHeight = (dimensions.height - 1) * board.verticalSpacing + board.blockSize;
  return towerHeight * 0.4;
}

function parseQualityFromUrl(search: string): QualityLevel | null {
  const params = new URLSearchParams(search);
  const raw = params.get('quality')?.toLowerCase();
  if (raw === 'ultra' || raw === 'medium' || raw === 'low') {
    return raw;
  }
  return null;
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
    rim: {
      ...lights.rim,
      position: lights.rim.position.toArray(),
      target: lights.rim.target?.toArray(),
    },
  });
  console.log('postProcessing', postProcessing);
  console.groupEnd();
}
