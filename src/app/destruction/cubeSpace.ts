import { Vector3 } from 'three';

/**
 * Локальная система координат куба разрушения:
 * центр в (0,0,0), длина ребра = 1, оси совпадают с мировыми.
 */
export const CUBE_LOCAL_MIN = -0.5;
export const CUBE_LOCAL_MAX = 0.5;

export const CUBE_LOCAL_SIZE = CUBE_LOCAL_MAX - CUBE_LOCAL_MIN; // = 1.0
export const CUBE_LOCAL_HALF = CUBE_LOCAL_SIZE * 0.5; // = 0.5

export type FaceId = 'front' | 'right' | 'left' | 'top' | 'bottom' | 'back';

/**
 * Нормали граней в локальном пространстве (front = наружу башни, +Z).
 */
export const FACE_NORMALS: Record<FaceId, Vector3> = {
  front: new Vector3(0, 0, 1),
  back: new Vector3(0, 0, -1),
  right: new Vector3(1, 0, 0),
  left: new Vector3(-1, 0, 0),
  top: new Vector3(0, 1, 0),
  bottom: new Vector3(0, -1, 0),
};
