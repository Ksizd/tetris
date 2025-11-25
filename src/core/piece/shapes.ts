import { CellCoord, PieceType } from '../types';

/**
 * Базовые формы тетримино в локальных координатах.
 * Ось y растёт вверх, (0,0) — нижний левый угол локального 4x4 чанка.
 * Ориентация — стартовая (будет расширена вращениями на следующих шагах).
 */
export const BASE_PIECE_SHAPES: Record<PieceType, ReadonlyArray<CellCoord>> = {
  [PieceType.I]: [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ],
  [PieceType.O]: [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  [PieceType.T]: [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  [PieceType.S]: [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  [PieceType.Z]: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  [PieceType.J]: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  [PieceType.L]: [
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
} as const;
