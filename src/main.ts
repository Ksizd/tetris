import * as THREE from 'three';
import { createRenderContext, resizeRenderer, renderFrame, renderScene, RenderContext } from './render';
import { updateCameraMotion } from './render/cameraMotion';
import { GameController } from './app/gameController';
import { GameEventType } from './app/events';
import { KeyboardInput } from './input/keyboardInput';
import { HudView, mapGameStateToHudData } from './ui/hud';
import { OverlayView } from './ui/overlay';
import { mapGameStatusToUIState } from './ui/uiState';
import { isVisualDebugModeEnabled, startVisualDebugMode } from './app/visualDebugMode';
import { isTextureProbeEnabled, startTextureProbe } from './app/textureProbe';
import { QualityLevel, RenderConfigOverrides } from './render/renderConfig';
import { wrapX } from './core/coords';
import { getWorldBlocks } from './core/piece';
import { ActivePiece, CellCoord, GameStatus } from './core/types';
import { GameState } from './core/state/gameState';
import { computeHardDropPosition } from './core/state';
import {
  clearDestruction,
  createDestructionOrchestratorState,
  startDestructionFromEvent,
  stepDestruction,
} from './app/destruction/destructionRuntime';
import { completeLineDestructionIfFinished } from './app/destruction/simulationManager';

const canvas = document.getElementById('render-canvas') as HTMLCanvasElement | null;

if (!canvas) {
  throw new Error('Render canvas element #render-canvas not found');
}

