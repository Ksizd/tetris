import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import { CubeFace, CUBE_LOCAL_MAX } from '../cubeSpace';
import { buildShellShardGeometry } from '../shellShardGeometryBuilder';
import { ShellShardTemplate } from '../shellShardTemplate';

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
    const geom = buildShellShardGeometry(tpl);
    const n = tpl.poly.vertices.length;
    expect(geom.positions.length).toBe(n * 2);
    geom.positions.slice(0, n).forEach((p) => expect(p.z).toBeCloseTo(CUBE_LOCAL_MAX));
    geom.positions.slice(n).forEach((p) => expect(p.z).toBeCloseTo(CUBE_LOCAL_MAX - tpl.depthInner));
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
});
