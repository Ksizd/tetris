import { describe, expect, it } from 'vitest';
import { CUBE_LOCAL_MIN, CUBE_LOCAL_MAX, CUBE_LOCAL_HALF, FACE_NORMALS, CubeFace } from '../cubeSpace';
import { DEFAULT_CUBE_UV_LAYOUT, DEFAULT_FACE_UV_RECTS } from '../faceUvRect';

describe('cubeSpace', () => {
  it('defines unit cube extents', () => {
    expect(CUBE_LOCAL_MIN).toBeCloseTo(-0.5);
    expect(CUBE_LOCAL_MAX).toBeCloseTo(0.5);
    expect(CUBE_LOCAL_HALF).toBeCloseTo(0.5);
  });

  it('exposes canonical face normals', () => {
    expect(FACE_NORMALS[CubeFace.Front].equals({ x: 0, y: 0, z: 1 } as any)).toBe(true);
    expect(FACE_NORMALS[CubeFace.Back].equals({ x: 0, y: 0, z: -1 } as any)).toBe(true);
    expect(FACE_NORMALS[CubeFace.Right].equals({ x: 1, y: 0, z: 0 } as any)).toBe(true);
    expect(FACE_NORMALS[CubeFace.Left].equals({ x: -1, y: 0, z: 0 } as any)).toBe(true);
    expect(FACE_NORMALS[CubeFace.Top].equals({ x: 0, y: 1, z: 0 } as any)).toBe(true);
    expect(FACE_NORMALS[CubeFace.Bottom].equals({ x: 0, y: -1, z: 0 } as any)).toBe(true);
  });

  it('provides face UV rectangles reusing cube layout', () => {
    expect(DEFAULT_FACE_UV_RECTS[CubeFace.Front]).toEqual({
      face: CubeFace.Front,
      u0: 0.08,
      v0: 0.55,
      u1: 0.92,
      v1: 0.95,
    });
    expect(DEFAULT_FACE_UV_RECTS[CubeFace.Right].v1).toBeCloseTo(0.45);
    expect(DEFAULT_FACE_UV_RECTS[CubeFace.Back].u0).toBeCloseTo(0.08);
  });

  it('exposes cube UV layout keyed by faces', () => {
    expect(Object.keys(DEFAULT_CUBE_UV_LAYOUT.faces).sort()).toEqual(
      [
        CubeFace.Front,
        CubeFace.Back,
        CubeFace.Left,
        CubeFace.Right,
        CubeFace.Top,
        CubeFace.Bottom,
      ].sort()
    );
  });
});
