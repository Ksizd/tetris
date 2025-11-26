import { createRenderContext, resizeRenderer, renderScene } from './render';
import { GameController } from './app/gameController';
import { KeyboardInput } from './input/keyboardInput';

const canvas = document.getElementById('render-canvas') as HTMLCanvasElement | null;
const hudContainer = document.getElementById('hud');

if (!canvas) {
  throw new Error('Render canvas element #render-canvas not found');
}

if (!hudContainer) {
  throw new Error('HUD container #hud not found');
}

console.log('Tower Tetris 3D app initialized', { canvas, hudContainer });

const renderCtx = createRenderContext(canvas);
const controller = new GameController();
const keyboard = new KeyboardInput({
  onCommand: (command) => controller.enqueueCommand(command),
});
keyboard.start();

let lastTimestamp = performance.now();

function loop(timestamp: number) {
  const deltaMs = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  const snapshot = controller.update(deltaMs);
  renderScene(renderCtx, snapshot);
  renderCtx.renderer.render(renderCtx.scene, renderCtx.camera);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

window.addEventListener('resize', () => {
  resizeRenderer(renderCtx, canvas.clientWidth, canvas.clientHeight);
});
