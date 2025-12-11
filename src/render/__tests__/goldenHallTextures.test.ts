import { describe, expect, it } from 'vitest';
import {
  createGoldenHallPedestalTexture,
  createGoldenHallEmissiveRimTexture,
  createGoldenHallWallRoughnessMap,
} from '../textures';

function getPixel(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No 2D context available');
  }
  const data = ctx.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

describe('golden hall procedural textures', () => {
  it('creates pedestal texture with darker center and visible rings', () => {
    const tex = createGoldenHallPedestalTexture(512);
    if (typeof HTMLCanvasElement !== 'undefined' && tex.image instanceof HTMLCanvasElement) {
      const canvas = tex.image;
      expect(canvas.width).toBe(512);
      expect(canvas.height).toBe(512);
      const center = getPixel(canvas, 256, 256);
      const edge = getPixel(canvas, 10, 10);
      expect(center[0] + center[1] + center[2]).toBeLessThan(edge[0] + edge[1] + edge[2]);
    } else {
      const data = (tex.image as { data: Uint8Array }).data;
      expect(data[0] + data[1] + data[2]).toBeLessThan(data[4] + data[5] + data[6]);
    }
  });

  it('creates emissive rim texture with bright outer edge and faded center', () => {
    const tex = createGoldenHallEmissiveRimTexture(256);
    if (typeof HTMLCanvasElement !== 'undefined' && tex.image instanceof HTMLCanvasElement) {
      const canvas = tex.image;
      const center = getPixel(canvas, 128, 128);
      const outer = getPixel(canvas, 255, 128);
      expect(outer[0] + outer[1] + outer[2]).toBeGreaterThan(center[0] + center[1] + center[2]);
    } else {
      const data = (tex.image as { data: Uint8Array }).data;
      const edgeSum = data[0] + data[1] + data[2];
      const centerSum = data[4] + data[5] + data[6];
      expect(edgeSum).toBeGreaterThan(centerSum);
    }
  });

  it('creates wall roughness map with higher roughness at top than bottom', () => {
    const tex = createGoldenHallWallRoughnessMap(128);
    if (typeof HTMLCanvasElement !== 'undefined' && tex.image instanceof HTMLCanvasElement) {
      const canvas = tex.image;
      expect(canvas.height).toBe(256);
      const bottom = getPixel(canvas, 64, 255);
      const top = getPixel(canvas, 64, 0);
      expect(top[0]).toBeGreaterThan(bottom[0]); // grayscale intensity higher => rougher
    } else {
      const data = (tex.image as { data: Uint8Array }).data;
      const topSum = data[0] + data[1] + data[2];
      const bottomSum = data[4] + data[5] + data[6];
      expect(topSum).toBeGreaterThan(bottomSum);
    }
  });
});
