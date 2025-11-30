import { GameState } from './gameState';
import { GameCommand, GameCommandType, GameStatus, RotationDirection } from '../types';
import { lockCurrentPiece } from './lock';
import { beginClearingPhase } from './clearing';
import { tryMovePiece } from './movement';
import { FALL_STATE_DEFAULT } from './gameState';
import { LOCK_DELAY_MAX_MS, LOCK_MOVES_MAX } from './lockDelay';

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
      return trySoftDrop(state);
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
  const result = tryMovePiece(state, { dx, dy, rotation: 0 });
  return applyLockMoveUpdate(state, result);
}

function trySoftDrop(state: GameState): GameState {
  const result = tryMovePiece(state, { dx: 0, dy: -1, rotation: 0 });
  return applyLockMoveUpdate(state, result);
}

function tryRotate(state: GameState, direction: RotationDirection): GameState {
  const piece = state.currentPiece;
  if (!piece) {
    return state;
  }
  const rotationSteps = direction === RotationDirection.Clockwise ? 1 : -1;
  const result = tryMovePiece(state, { dx: 0, dy: 0, rotation: rotationSteps });
  return applyLockMoveUpdate(state, result);
}

function hardDrop(state: GameState): GameState {
  let working = state;
  if (!working.currentPiece) {
    return working;
  }

  while (true) {
    const step = tryMovePiece(working, { dx: 0, dy: -1, rotation: 0 });
    if (!step.moved || !step.state.currentPiece) {
      const locked = lockCurrentPiece({
        ...working,
        timing: { ...working.timing, fallProgressMs: 0 },
      });
      return beginClearingPhase(locked);
    }
    working = {
      ...step.state,
      fallState: FALL_STATE_DEFAULT,
      timing: { ...step.state.timing, fallProgressMs: 0 },
    };
  }
}

function applyLockMoveUpdate(
  prevState: GameState,
  result: ReturnType<typeof tryMovePiece>
): GameState {
  if (!result.moved || !result.state.currentPiece) {
    return result.state;
  }
  if (!prevState.fallState.landed) {
    return result.state;
  }
  const lockMovesCount = prevState.fallState.lockMovesCount + 1;
  const updated = {
    ...result.state,
    fallState: {
      ...prevState.fallState,
      lockMovesCount,
    },
  };
  if (
    updated.fallState.lockMovesCount >= LOCK_MOVES_MAX ||
    updated.fallState.lockTimeMs >= LOCK_DELAY_MAX_MS
  ) {
    const locked = lockCurrentPiece({
      ...updated,
      timing: { ...updated.timing, fallProgressMs: 0 },
    });
    return beginClearingPhase(locked);
  }
  return updated;
}