if (isTextureProbeEnabled()) {
  startTextureProbe(canvas);
} else if (isVisualDebugModeEnabled()) {
  startVisualDebugMode(canvas);
} else {
  const hudContainer = document.getElementById('hud');
  const overlayContainer = document.getElementById('overlay');

  if (!hudContainer) {
    throw new Error('HUD container #hud not found');
  }

  if (!overlayContainer) {
    throw new Error('Overlay container #overlay not found');
  }

  console.log('Tower Tetris 3D app initialized', { canvas, hudContainer });

  const quality = parseQualityFromUrl(window.location.search);
  const renderOverrides: RenderConfigOverrides = {
    renderMode: { kind: 'game' },
  };
  if (quality) {
    renderOverrides.quality = { level: quality };
  }
  const renderCtx = createRenderContext(canvas, renderOverrides);
  const renderState = {
    cameraFollow: {
      enabled: renderCtx.renderConfig.cameraGameMode === 'followPiece',
      columnIndex: deriveColumnFromCamera(renderCtx.renderConfig.boardDimensions.width, renderCtx.camera),
      width: renderCtx.renderConfig.boardDimensions.width,
      snap: false,
    },
    ghost: {
      cells: [] as CellCoord[],
      visible: false,
    },
  };
  const controller = new GameController();
  const keyboard = new KeyboardInput({
    onCommand: (command) => controller.enqueueCommand(command),
  });
  keyboard.start();
  const hud = new HudView(hudContainer);
  const overlay = new OverlayView({
    container: overlayContainer,
    onStart: () => controller.startNewGame(),
    onRestart: () => controller.startNewGame(),
  });
  let destructionState = createDestructionOrchestratorState();

  let lastTimestamp = performance.now();

  function loop(timestamp: number) {
    const deltaMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    controller.setSpawnColumnHint(renderState.cameraFollow.columnIndex);

    let snapshot = controller.update(deltaMs);
    let spawnSnap = false;
    controller.getEvents().forEach((event) => {
      if (event.type === GameEventType.StartLineDestruction) {
        destructionState = startDestructionFromEvent(
          destructionState,
          snapshot.board,
          renderCtx.mapper,
          event.clearedLevels,
          timestamp
        );
      }
      if (event.type === GameEventType.NewPieceSpawned) {
        spawnSnap = true;
      }
    });

    const destructionStep = stepDestruction(destructionState, deltaMs, timestamp);
    destructionState = destructionStep.state;
    let destructionPayload = {
      hiddenCells: destructionStep.hiddenCells,
      fragmentBuckets: destructionStep.fragmentsByTemplate,
    };
    if (destructionStep.finished && destructionState.simulation) {
      const completion = completeLineDestructionIfFinished(snapshot, destructionState.simulation);
      if (completion.completed) {
        snapshot = controller.applyExternalState(completion.game);
        destructionState = clearDestruction(destructionState);
        destructionPayload = {
          hiddenCells: new Set(),
          fragmentBuckets: new Map(),
        };
      }
    }

    const followColumn = snapshot.currentPiece
      ? deriveColumnFromPiece(
          snapshot.currentPiece,
          renderCtx.renderConfig.boardDimensions.width,
          renderCtx.renderConfig.boardDimensions.height
        )
      : renderState.cameraFollow.columnIndex;
    renderState.cameraFollow = {
      enabled: renderCtx.renderConfig.cameraGameMode === 'followPiece',
      columnIndex: followColumn,
      width: renderCtx.renderConfig.boardDimensions.width,
      snap: spawnSnap,
    };
    renderState.ghost = deriveGhostState(snapshot, renderCtx);

    renderScene(renderCtx, snapshot, destructionPayload, renderState.cameraFollow, deltaMs, renderState.ghost);
    if (renderCtx.renderConfig.cameraGameMode !== 'followPiece') {
      updateCameraMotion(renderCtx, timestamp);
    }
    renderFrame(renderCtx, deltaMs);
    hud.render(mapGameStateToHudData(snapshot));
    overlay.render(mapGameStatusToUIState(snapshot.gameStatus));

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  window.addEventListener('resize', () => {
    resizeRenderer(renderCtx, canvas.clientWidth, canvas.clientHeight);
  });
}

function parseQualityFromUrl(search: string): QualityLevel | null {
  const params = new URLSearchParams(search);
  const raw = params.get('quality')?.toLowerCase();
  if (raw === 'ultra' || raw === 'medium' || raw === 'low') {
    return raw as QualityLevel;
  }
  if (raw === 'ultra2' || raw === 'ultra_cinematic') {
    return 'ultra2';
  }
  return null;
}

function deriveColumnFromPiece(piece: ActivePiece, width: number, height: number): number {
  const blocks = getWorldBlocks(piece, { width, height });
  if (blocks.length === 0) {
    return wrapX(piece.position.x, width);
  }
  let sumX = 0;
  let sumZ = 0;
  blocks.forEach((cell) => {
    const angle = (2 * Math.PI * wrapX(cell.x, width)) / width;
    sumX += Math.cos(angle);
    sumZ += Math.sin(angle);
  });
  const angle = Math.atan2(sumZ, sumX);
  return angleToColumnIndex(angle, width);
}

function deriveColumnFromCamera(width: number, camera: THREE.PerspectiveCamera): number {
  const angle = Math.atan2(camera.position.z, camera.position.x);
  return angleToColumnIndex(angle, width);
}

function angleToColumnIndex(angle: number, width: number): number {
  const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const column = Math.round((normalized / (2 * Math.PI)) * width) % width;
  return wrapX(column, width);
}

function deriveGhostState(snapshot: Readonly<GameState>, renderCtx: RenderContext) {
  const isActive =
    snapshot.currentPiece &&
    snapshot.gameStatus === GameStatus.Running &&
    snapshot.clearingLayers.length === 0;
  if (!isActive) {
    return { cells: [], visible: false };
  }
  const ghost = computeHardDropPosition(snapshot as any);
  if (!ghost) {
    return { cells: [], visible: false };
  }
  const cells = getWorldBlocks(ghost, renderCtx.renderConfig.boardDimensions).filter(
    (cell) => cell.y >= 0 && cell.y < renderCtx.renderConfig.boardDimensions.height
  );
  return { cells, visible: true };
}
