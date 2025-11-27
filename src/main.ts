import { createRenderContext, resizeRenderer, renderScene } from './render';
import { updateCameraMotion } from './render/cameraMotion';
import { GameController } from './app/gameController';
import { KeyboardInput } from './input/keyboardInput';
import { HudView, mapGameStateToHudData } from './ui/hud';
import { OverlayView } from './ui/overlay';
import { mapGameStatusToUIState } from './ui/uiState';
import { isVisualDebugModeEnabled, startVisualDebugMode } from './app/visualDebugMode';

const canvas = document.getElementById('render-canvas') as HTMLCanvasElement | null;

if (!canvas) {
  throw new Error('Render canvas element #render-canvas not found');
}

if (isVisualDebugModeEnabled()) {
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

  const renderCtx = createRenderContext(canvas);
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

  let lastTimestamp = performance.now();

  function loop(timestamp: number) {
    const deltaMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const snapshot = controller.update(deltaMs);
    renderScene(renderCtx, snapshot);
    updateCameraMotion(renderCtx, timestamp);
    renderCtx.renderer.render(renderCtx.scene, renderCtx.camera);
    hud.render(mapGameStateToHudData(snapshot));
    overlay.render(mapGameStatusToUIState(snapshot.gameStatus));

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  window.addEventListener('resize', () => {
    resizeRenderer(renderCtx, canvas.clientWidth, canvas.clientHeight);
  });
}
