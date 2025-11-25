import { describe, expect, it } from 'vitest';
import { getNeighbors, isInsideBoard, wrapX } from '../boardCoords';

describe('boardCoords utilities', () => {
  describe('wrapX', () => {
    it('wraps positive values within width', () => {
      expect(wrapX(0, 5)).toBe(0);
      expect(wrapX(5, 5)).toBe(0);
      expect(wrapX(6, 5)).toBe(1);
      expect(wrapX(12, 5)).toBe(2);
    });

    it('wraps negative values into range', () => {
      expect(wrapX(-1, 5)).toBe(4);
      expect(wrapX(-5, 5)).toBe(0);
      expect(wrapX(-12, 5)).toBe(3);
    });
  });

  describe('isInsideBoard', () => {
    const dims = { width: 5, height: 3 };

    it('returns true for coords inside vertical bounds, wrapping x', () => {
      expect(isInsideBoard({ x: 0, y: 0 }, dims)).toBe(true);
      expect(isInsideBoard({ x: -1, y: 1 }, dims)).toBe(true);
      expect(isInsideBoard({ x: 5, y: 2 }, dims)).toBe(true);
    });

    it('returns false when y is out of bounds', () => {
      expect(isInsideBoard({ x: 0, y: -1 }, dims)).toBe(false);
      expect(isInsideBoard({ x: 0, y: 3 }, dims)).toBe(false);
    });

    it('returns false for non-positive dimensions', () => {
      expect(isInsideBoard({ x: 0, y: 0 }, { width: 0, height: 3 })).toBe(false);
      expect(isInsideBoard({ x: 0, y: 0 }, { width: 5, height: 0 })).toBe(false);
    });
  });

  describe('getNeighbors', () => {
    const dims = { width: 4, height: 3 };

    it('returns wrapped horizontal neighbors and bounded vertical neighbors', () => {
      const neighbors = getNeighbors({ x: 0, y: 1 }, dims);
      expect(neighbors.left).toEqual({ x: 3, y: 1 });
      expect(neighbors.right).toEqual({ x: 1, y: 1 });
      expect(neighbors.down).toEqual({ x: 0, y: 0 });
      expect(neighbors.up).toEqual({ x: 0, y: 2 });
    });

    it('omits neighbors outside vertical bounds', () => {
      const bottom = getNeighbors({ x: 2, y: 0 }, dims);
      expect(bottom.down).toBeUndefined();

      const top = getNeighbors({ x: 2, y: dims.height - 1 }, dims);
      expect(top.up).toBeUndefined();
    });
  });
});
