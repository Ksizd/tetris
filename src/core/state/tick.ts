import { GameStatus, PieceOrientation } from '../types';
import { wrapX } from '../coords';
import { canPlacePiece, isGrounded } from '../collision';
import { FALL_STATE_DEFAULT, GameState } from './gameState';
import { lockCurrentPiece } from './lock';
import { beginClearingPhase } from './clearing';
import { tryMovePiece } from './movement';
import { LOCK_DELAY_MAX_MS, LOCK_MOVES_MAX } from './lockDelay';
import { clampToLockBounds } from './utils';

export function tickGame(state: GameState, deltaTimeMs: number): GameState {
  if (
    state.gameStatus === GameStatus.GameOver ||
    state.gameStatus === GameStatus.Paused ||
    state.gameStatus === GameStatus.Idle
  ) {
    return state;
  }

  const fallProgress = state.timing.fallProgressMs + deltaTimeMs;
  let working: GameState = {
    ...state,
    timing: { ...state.timing, fallProgressMs: fallProgress },
  };

  if (!working.currentPiece) {
    return spawnPiece(working);
  }

  const grounded = isGrounded(working.board, working.currentPiece);
  if (grounded && !working.fallState.landed) {
    working = {
      ...working,
      fallState: {
        landed: true,
        lockMovesCount: 0,
        lockTimeMs: LOCK_DELAY_MAX_MS,
        lockDelayMs: LOCK_DELAY_MAX_MS,
        lockElapsedMs: 0,
      },
      timing: { ...working.timing, fallProgressMs: 0 },
    };
  }
  if (!grounded && working.fallState.landed) {
    working = {
      ...working,
      fallState: {
        ...FALL_STATE_DEFAULT,
        lockTimeMs: LOCK_DELAY_MAX_MS,
        lockDelayMs: LOCK_DELAY_MAX_MS,
      },
    };
  }

  working = applyGravity(working, deltaTimeMs);

  if (working.fallState.landed) {
    const remaining = working.fallState.lockTimeMs - deltaTimeMs;
    const lockMoves = working.fallState.lockMovesCount;
    if (remaining <= 0 || lockMoves >= LOCK_MOVES_MAX) {
      const locked = lockCurrentPiece({
        ...working,
        timing: { ...working.timing, fallProgressMs: 0 },
      });
      return beginClearingPhase(locked);
    }
    const clampedRemaining = Math.max(0, remaining);
    const elapsed = clampToLockBounds(
      working.fallState.lockDelayMs - clampedRemaining,
      working.fallState.lockDelayMs
    );
    return {
      ...working,
      fallState: {
        ...working.fallState,
        lockTimeMs: clampedRemaining,
        lockElapsedMs: elapsed,
      },
    };
  }

  return working;
}

function spawnPiece(state: GameState): GameState {
  const pieceType = state.pieceQueue.getNextPiece();
  const spawn = {
    type: pieceType,
    orientation: PieceOrientation.Deg0,
    position: getDefaultSpawnPosition(state),
  };

  const canSpawn = canPlacePiece(state.board, spawn);
  if (!canSpawn) {
    return { ...state, gameStatus: GameStatus.GameOver };
  }

  return {
    ...state,
    currentPiece: spawn,
    gameStatus: state.gameStatus === GameStatus.Idle ? GameStatus.Running : state.gameStatus,
    fallState: FALL_STATE_DEFAULT,
    spawnColumnHint: state.spawnColumnHint,
  };
}

function getDefaultSpawnPosition(state: GameState): { x: number; y: number } {
  const { width, height } = state.board.getDimensions();
  const spawnX =
    state.spawnColumnHint !== undefined && state.spawnColumnHint !== null
      ? wrapX(state.spawnColumnHint, width)
      : Math.floor(width / 2);
  const spawnY = height - 1;
  return { x: spawnX, y: spawnY };
}

function applyGravity(state: GameState, deltaTimeMs: number): GameState {
  const interval = state.timing.fallIntervalMs;
  let fallProgress = state.timing.fallProgressMs;
  let working = state;

  while (fallProgress >= interval) {
    fallProgress -= interval;
    const step = tryMovePiece(working, { dx: 0, dy: -1, rotation: 0 });
    if (step.moved && step.state.currentPiece) {
      working = {
        ...step.state,
        fallState: {
          ...FALL_STATE_DEFAULT,
          lockTimeMs: LOCK_DELAY_MAX_MS,
          lockDelayMs: LOCK_DELAY_MAX_MS,
          lockElapsedMs: 0,
        },
        timing: { ...step.state.timing, fallProgressMs: fallProgress },
      };
    } else {
      working = {
        ...working,
        fallState: {
          ...working.fallState,
          landed: true,
          lockTimeMs: working.fallState.landed
            ? working.fallState.lockTimeMs
            : LOCK_DELAY_MAX_MS,
          lockDelayMs: working.fallState.landed
            ? working.fallState.lockDelayMs
            : LOCK_DELAY_MAX_MS,
          lockElapsedMs: working.fallState.landed ? working.fallState.lockElapsedMs : 0,
        },
        timing: { ...working.timing, fallProgressMs: fallProgress },
      };
      break;
    }
  }

  return working;
}
