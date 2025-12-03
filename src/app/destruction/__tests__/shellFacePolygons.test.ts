import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import { CubeFace, CUBE_LOCAL_MIN, CUBE_LOCAL_MAX } from '../cubeSpace';
import { generateFaceSeeds } from '../shellFaceSeeds';
import { estimateFaceCoverage, generateFacePolygons } from '../shellFacePolygons';

function fixedRandom(seq: number[]): () => number {
  let idx = 0;
  return () => {
    const v = seq[idx % seq.length];
    idx += 1;
    return v;
  };
}

function polygonArea(vertices: Vector2[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) * 0.5;
}

describe('shellFacePolygons', () => {
  it('generates a polygon per seed with vertices inside face square', () => {
    const seeds = generateFaceSeeds(CubeFace.Front, { random: fixedRandom([0.1, 0.3, 0.7]) });
    const polys = generateFacePolygons(CubeFace.Front, { seeds });
    expect(polys.length).toBe(seeds.length);
    polys.forEach((p) => {
      expect(p.vertices.length).toBeGreaterThanOrEqual(3);
      expect(polygonArea(p.vertices)).toBeGreaterThan(1e-6);
      p.vertices.forEach((v) => {
        expect(v.x).toBeGreaterThanOrEqual(CUBE_LOCAL_MIN - 1e-6);
        expect(v.x).toBeLessThanOrEqual(CUBE_LOCAL_MAX + 1e-6);
        expect(v.y).toBeGreaterThanOrEqual(CUBE_LOCAL_MIN - 1e-6);
        expect(v.y).toBeLessThanOrEqual(CUBE_LOCAL_MAX + 1e-6);
      });
    });
  });

  it('covers majority of the face area (Voronoi fill)', () => {
    const seeds = generateFaceSeeds(CubeFace.Front, { seedCount: 8, random: fixedRandom([0.2, 0.4, 0.6, 0.8]) });
    const polys = generateFacePolygons(CubeFace.Front, { seeds });
    const coverage = estimateFaceCoverage(polys, 10);
    expect(coverage).toBeGreaterThan(0.85);
  });
});
