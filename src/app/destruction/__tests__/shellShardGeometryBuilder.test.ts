import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import { CubeFace, CUBE_LOCAL_MAX } from '../cubeSpace';
import { buildShellShardGeometry } from '../shellShardGeometryBuilder';
import { ShellShardTemplate } from '../shellShardTemplate';
import { SHELL_DEPTH } from '../shellLayers';

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

function makeTemplate(): ShellShardTemplate {
  return {
    id: 1,
    face: CubeFace.Front,
    poly: {
      face: CubeFace.Front,
      vertices: [
        new Vector2(-0.2, -0.2),
        new Vector2(0.25, -0.1),
        new Vector2(0.1, 0.25),
      ],
    },
    depthInner: 0.15,
  };
}

describe('shellShardGeometryBuilder', () => {
  it('extrudes front polygon to back at depthInner with correct winding and UVs', () => {
    const tpl = makeTemplate();
    const geom = buildShellShardGeometry(tpl, {
      random: constantRng(0.5),
      depthJitter: 0,
      backNoiseRadius: 0,
    });
    const n = tpl.poly.vertices.length;
    expect(geom.positions.length).toBe(n * 2);
    geom.positions.slice(0, n).forEach((p) => expect(p.z).toBeCloseTo(CUBE_LOCAL_MAX));
    geom.positions.slice(n).forEach((p) => expect(p.z).toBeCloseTo(CUBE_LOCAL_MAX - tpl.depthInner));
    expect(geom.depthInnerPerVertex).toHaveLength(n);
    geom.depthInnerPerVertex.forEach((d) => expect(d).toBeCloseTo(tpl.depthInner));
    expect(geom.depthInner).toBeCloseTo(tpl.depthInner);
    // first triangle uses vertices 0,1,2 of front face
    expect(geom.indices[0]).toBe(0);
    expect(geom.indices[1]).toBe(1);
    expect(geom.indices[2]).toBe(2);
    expect(geom.uvs.length).toBe(n * 2);
    geom.uvs.forEach((uv) => {
      expect(uv.x).toBeGreaterThanOrEqual(0);
      expect(uv.x).toBeLessThanOrEqual(1);
      expect(uv.y).toBeGreaterThanOrEqual(0);
      expect(uv.y).toBeLessThanOrEqual(1);
    });
  });

  it('adds per-vertex depth variation and back noise within shell bounds', () => {
    const tpl = makeTemplate();
    const geom = buildShellShardGeometry(tpl, {
      random: sequenceRng([0.1, 0.8, 0.3, 0.6]),
      depthJitter: 0.05,
      backNoiseRadius: 0.02,
    });
    const n = tpl.poly.vertices.length;
    const back = geom.positions.slice(n);
    const depths = back.map((p) => CUBE_LOCAL_MAX - p.z);
    const minInset = 0.01;
    const maxDepth = SHELL_DEPTH + 0.05;
    expect(new Set(depths.map((d) => d.toFixed(3))).size).toBeGreaterThan(1);
    depths.forEach((d) => {
      expect(d).toBeGreaterThanOrEqual(minInset - 1e-6);
      expect(d).toBeLessThanOrEqual(maxDepth);
    });
    back.forEach((p) => {
      expect(p.x).toBeLessThanOrEqual(CUBE_LOCAL_MAX + 1e-6);
      expect(p.x).toBeGreaterThanOrEqual(-CUBE_LOCAL_MAX - 1e-6);
      expect(p.y).toBeLessThanOrEqual(CUBE_LOCAL_MAX + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-CUBE_LOCAL_MAX - 1e-6);
      expect(p.z).toBeLessThanOrEqual(CUBE_LOCAL_MAX + 1e-6);
      expect(p.z).toBeGreaterThanOrEqual(CUBE_LOCAL_MAX - SHELL_DEPTH - 1e-3);
    });
  });
});
