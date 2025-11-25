const canvas = document.getElementById('render-canvas') as HTMLCanvasElement | null;
const hudContainer = document.getElementById('hud');

if (!canvas) {
  throw new Error('Render canvas element #render-canvas not found');
}

if (!hudContainer) {
  throw new Error('HUD container #hud not found');
}

console.log('Tower Tetris 3D app initialized', { canvas, hudContainer });
