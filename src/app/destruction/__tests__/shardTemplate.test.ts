import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import { ShardTemplate, validateShardTemplate } from '../shardTemplate';

function makeValidTemplate(): ShardTemplate {
  return {
    id: 1,
    face: 'front',
    polygon2D: {
      face: 'front',
      vertices: [new Vector2(-0.2, -0.2), new Vector2(0.3, -0.1), new Vector2(0.1, 0.25)],
    },
    depthMin: 0.1,
    depthMax: 0.4,
  };
}

describe('shardTemplate', () => {
  it('accepts valid template', () => {
    const tpl = makeValidTemplate();
    expect(validateShardTemplate(tpl)).toEqual({ valid: true });
  });

  it('rejects invalid depth range', () => {
    const tpl = makeValidTemplate();
    tpl.depthMin = 0.6;
    tpl.depthMax = 0.4;
    const res = validateShardTemplate(tpl);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('depthMin');
  });

  it('rejects vertices outside cube square', () => {
    const tpl = makeValidTemplate();
    tpl.polygon2D.vertices[0].set(0.8, 0); // outside 0.5
    const res = validateShardTemplate(tpl);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('vertices');
  });
});
