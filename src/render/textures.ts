import * as THREE from 'three';

function drawTileSymbol(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, size, size);

  // border
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = size * 0.06;
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);

  // simple "竹" inspired strokes
  ctx.strokeStyle = '#c11a1a';
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.35, size * 0.25);
  ctx.lineTo(size * 0.35, size * 0.75);
  ctx.moveTo(size * 0.65, size * 0.3);
  ctx.lineTo(size * 0.65, size * 0.7);
  ctx.moveTo(size * 0.35, size * 0.5);
  ctx.lineTo(size * 0.65, size * 0.5);
  ctx.stroke();
}

export function createMahjongTileTexture(size = 256): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([245, 245, 245, 255]);
    const placeholder = new THREE.DataTexture(data, 1, 1);
    placeholder.colorSpace = THREE.SRGBColorSpace;
    placeholder.needsUpdate = true;
    return placeholder;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawTileSymbol(ctx, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}
