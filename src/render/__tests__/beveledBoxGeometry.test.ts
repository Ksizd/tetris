import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBeveledBoxGeometry } from '../beveledBoxGeometry';

describe('createBeveledBoxGeometry', () => {
  it('respects target dimensions and radius clamping', () => {
    const width = 2;
    const height = 1.5;
    const depth = 0.9;
    const radius = 0.2;
    const geometry = createBeveledBoxGeometry({ width, height, depth, radius, smoothness: 2 });

    geometry.computeBoundingBox();
    const box = geometry.boundingBox as THREE.Box3;
    expect(box.min.x).toBeCloseTo(-width / 2);
    expect(box.max.x).toBeCloseTo(width / 2);
    expect(box.min.y).toBeCloseTo(-height / 2);
    expect(box.max.y).toBeCloseTo(height / 2);
    expect(box.min.z).toBeCloseTo(-depth / 2);
    expect(box.max.z).toBeCloseTo(depth / 2);

    const positions = geometry.getAttribute('position').array as number[];
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every((v) => Number.isFinite(v))).toBe(true);

    const normals = geometry.getAttribute('normal').array as number[];
    expect(normals.length).toBe(positions.length);
    expect(normals.every((n) => Number.isFinite(n))).toBe(true);
  });
});
