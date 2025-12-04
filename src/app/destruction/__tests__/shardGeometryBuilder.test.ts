import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import { buildShardGeometry } from '../shardGeometryBuilder';
import { ShardTemplate } from '../shardTemplate';
import { FaceUvRect } from '../faceUvRect';
import { CubeFace } from '../cubeSpace';

function constantRng(value: number): () => number {
  return () => value;
}

function sequenceRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const value = values[idx % values.length];
    idx += 1;
    return value;
  };
}

const TRI_TEMPLATE: ShardTemplate = {
  id: 7,
  face: CubeFace.Front,
  polygon2D: {
    face: CubeFace.Front,
    vertices: [new Vector2(-0.2, -0.2), new Vector2(0.25, -0.1), new Vector2(0.1, 0.25)],
  },
  depthMin: 0.1,
  depthMax: 0.3,
};

describe('shardGeometryBuilder', () => {
  it('builds closed geometry with front on cube surface and varied back inset', () => {
    const geom = buildShardGeometry(TRI_TEMPLATE, {
      random: sequenceRng([0.2, 0.8, 0.4, 0.6]),
      sideNoiseRadius: 0,
    });
    expect(geom.positions.length).toBe(6);
    expect(geom.indices.length).toBeGreaterThan(0);
    // front vertices lie on z=+0.5 for front face
    geom.positions.slice(0, 3).forEach((p) => expect(p.z).toBeCloseTo(0.5));
    // back vertices shifted inward along -Z with per-vertex variation
    const backDepths = geom.positions.slice(3).map((p) => 0.5 - p.z);
    backDepths.forEach((depth) => {
      expect(depth).toBeGreaterThanOrEqual(TRI_TEMPLATE.depthMin - 1e-6);
      expect(depth).toBeLessThanOrEqual(TRI_TEMPLATE.depthMax + 1e-6);
    });
    expect(new Set(backDepths.map((d) => d.toFixed(3))).size).toBeGreaterThan(1);
    expect(geom.depthBacks).toHaveLength(3);
    expect(geom.depthBack).toBeCloseTo(Math.max(...backDepths));
    // normals on front align with +Z, back point inward
    geom.normals.slice(0, 3).forEach((n) => expect(n.z).toBeCloseTo(1));
    geom.normals.slice(3).forEach((n) => expect(n.z).toBeLessThan(0));
    // UVs respect front face rect (0.08..0.92 x 0.55..0.95) and invert sy
    const uv = geom.uvs[0];
    expect(uv.x).toBeGreaterThanOrEqual(0.08);
    expect(uv.x).toBeLessThanOrEqual(0.92);
    expect(uv.y).toBeGreaterThanOrEqual(0.55);
    expect(uv.y).toBeLessThanOrEqual(0.95);
  });

  it('creates side faces for each edge', () => {
    const geom = buildShardGeometry(TRI_TEMPLATE, { random: constantRng(0.5), sideNoiseRadius: 0 });
    // For triangle: front face 1 tri, back face 1 tri, sides 3*2 = 6 tris -> total 8 tris -> 24 indices
    expect(geom.indices.length).toBe(24);
  });

  it('applies custom face UV rects (universality)', () => {
    const custom: Record<CubeFace, FaceUvRect> = {
      [CubeFace.Front]: { face: CubeFace.Front, u0: 0.2, v0: 0.2, u1: 0.4, v1: 0.4 },
      [CubeFace.Right]: { face: CubeFace.Right, u0: 0, v0: 0, u1: 1, v1: 1 },
      [CubeFace.Left]: { face: CubeFace.Left, u0: 0, v0: 0, u1: 1, v1: 1 },
      [CubeFace.Top]: { face: CubeFace.Top, u0: 0, v0: 0, u1: 1, v1: 1 },
      [CubeFace.Bottom]: { face: CubeFace.Bottom, u0: 0, v0: 0, u1: 1, v1: 1 },
      [CubeFace.Back]: { face: CubeFace.Back, u0: 0, v0: 0, u1: 1, v1: 1 },
    };
    const geom = buildShardGeometry(TRI_TEMPLATE, {
      random: constantRng(0.5),
      faceUvRects: custom,
      sideNoiseRadius: 0,
    });
    const uv = geom.uvs[0];
    expect(uv.x).toBeGreaterThanOrEqual(0.2);
    expect(uv.x).toBeLessThanOrEqual(0.4);
    expect(uv.y).toBeGreaterThanOrEqual(0.2);
    expect(uv.y).toBeLessThanOrEqual(0.4);
  });
});
