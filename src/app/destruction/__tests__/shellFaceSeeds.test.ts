import { describe, expect, it } from 'vitest';
import { CubeFace, CUBE_LOCAL_MIN, CUBE_LOCAL_SIZE } from '../cubeSpace';
import { generateFaceSeeds, seedToLocalFacePos } from '../shellFaceSeeds';

function fixedRandom(seq: number[]): () => number {
  let idx = 0;
  return () => {
    const v = seq[idx % seq.length];
    idx += 1;
    return v;
  };
}

describe('shellFaceSeeds', () => {
  it('generates at least 5 seeds within [0,1] with inset applied', () => {
    const seeds = generateFaceSeeds(CubeFace.Front, { random: fixedRandom([0.1, 0.5, 0.9]) });
    expect(seeds.length).toBeGreaterThanOrEqual(5);
    seeds.forEach((s) => {
      expect(s.sx).toBeGreaterThanOrEqual(0);
      expect(s.sx).toBeLessThanOrEqual(1);
      expect(s.sy).toBeGreaterThanOrEqual(0);
      expect(s.sy).toBeLessThanOrEqual(1);
      expect(s.face).toBe(CubeFace.Front);
    });
  });

  it('converts seeds to local face coordinates in [-0.5,0.5]', () => {
    const seeds = generateFaceSeeds(CubeFace.Front, { count: 5, inset: 0, random: fixedRandom([0, 0, 0.5, 0.5]) });
    const local = seedToLocalFacePos(seeds[0]);
    expect(local.x).toBeCloseTo(CUBE_LOCAL_MIN);
    expect(local.y).toBeCloseTo(CUBE_LOCAL_MIN);
    const localCenter = seedToLocalFacePos(seeds[1]);
    expect(localCenter.x).toBeCloseTo(CUBE_LOCAL_MIN + 0.5 * CUBE_LOCAL_SIZE);
    expect(localCenter.y).toBeCloseTo(CUBE_LOCAL_MIN + 0.5 * CUBE_LOCAL_SIZE);
  });
});
