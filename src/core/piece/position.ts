import { ActivePiece, BoardDimensions, CellCoord } from '../types';
import { getPieceBlocks } from './orientations';
import { wrapX } from '../coords';

/**
 * Возвращает мировые координаты блоков фигуры с обёрткой по окружности (x).
 * По оси y обёртка не применяется — используется прямое сложение смещения.
 */
export function getWorldBlocks(piece: ActivePiece, board: BoardDimensions): CellCoord[] {
  if (board.width <= 0) {
    throw new Error('Board width must be positive for world block projection');
  }
  const { position, orientation, type } = piece;
  const localBlocks = getPieceBlocks(type, orientation);
  return localBlocks.map((cell) => ({
    x: wrapX(position.x + cell.x, board.width),
    y: position.y + cell.y,
  }));
}
