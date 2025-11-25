import { CellCoord, PieceOrientation, PieceType } from './index';

/**
 * Активная фигура на поле.
 * position — базовая точка (левый нижний угол локальной 4x4 области фигуры).
 */
export interface ActivePiece {
  type: PieceType;
  orientation: PieceOrientation;
  position: CellCoord;
}
