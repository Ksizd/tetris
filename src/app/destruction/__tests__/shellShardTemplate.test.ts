import { describe, expect, it } from 'vitest';
import { CubeFace } from '../cubeSpace';
import { buildShellShardTemplates } from '../shellShardTemplate';
import { generateFacePolygons } from '../shellFacePolygons';
import { generateFaceSeeds } from '../shellFaceSeeds';
import { SHELL_DEPTH } from '../shellLayers';

function fixedRandom(seq: number[]): () => number {
  let idx = 0;
  return () => {
    const v = seq[idx % seq.length];
    idx += 1;
    return v;
  };
}

describe('shellShardTemplate', () => {
  it('builds shell shard templates for each face polygon with depth in range', () => {
    const seeds = generateFaceSeeds(CubeFace.Front, { seedCount: 6, random: fixedRandom([0.2, 0.4, 0.6]) });
    const polys = generateFacePolygons(CubeFace.Front, { seeds });
    const templates = buildShellShardTemplates(polys, { random: fixedRandom([0.5]) });
    expect(templates.length).toBe(polys.length);
    templates.forEach((tpl, idx) => {
      expect(tpl.id).toBe(idx);
      expect(tpl.face).toBe(CubeFace.Front);
      expect(tpl.poly).toBe(polys[idx]);
      expect(tpl.depthInner).toBeGreaterThanOrEqual(SHELL_DEPTH * 0.5 - 1e-6);
      expect(tpl.depthInner).toBeLessThanOrEqual(SHELL_DEPTH + 1e-6);
    });
  });
});
