import { describe, expect, it } from 'vitest';
import { Vector2, Vector3 } from 'three';
import { CubeFace } from '../cubeSpace';
import { buildShellShardGeometry } from '../shellShardGeometryBuilder';
import { ShellShardTemplate } from '../shellShardTemplate';
import { buildShellShardBuffer, makeShellShardInstance } from '../shellShardBufferBuilder';

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

describe('shellShardBufferBuilder', () => {
  it('builds buffer geometry and instance matrix', () => {
    const tpl = makeTemplate();
    const geom = buildShellShardGeometry(tpl);
    const buffer = buildShellShardBuffer(geom, tpl);
    expect(buffer.geometry.getAttribute('position').count).toBe(geom.positions.length);
    const instance = makeShellShardInstance(buffer, new Vector3(1, 2, 3), { sx: 2, sy: 2, sz: 2 }, 'face');
    expect(instance.templateId).toBe(tpl.id);
    expect(instance.geometry).toBe(buffer.geometry);
    // matrix should translate near cubeWorldPos scaled by localCenter
    const applied = new Vector3();
    applied.setFromMatrixPosition(instance.matrix);
    expect(applied.x).toBeCloseTo(1.1, 2); // includes localCenter.x * scale
    expect(instance.materialId).toBe('face');
  });
});
