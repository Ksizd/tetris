import { FaceId } from './cubeSpace';

/**
 * UV-прямоугольник одной грани исходного куба (нормализованные координаты в атласе).
 * Это те же диапазоны, что использует основная модель куба — повторное использование без новой развёртки.
 */
export interface FaceUvRect {
  face: FaceId;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * Эталонные UV-диапазоны для граней куба. Front — белая плитка с иероглифом.
 * Остальные (right/left/top/bottom/back) остаются золотыми и используют ту же боковую полосу.
 */
export const DEFAULT_FACE_UV_RECTS: Record<FaceId, FaceUvRect> = {
  front: { face: 'front', u0: 0.08, v0: 0.55, u1: 0.92, v1: 0.95 },
  back: { face: 'back', u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
  right: { face: 'right', u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
  left: { face: 'left', u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
  top: { face: 'top', u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
  bottom: { face: 'bottom', u0: 0.08, v0: 0.05, u1: 0.92, v1: 0.45 },
};
