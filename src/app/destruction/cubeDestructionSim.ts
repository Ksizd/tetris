import { CubeVisual } from '../../render';
import { Quaternion, Vector3 } from 'three';

export type FragmentMaterialId = 'gold' | 'face' | 'inner' | 'dust';
/**
 * Fragment visual/physical role:
 * - faceShard: thin pieces of the painted front face with glyph texture.
 * - edgeShard: elongated golden edge/border pieces.
 * - coreShard: chunky inner golden pieces.
 * - dust: tiny golden dust/spark fragments.
 */
export type FragmentKind = 'faceShard' | 'edgeShard' | 'coreShard' | 'dust';

export interface FragmentUvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface Fragment {
  kind: FragmentKind;
  position: Vector3;
  velocity: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  angularVelocity: Vector3;
  ageMs: number;
  lifetimeMs: number;
  fade: number;
  instanceId: number;
  materialId: FragmentMaterialId;
  uvRect?: FragmentUvRect;
  colorTint?: number;
  templateId?: number;
}

export interface CubeDestructionSim {
  cube: CubeVisual;
  fragments: Fragment[];
  startedAtMs: number;
  finished: boolean;
}

export function createFragment(params: {
  kind: FragmentKind;
  position: Vector3;
  velocity: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  angularVelocity: Vector3;
  lifetimeMs: number;
  instanceId: number;
  materialId: FragmentMaterialId;
  uvRect?: FragmentUvRect;
  colorTint?: number;
  templateId?: number;
}): Fragment {
  return {
    ...params,
    ageMs: 0,
    fade: 1,
  };
}

export function createCubeDestructionSim(
  cube: CubeVisual,
  fragments: Fragment[],
  startedAtMs: number,
  finished = false
): CubeDestructionSim {
  return {
    cube,
    fragments,
    startedAtMs,
    finished,
  };
}
