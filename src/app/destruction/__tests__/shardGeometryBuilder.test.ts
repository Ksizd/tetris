import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import { buildShardGeometry } from '../shardGeometryBuilder';
import { ShardTemplate } from '../shardTemplate';
import { FaceUvRect } from '../faceUvRect';

function constantRng(value: number): () => number {
  return () => value;
}

const TRI_TEMPLATE: ShardTemplate = {
  id: 7,
  face: 'front',
  polygon2D: {
    face: 'front',
    vertices: [new Vector2(-0.2, -0.2), new Vector2(0.25, -0.1), new Vector2(0.1, 0.25)],
  },
  depthMin: 0.1,
  depthMax: 0.3,
};

describe('shardGeometryBuilder', () => {
  it('builds closed geometry with front on cube surface and back inset', () => {
    const geom = buildShardGeometry(TRI_TEMPLATE, { random: constantRng(0.5), sideNoiseRadius: 0 });
    expect(geom.positions.length).toBe(6);
    expect(geom.indices.length).toBeGreaterThan(0);
    // front vertices lie on z=+0.5 for front face
    geom.positions.slice(0, 3).forEach((p) => expect(p.z).toBeCloseTo(0.5));
    // back vertices shifted inward along -Z
    const backDepth = TRI_TEMPLATE.depthMin + (TRI_TEMPLATE.depthMax - TRI_TEMPLATE.depthMin) * 0.5;
    geom.positions.slice(3).forEach((p) => {
      expect(p.z).toBeCloseTo(0.5 - backDepth);
    });
    // normals on front align with +Z, back with -Z
    geom.normals.slice(0, 3).forEach((n) => expect(n.z).toBeCloseTo(1));
    geom.normals.slice(3).forEach((n) => expect(n.z).toBeCloseTo(-1));
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
    const custom: Record<'front' | 'right' | 'left' | 'top' | 'bottom' | 'back', FaceUvRect> = {
      front: { face: 'front', u0: 0.2, v0: 0.2, u1: 0.4, v1: 0.4 },
      right: { face: 'right', u0: 0, v0: 0, u1: 1, v1: 1 },
      left: { face: 'left', u0: 0, v0: 0, u1: 1, v1: 1 },
      top: { face: 'top', u0: 0, v0: 0, u1: 1, v1: 1 },
      bottom: { face: 'bottom', u0: 0, v0: 0, u1: 1, v1: 1 },
      back: { face: 'back', u0: 0, v0: 0, u1: 1, v1: 1 },
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
