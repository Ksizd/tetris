import { CubeFace } from './cubeSpace';
import { FacePolygon2D } from './shardTemplate';
import { SHELL_DEPTH } from './shellLayers';

export interface ShellShardTemplate {
  id: number;
  face: CubeFace;
  poly: FacePolygon2D;
  depthInner: number; // in [SHELL_DEPTH * 0.5, SHELL_DEPTH]
}

export interface ShellShardBuildOptions {
  random?: () => number;
  depthRange?: { min: number; max: number };
}

function randomDepth(min: number, max: number, rnd: () => number): number {
  if (max < min) {
    return min;
  }
  return min + (max - min) * rnd();
}

function sanitizeDepthRange(range?: { min: number; max: number }): { min: number; max: number } {
  const fallback = { min: SHELL_DEPTH * 0.5, max: SHELL_DEPTH };
  if (!range) return fallback;
  const min = Math.max(0, range.min);
  const max = Math.min(SHELL_DEPTH, Math.max(range.max, min));
  return { min, max };
}

export function buildShellShardTemplates(
  polygons: FacePolygon2D[],
  options: ShellShardBuildOptions = {}
): ShellShardTemplate[] {
  const rnd = options.random ?? Math.random;
  const range = sanitizeDepthRange(options.depthRange);
  return polygons.map((poly, idx) => ({
    id: idx,
    face: poly.face,
    poly,
    depthInner: randomDepth(range.min, range.max, rnd),
  }));
}
