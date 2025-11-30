import { GameStatus, PieceOrientation } from '../types';
import { canPlacePiece } from '../collision';
import { FALL_STATE_DEFAULT, GameState } from './gameState';
import { lockCurrentPiece } from './lock';
import { beginClearingPhase } from './clearing';
import { tryMovePiece } from './movement';

export function tickGame(state: GameState, deltaTimeMs: number): GameState {
  if (
    state.gameStatus === GameStatus.GameOver ||
    state.gameStatus === GameStatus.Paused ||
    state.gameStatus === GameStatus.Idle
  ) {
    return state;
  }

  const nextTiming = { ...state.timing, fallProgressMs: state.timing.fallProgressMs + deltaTimeMs };
  let nextState: GameState = { ...state, timing: nextTiming };

  // accumulate lock time while landed
  if (nextState.fallState.landed) {
    nextState = {
      ...nextState,
      fallState: {
        ...nextState.fallState,
        lockTimeMs: nextState.fallState.lockTimeMs + deltaTimeMs,
      },
      timing: { ...nextState.timing, fallProgressMs: 0 },
    };
  }

  if (nextTiming.fallProgressMs < nextTiming.fallIntervalMs) {
    return nextState;
  }

  const fallSteps = Math.floor(nextTiming.fallProgressMs / nextTiming.fallIntervalMs);
  nextTiming.fallProgressMs -= fallSteps * nextTiming.fallIntervalMs;

  if (!nextState.currentPiece) {
    nextState = spawnPiece(nextState);
    return nextState;
  }

  if (fallSteps <= 0) {
    return nextState;
  }

  return applyGravitySteps(nextState, fallSteps);
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
  };
}

function getDefaultSpawnPosition(state: GameState): { x: number; y: number } {
  const { width, height } = state.board.getDimensions();
  const spawnX = Math.floor(width / 2);
  const spawnY = height - 1;
  return { x: spawnX, y: spawnY };
}

function applyGravitySteps(state: GameState, fallSteps: number): GameState {
  let piece = state.currentPiece;
  if (!piece) {
    return state;
  }

  for (let step = 0; step < fallSteps; step += 1) {
    const moved = tryMovePiece({ ...state, currentPiece: piece }, { dx: 0, dy: -1, rotation: 0 });
    if (!moved.moved || !moved.state.currentPiece) {
      const locked = lockCurrentPiece({
        ...state,
        currentPiece: piece,
        timing: { ...state.timing, fallProgressMs: 0 },
      });
      return beginClearingPhase(locked);
    }
    piece = moved.state.currentPiece;
    state = {
      ...state,
      fallState: FALL_STATE_DEFAULT,
      currentPiece: piece,
      timing: { ...state.timing, fallProgressMs: 0 },
    };
  }

  return { ...state, currentPiece: piece, fallState: FALL_STATE_DEFAULT };
}
