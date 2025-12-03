import { Vector2 } from 'three';
import { CubeFace, CUBE_LOCAL_MIN, CUBE_LOCAL_SIZE } from './cubeSpace';

export interface FaceSeed {
  face: CubeFace;
  sx: number;
  sy: number;
}

export interface FaceSeedOptions {
  count?: number;
  random?: () => number;
  inset?: number; // margin to avoid seeds exactly on edges (0..0.5)
}

const DEFAULT_SEED_COUNT = 5;
const MIN_SEED_COUNT = 5;
const DEFAULT_INSET = 0.02;

export function generateFaceSeeds(face: CubeFace, options: FaceSeedOptions = {}): FaceSeed[] {
  const rnd = options.random ?? Math.random;
  const inset = Math.min(0.49, Math.max(0, options.inset ?? DEFAULT_INSET));
  const count = Math.max(MIN_SEED_COUNT, Math.floor(options.count ?? DEFAULT_SEED_COUNT));
  const seeds: FaceSeed[] = [];
  for (let i = 0; i < count; i += 1) {
    const sx = inset + (1 - 2 * inset) * rnd();
    const sy = inset + (1 - 2 * inset) * rnd();
    seeds.push({ face, sx, sy });
  }
  return seeds;
}

export function seedToLocalFacePos(seed: FaceSeed): Vector2 {
  const x = CUBE_LOCAL_MIN + seed.sx * CUBE_LOCAL_SIZE;
  const y = CUBE_LOCAL_MIN + seed.sy * CUBE_LOCAL_SIZE;
  return new Vector2(x, y);
}
