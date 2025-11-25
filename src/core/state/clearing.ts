import { Board } from '../board';
import { GameStatus } from '../types';
import { GameState } from './gameState';
import { canPlacePiece } from '../collision';
import { PieceOrientation } from '../types';

/**
 * Возвращает уровни y, которые полностью заполнены.
 */
export function findFullLayers(board: Board): number[] {
  const { height } = board.getDimensions();
  const full: number[] = [];
  for (let y = 0; y < height; y += 1) {
    if (board.isLayerFull(y)) {
      full.push(y);
    }
  }
  return full;
}

/**
 * Начинает фазу очистки после фиксации фигуры:
 * - если есть заполненные слои, записывает их в состояние и ставит статус Clearing;
 * - если нет, статус и clearingLayers остаются без изменений.
 */
export function beginClearingPhase(state: GameState): GameState {
  const layers = findFullLayers(state.board);
  if (layers.length === 0) {
    return { ...state, clearingLayers: [] };
  }

  return {
    ...state,
    clearingLayers: layers,
    gameStatus: GameStatus.Clearing,
  };
}

/**
 * Завершает фазу очистки после анимации:
 * - удаляет отмеченные слои, сдвигая верхние строки вниз;
 * - обновляет счетчики очищенных линий;
 * - сбрасывает clearingLayers, currentPiece;
 * - спаунит новую фигуру или ставит GameOver, если спаун невозможен.
 */
export function completeClearingPhase(state: GameState): GameState {
  if (state.clearingLayers.length === 0) {
    return state;
  }

  const collapsedBoard = collapseClearedLayers(state.board, state.clearingLayers);
  const linesCleared = state.linesCleared + state.clearingLayers.length;
  const resetState: GameState = {
    ...state,
    board: collapsedBoard,
    currentPiece: null,
    clearingLayers: [],
    linesCleared,
    gameStatus: state.gameStatus === GameStatus.GameOver ? GameStatus.GameOver : GameStatus.Running,
  };

  return spawnNextPiece(resetState);
}

function collapseClearedLayers(board: Board, layers: number[]): Board {
  const { width, height } = board.getDimensions();
  const clearedSet = new Set(layers);
  const result = Board.createEmpty({ width, height });
  let writeY = 0;

  for (let readY = 0; readY < height; readY += 1) {
    if (clearedSet.has(readY)) {
      continue;
    }
    for (let x = 0; x < width; x += 1) {
      result.setCell({ x, y: writeY }, board.getCell({ x, y: readY }));
    }
    writeY += 1;
  }

  // writeY указывает на первую свободную строку; выше остаются пустые ячейки
  return result;
}

function spawnNextPiece(state: GameState): GameState {
  const pieceType = state.pieceQueue.getNextPiece();
  const { width, height } = state.board.getDimensions();
  const spawn = {
    type: pieceType,
    orientation: PieceOrientation.Deg0,
    position: { x: Math.floor(width / 2), y: height - 1 },
  };

  if (!canPlacePiece(state.board, spawn)) {
    return { ...state, gameStatus: GameStatus.GameOver };
  }

  return { ...state, currentPiece: spawn, gameStatus: GameStatus.Running };
}
