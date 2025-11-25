import { GameState } from './gameState';
import {
  GameCommand,
  GameCommandType,
  GameStatus,
  PieceOrientation,
  RotationDirection,
} from '../types';
import { canMove, canRotate } from '../collision';
import { lockCurrentPiece } from './lock';
import { beginClearingPhase } from './clearing';

/**
 * Применяет команду игрока к состоянию игры (домен, без рендера).
 */
export function applyCommand(state: GameState, command: GameCommand): GameState {
  if (state.gameStatus === GameStatus.GameOver) {
    return state;
  }

  if (command.type === GameCommandType.TogglePause) {
    return togglePause(state);
  }

  const piece = state.currentPiece;
  if (!piece) {
    return state;
  }

  switch (command.type) {
    case GameCommandType.MoveLeft:
      return tryMove(state, -1, 0);
    case GameCommandType.MoveRight:
      return tryMove(state, 1, 0);
    case GameCommandType.RotateCW:
      return tryRotate(state, RotationDirection.Clockwise);
    case GameCommandType.RotateCCW:
      return tryRotate(state, RotationDirection.CounterClockwise);
    case GameCommandType.SoftDrop:
      return tryMove(state, 0, -1);
    case GameCommandType.HardDrop:
      return hardDrop(state);
    default:
      return state;
  }
}

function togglePause(state: GameState): GameState {
  if (state.gameStatus === GameStatus.Clearing) {
    return state; // не прерываем анимацию очистки
  }
  const nextStatus =
    state.gameStatus === GameStatus.Paused ? GameStatus.Running : GameStatus.Paused;
  return { ...state, gameStatus: nextStatus };
}

function tryMove(state: GameState, dx: number, dy: number): GameState {
  const piece = state.currentPiece;
  if (!piece) {
    return state;
  }
  if (!canMove(state.board, piece, dx, dy)) {
    return state;
  }
  return {
    ...state,
    currentPiece: {
      ...piece,
      position: { x: piece.position.x + dx, y: piece.position.y + dy },
    },
  };
}

function tryRotate(state: GameState, direction: RotationDirection): GameState {
  const piece = state.currentPiece;
  if (!piece) {
    return state;
  }
  if (!canRotate(state.board, piece, direction)) {
    return state;
  }
  const newOrientation =
    direction === RotationDirection.Clockwise
      ? (((piece.orientation + 1) % 4) as PieceOrientation)
      : (((piece.orientation + 3) % 4) as PieceOrientation);

  return {
    ...state,
    currentPiece: {
      ...piece,
      orientation: newOrientation,
    },
  };
}

function hardDrop(state: GameState): GameState {
  const piece = state.currentPiece;
  if (!piece) {
    return state;
  }

  let dropped = piece;
  while (canMove(state.board, dropped, 0, -1)) {
    dropped = {
      ...dropped,
      position: { x: dropped.position.x, y: dropped.position.y - 1 },
    };
  }

  const lockedState = lockCurrentPiece({ ...state, currentPiece: dropped });
  const clearingState = beginClearingPhase(lockedState);
  return clearingState;
}
