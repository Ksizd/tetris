import { CellContent } from '../types';
import { getWorldBlocks } from '../piece';
import { FALL_STATE_DEFAULT, GameState } from './gameState';

/**
 * Фиксирует текущую фигуру на поле: записывает блоки и сбрасывает currentPiece.
 * Если фигуры нет, возвращает состояние без изменений.
 */
export function lockCurrentPiece(state: GameState): GameState {
  const piece = state.currentPiece;
  if (!piece) {
    return state;
  }

  const dimensions = state.board.getDimensions();
  const blocks = getWorldBlocks(piece, dimensions);
  const board = state.board.clone();

  for (const block of blocks) {
    if (block.y < 0 || block.y >= dimensions.height) {
      continue; // блоки вне поля по y игнорируем
    }
    board.setCell(block, CellContent.Block);
  }

  return {
    ...state,
    board,
    currentPiece: null,
    fallState: FALL_STATE_DEFAULT,
  };
}
