import { createRenderContext, resizeRenderer, renderFrame, renderScene } from './render';
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

    let snapshot = controller.update(deltaMs);
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

    renderScene(renderCtx, snapshot, destructionPayload);
    updateCameraMotion(renderCtx, timestamp);
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
