import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CubeFace } from '../cubeSpace';
import { DEFAULT_CUBE_UV_LAYOUT, sampleFaceUv } from '../faceUvRect';

describe('sampleFaceUv', () => {
  it('maps front-center point to middle of front rect', () => {
    const uv = sampleFaceUv(CubeFace.Front, new Vector3(0, 0, 0.5), DEFAULT_CUBE_UV_LAYOUT);
    expect(uv).toBeDefined();
    expect(uv?.u).toBeCloseTo(0.5, 3);
    expect(uv?.v).toBeCloseTo(0.75, 3);
  });

  it('respects per-face orientation (right face uses -Z as U, Y as V)', () => {
    const uv = sampleFaceUv(CubeFace.Right, new Vector3(0.5, 0, 0.2), DEFAULT_CUBE_UV_LAYOUT);
    expect(uv).toBeDefined();
    expect(uv?.u).toBeCloseTo(0.332, 3);
    expect(uv?.v).toBeCloseTo(0.25, 3);
  });

  it('returns undefined if point is not on requested face plane', () => {
    const uv = sampleFaceUv(CubeFace.Front, new Vector3(0.5, 0, 0.2), DEFAULT_CUBE_UV_LAYOUT);
    expect(uv).toBeUndefined();
  });
});
