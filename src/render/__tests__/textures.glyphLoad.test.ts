import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { JSDOM } from 'jsdom';

// Minimal 2D context mock to let atlas drawing run without real canvas implementation.
const createMockCtx = () => {
  const noop = () => {};
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    translate: noop,
    save: noop,
    restore: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    drawImage: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: noop,
  } as unknown as CanvasRenderingContext2D;
};

describe('mahjong tile texture glyph loading', () => {
  beforeAll(() => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLCanvasElement = dom.window.HTMLCanvasElement;
    (global as any).CanvasRenderingContext2D = dom.window.CanvasRenderingContext2D;
  });

  const originalImage = global.Image;
  const originalGetContext = (HTMLCanvasElement.prototype as any).getContext;

  beforeEach(() => {
    vi.resetModules();
    // Mock canvas context to avoid relying on a real canvas implementation in JSDOM.
    (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => createMockCtx());
  });

  afterEach(() => {
    global.Image = originalImage;
    (HTMLCanvasElement.prototype as any).getContext = originalGetContext;
    vi.useRealTimers();
  });

  it('resolves glyph load asynchronously and re-renders atlas', async () => {
    vi.useFakeTimers();

    // Fake Image that fires onload asynchronously.
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      complete = false;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_value: string) {
        setTimeout(() => {
          this.complete = true;
          this.naturalWidth = 16;
          this.naturalHeight = 16;
          this.onload?.();
        }, 10);
      }
    }
    // @ts-expect-error override global
    global.Image = FakeImage;

    const { getMahjongTileTexture } = await import('../textures');
    const texture = getMahjongTileTexture(8);
    expect(texture).toBeInstanceOf(THREE.Texture);
    // Before timers flush: glyph not loaded yet.
    expect((texture as THREE.CanvasTexture).image).toBeTruthy();

    await vi.runAllTimersAsync();

    // After load: texture should still be valid and flagged for update.
    expect(texture.needsUpdate).toBe(true);
  });

  it('does not recreate image or rewire onload across calls', async () => {
    vi.useFakeTimers();
    const instances: FakeReusedImage[] = [];

    class FakeReusedImage {
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      complete = false;
      naturalWidth = 0;
      naturalHeight = 0;
      constructor() {
        instances.push(this);
      }
      set src(_value: string) {
        setTimeout(() => {
          this.complete = true;
          this.naturalWidth = 8;
          this.naturalHeight = 8;
          this.onload?.();
        }, 5);
      }
    }
    // @ts-expect-error override global
    global.Image = FakeReusedImage;

    const { getMahjongTileTexture } = await import('../textures');
    const first = getMahjongTileTexture(8);
    const second = getMahjongTileTexture(8);
    expect(first).toBe(second);
    expect(instances.length).toBe(1);

    await vi.runAllTimersAsync();

    expect(instances[0].complete).toBe(true);
    expect(first.needsUpdate).toBe(true);
  });
});
