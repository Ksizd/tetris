import { describe, expect, it } from 'vitest';
import { CUBE_LOCAL_MIN, CUBE_LOCAL_MAX, CUBE_LOCAL_HALF, FACE_NORMALS } from '../cubeSpace';
import { DEFAULT_FACE_UV_RECTS } from '../faceUvRect';

describe('cubeSpace', () => {
  it('defines unit cube extents', () => {
    expect(CUBE_LOCAL_MIN).toBeCloseTo(-0.5);
    expect(CUBE_LOCAL_MAX).toBeCloseTo(0.5);
    expect(CUBE_LOCAL_HALF).toBeCloseTo(0.5);
  });

  it('exposes canonical face normals', () => {
    expect(FACE_NORMALS.front.equals({ x: 0, y: 0, z: 1 } as any)).toBe(true);
    expect(FACE_NORMALS.back.equals({ x: 0, y: 0, z: -1 } as any)).toBe(true);
    expect(FACE_NORMALS.right.equals({ x: 1, y: 0, z: 0 } as any)).toBe(true);
    expect(FACE_NORMALS.left.equals({ x: -1, y: 0, z: 0 } as any)).toBe(true);
    expect(FACE_NORMALS.top.equals({ x: 0, y: 1, z: 0 } as any)).toBe(true);
    expect(FACE_NORMALS.bottom.equals({ x: 0, y: -1, z: 0 } as any)).toBe(true);
  });

  it('provides face UV rectangles reusing cube layout', () => {
    expect(DEFAULT_FACE_UV_RECTS.front).toEqual({ face: 'front', u0: 0.08, v0: 0.55, u1: 0.92, v1: 0.95 });
    expect(DEFAULT_FACE_UV_RECTS.right.v1).toBeCloseTo(0.45);
    expect(DEFAULT_FACE_UV_RECTS.back.u0).toBeCloseTo(0.08);
  });
});
