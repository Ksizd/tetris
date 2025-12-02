import { Quaternion, Vector3 } from 'three';
import { FragmentKind, FragmentUvRect } from './cubeDestructionSim';

export interface FragmentTemplate {
  kind: FragmentKind;
  /** Local position inside the cube (same space as cube.cubeSize). */
  localPosition: Vector3;
  /** Base rotation in cube-local space. */
  localRotation: Quaternion;
  /** Optional per-fragment scale to distort geometry. */
  localScale: Vector3;
  /** UV sub-rectangle for face shards; normalized [0..1] in atlas space. */
  uvRect?: FragmentUvRect;
}

export type CubeFragmentPattern = FragmentTemplate[];
export type CubeFragmentPatternLibrary = Record<string, CubeFragmentPattern>;

const IDENTITY = new Quaternion();

function faceTile(u0: number, v0: number, u1: number, v1: number, pos: Vector3, scale = 1): FragmentTemplate {
  return {
    kind: 'faceShard',
    localPosition: pos,
    localRotation: IDENTITY.clone(),
    localScale: new Vector3(scale, scale, 1),
    uvRect: { u0, v0, u1, v1 },
  };
}

function edgeShard(pos: Vector3, scale: Vector3, rot = IDENTITY.clone()): FragmentTemplate {
  return {
    kind: 'edgeShard',
    localPosition: pos,
    localRotation: rot,
    localScale: scale.clone(),
  };
}

function coreShard(pos: Vector3, scale: Vector3): FragmentTemplate {
  return {
    kind: 'coreShard',
    localPosition: pos,
    localRotation: IDENTITY.clone(),
    localScale: scale.clone(),
  };
}

function dust(pos: Vector3, scale = 0.7): FragmentTemplate {
  return {
    kind: 'dust',
    localPosition: pos,
    localRotation: IDENTITY.clone(),
    localScale: new Vector3(scale, scale, scale),
  };
}

/**
 * Пресеты шаблонов фрагментов для одного куба.
 * Локальные координаты рассчитаны для куба с центром в (0,0,0) и размером 1; при использовании масштабируйте под фактический cubeSize.
 */
export const CUBE_FRAGMENT_PATTERNS: CubeFragmentPatternLibrary = {
  /**
   * Pattern A: одна крупная лицевушка, пара средних, много золотой крошки.
   */
  A: [
    faceTile(0, 0, 0.66, 0.66, new Vector3(0, 0.1, 0.45), 1.1),
    faceTile(0.66, 0, 1, 0.5, new Vector3(0.25, 0.05, 0.45), 0.6),
    faceTile(0, 0.66, 0.5, 1, new Vector3(-0.2, -0.08, 0.45), 0.7),

    edgeShard(new Vector3(0.45, 0.15, 0), new Vector3(0.8, 0.4, 0.5)),
    edgeShard(new Vector3(-0.45, -0.1, 0.05), new Vector3(0.7, 0.35, 0.45)),

    coreShard(new Vector3(0.1, 0, 0), new Vector3(0.8, 0.7, 0.8)),
    coreShard(new Vector3(-0.2, 0.2, -0.05), new Vector3(0.6, 0.5, 0.7)),

    dust(new Vector3(0.35, 0.35, 0.1), 0.6),
    dust(new Vector3(-0.3, 0.25, -0.1), 0.5),
    dust(new Vector3(0.1, -0.3, 0.2), 0.55),
    dust(new Vector3(-0.15, -0.25, -0.15), 0.45),
    dust(new Vector3(0.2, 0.05, -0.25), 0.5),
  ],

  /**
   * Pattern B: сетка мелких плиток + несколько крупных золотых кусочков.
   */
  B: [
    faceTile(0, 0, 0.5, 0.5, new Vector3(-0.2, 0.2, 0.45), 0.55),
    faceTile(0.5, 0, 1, 0.5, new Vector3(0.2, 0.2, 0.45), 0.55),
    faceTile(0, 0.5, 0.5, 1, new Vector3(-0.2, -0.15, 0.45), 0.55),
    faceTile(0.5, 0.5, 1, 1, new Vector3(0.2, -0.15, 0.45), 0.55),
    faceTile(0.25, 0.25, 0.75, 0.75, new Vector3(0, 0.05, 0.46), 0.35),

    edgeShard(new Vector3(0.45, 0.25, 0.05), new Vector3(0.9, 0.35, 0.5)),
    edgeShard(new Vector3(-0.45, -0.2, 0.1), new Vector3(0.85, 0.32, 0.45)),

    coreShard(new Vector3(0, 0, -0.05), new Vector3(1.0, 0.9, 1.0)),
    coreShard(new Vector3(0.15, -0.3, 0.05), new Vector3(0.7, 0.55, 0.8)),

    dust(new Vector3(0.35, 0.35, 0.1), 0.6),
    dust(new Vector3(-0.35, 0.25, 0), 0.55),
    dust(new Vector3(0.25, -0.35, -0.05), 0.5),
    dust(new Vector3(-0.25, -0.3, 0.15), 0.5),
    dust(new Vector3(0, 0, -0.25), 0.45),
    dust(new Vector3(0.05, 0.15, 0.25), 0.4),
  ],

  /**
   * Pattern C: диагональный разрыв, как удар сверху.
   */
  C: [
    faceTile(0, 0.2, 0.6, 0.8, new Vector3(-0.25, 0.15, 0.45), 0.7),
    faceTile(0.4, 0, 1, 0.6, new Vector3(0.25, 0.0, 0.45), 0.7),
    faceTile(0.1, 0.7, 0.7, 1, new Vector3(0.05, -0.25, 0.45), 0.5),

    edgeShard(new Vector3(-0.4, 0.35, 0), new Vector3(0.9, 0.35, 0.45)),
    edgeShard(new Vector3(0.4, -0.25, 0.05), new Vector3(0.95, 0.32, 0.45)),

    coreShard(new Vector3(-0.1, 0.2, -0.05), new Vector3(0.9, 0.8, 0.95)),
    coreShard(new Vector3(0.2, -0.2, 0), new Vector3(0.85, 0.7, 0.9)),

    dust(new Vector3(-0.3, 0.25, 0.15), 0.55),
    dust(new Vector3(0.3, -0.2, -0.1), 0.55),
    dust(new Vector3(-0.05, -0.35, 0.1), 0.45),
    dust(new Vector3(0.1, 0.35, -0.05), 0.5),
    dust(new Vector3(0.0, 0.05, -0.25), 0.45),
  ],
};
