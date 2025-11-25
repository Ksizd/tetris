import { PieceOrientation, RotationDirection } from '../types';

/**
 * Возвращает новую ориентацию с учётом направления вращения.
 * Используется простое вращение по кругу из 4 состояний без wall-kick.
 */
export function rotateOrientation(
  orientation: PieceOrientation,
  direction: RotationDirection
): PieceOrientation {
  const step = direction === RotationDirection.Clockwise ? 1 : 3; // +1 CW, -1 CCW
  return ((orientation + step) % 4) as PieceOrientation;
}
