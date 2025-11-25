import { BASE_PIECE_SHAPES } from './shapes';
import { CellCoord, PieceOrientation, PieceType } from '../types';

const GRID_SIZE = 4;

/**
 * Возвращает блоки фигуры для заданного типа и ориентации.
 * Фигура описана в локальных координатах 4x4, поворот по часовой стрелке.
 */
export function getPieceBlocks(type: PieceType, orientation: PieceOrientation): CellCoord[] {
  const base = BASE_PIECE_SHAPES[type];
  if (orientation === PieceOrientation.Deg0 || type === PieceType.O) {
    // O-фигура не меняет форму; Deg0 — базовая ориентация
    return [...base];
  }

  return base.map((cell) => rotateCell(cell, orientation));
}

function rotateCell(cell: CellCoord, orientation: PieceOrientation): CellCoord {
  const { x, y } = cell;
  switch (orientation) {
    case PieceOrientation.Deg90:
      return { x: GRID_SIZE - 1 - y, y: x };
    case PieceOrientation.Deg180:
      return { x: GRID_SIZE - 1 - x, y: GRID_SIZE - 1 - y };
    case PieceOrientation.Deg270:
      return { x: y, y: GRID_SIZE - 1 - x };
    case PieceOrientation.Deg0:
    default:
      return cell;
  }
}
