import { describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import { computeDepthRange, generateShardTemplates, DepthRange } from '../shardTemplateGenerator';
import { validateShardTemplate } from '../shardTemplate';
import { CubeFace } from '../cubeSpace';

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

describe('shardTemplateGenerator', () => {
  it('generates shards for all faces within expected counts and validation', () => {
    const rnd = makeRng(1234);
    const shards = generateShardTemplates({ random: rnd });
    const byFace = new Map<CubeFace, number>();
    shards.forEach((s) => byFace.set(s.face, (byFace.get(s.face) ?? 0) + 1));

    expect(byFace.get(CubeFace.Front)).toBeGreaterThanOrEqual(6);
    expect(byFace.get(CubeFace.Front)).toBeLessThanOrEqual(12);
    [CubeFace.Right, CubeFace.Left, CubeFace.Top, CubeFace.Bottom].forEach((face) => {
      const count = byFace.get(face) ?? 0;
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(8);
    });
    const backCount = byFace.get(CubeFace.Back) ?? 0;
    expect(backCount).toBeGreaterThanOrEqual(3);
    expect(backCount).toBeLessThanOrEqual(5);

    shards.forEach((tpl) => {
      const res = validateShardTemplate(tpl);
      expect(res.valid).toBe(true);
      expect(tpl.depthMin).toBeGreaterThanOrEqual(0);
      expect(tpl.depthMax).toBeLessThanOrEqual(1);
    });
  });

  it('assigns thicker depth for central polygons than edge polygons', () => {
    const base: DepthRange = { min: 0.1, max: 0.5 };
    const centerPoly = [new Vector2(-0.1, -0.1), new Vector2(0.1, -0.1), new Vector2(0.1, 0.1), new Vector2(-0.1, 0.1)];
    const edgePoly = [new Vector2(0.3, 0.3), new Vector2(0.5, 0.3), new Vector2(0.5, 0.5), new Vector2(0.3, 0.5)];
    const centerDepth = computeDepthRange(CubeFace.Front, centerPoly, base);
    const edgeDepth = computeDepthRange(CubeFace.Front, edgePoly, base);
    expect(centerDepth.max).toBeGreaterThan(edgeDepth.max);
    expect(centerDepth.min).toBeGreaterThan(edgeDepth.min);
  });
});
