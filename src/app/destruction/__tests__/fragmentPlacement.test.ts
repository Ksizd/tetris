import { describe, expect, it, vi } from 'vitest';
import { sampleFragmentPositionInsideCube } from '../fragmentPlacement';
import { CubeVisual } from '../../../render';
import { Vector3 } from 'three';

function makeCube(): CubeVisual {
  return {
    id: { x: 0, y: 0 },
    worldPos: new Vector3(10, 20, 30),
  };
}

describe('sampleFragmentPositionInsideCube', () => {
  it('returns point inside cube bounds around worldPos', () => {
    const cube = makeCube();
    const size = { sx: 2, sy: 4, sz: 6 };
    // deterministic random values: 0.25, 0.75, 0.5 -> centered: -0.25, 0.25, 0
    const random = vi.fn();
    random.mockReturnValueOnce(0.25).mockReturnValueOnce(0.75).mockReturnValueOnce(0.5);

    const pos = sampleFragmentPositionInsideCube(cube, size, random);

    expect(pos.x).toBeCloseTo(10 - 0.25 * 2, 6); // 9.5
    expect(pos.y).toBeCloseTo(20 + 0.25 * 4, 6); // 21
    expect(pos.z).toBeCloseTo(30 + 0 * 6, 6); // 30
  });

  it('throws on non-positive sizes', () => {
    const cube = makeCube();
    expect(() => sampleFragmentPositionInsideCube(cube, { sx: 0, sy: 1, sz: 1 })).toThrow();
  });
});
