import { createRenderContext, resizeRenderer } from './render';
import { GameController } from './app/gameController';
import { GameCommandType } from './core/types/commands';

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

let lastTimestamp = performance.now();

function loop(timestamp: number) {
  const deltaMs = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  controller.update(deltaMs);
  // TODO: renderScene(snapshot) — когда появится реальный рендер башни
  renderCtx.renderer.render(renderCtx.scene, renderCtx.camera);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

window.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'ArrowLeft':
      controller.enqueueCommand({ type: GameCommandType.MoveLeft });
      break;
    case 'ArrowRight':
      controller.enqueueCommand({ type: GameCommandType.MoveRight });
      break;
    case 'ArrowUp':
      controller.enqueueCommand({ type: GameCommandType.RotateCW });
      break;
    case 'ArrowDown':
      controller.enqueueCommand({ type: GameCommandType.SoftDrop });
      break;
    case 'Space':
      controller.enqueueCommand({ type: GameCommandType.HardDrop });
      break;
    case 'KeyP':
      controller.enqueueCommand({ type: GameCommandType.TogglePause });
      break;
    default:
      break;
  }
});

window.addEventListener('resize', () => {
  resizeRenderer(renderCtx, canvas.clientWidth, canvas.clientHeight);
});
