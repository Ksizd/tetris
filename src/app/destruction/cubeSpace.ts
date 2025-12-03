import { Vector3 } from 'three';

// Local cube coordinates: origin at (0,0,0), extent [-0.5, 0.5] along all axes.

/**
 * Локальная система координат куба разрушения:
 * центр в (0,0,0), длина ребра = 1, оси совпадают с мировыми.
 */
export const CUBE_LOCAL_MIN = -0.5;
export const CUBE_LOCAL_MAX = 0.5;

export const CUBE_LOCAL_SIZE = CUBE_LOCAL_MAX - CUBE_LOCAL_MIN; // = 1.0
export const CUBE_LOCAL_HALF = CUBE_LOCAL_SIZE * 0.5; // = 0.5

export enum CubeFace {
  Front = 'front',
  Back = 'back',
  Left = 'left',
  Right = 'right',
  Top = 'top',
  Bottom = 'bottom',
}

export const CUBE_FACES: CubeFace[] = [
  CubeFace.Front,
  CubeFace.Back,
  CubeFace.Left,
  CubeFace.Right,
  CubeFace.Top,
  CubeFace.Bottom,
];

// Transitional alias to keep existing imports stable while new CubeFace API is introduced.
export type FaceId = CubeFace;

/**
 * Нормали граней в локальном пространстве (front = наружу башни, +Z).
 */
export const FACE_NORMALS: Record<CubeFace, Vector3> = {
  [CubeFace.Front]: new Vector3(0, 0, 1),
  [CubeFace.Back]: new Vector3(0, 0, -1),
  [CubeFace.Right]: new Vector3(1, 0, 0),
  [CubeFace.Left]: new Vector3(-1, 0, 0),
  [CubeFace.Top]: new Vector3(0, 1, 0),
  [CubeFace.Bottom]: new Vector3(0, -1, 0),
};
