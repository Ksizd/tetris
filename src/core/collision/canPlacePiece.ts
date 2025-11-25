import { Board } from '../board';
import { ActivePiece, CellContent } from '../types';
import { getWorldBlocks } from '../piece';

/**
 * Проверяет, можно ли разместить фигуру на поле:
 * - y не ниже 0;
 * - блоки не пересекаются с занятыми ячейками (если y внутри высоты поля);
 * - блоки могут быть выше верхней границы (спавн), тогда просто игнорируем коллизию.
 */
export function canPlacePiece(board: Board, piece: ActivePiece): boolean {
  const dimensions = board.getDimensions();
  const blocks = getWorldBlocks(piece, dimensions);

  for (const block of blocks) {
    if (block.y < 0) {
      return false;
    }
    if (block.y >= dimensions.height) {
      continue; // выше поля — допускаем при спавне
    }
    if (board.getCell(block) !== CellContent.Empty) {
      return false;
    }
  }

  return true;
}
