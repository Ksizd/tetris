import { GameStatus, PieceOrientation } from '../types';
import { canMove, canPlacePiece } from '../collision';
import { GameState } from './gameState';
import { lockCurrentPiece } from './lock';
import { beginClearingPhase } from './clearing';

export function tickGame(state: GameState, deltaTimeMs: number): GameState {
  if (state.gameStatus === GameStatus.GameOver || state.gameStatus === GameStatus.Paused) {
    return state;
  }

  const nextTiming = { ...state.timing, fallProgressMs: state.timing.fallProgressMs + deltaTimeMs };
  let nextState: GameState = { ...state, timing: nextTiming };

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
    if (!canMove(state.board, piece, 0, -1)) {
      const locked = lockCurrentPiece({
        ...state,
        currentPiece: piece,
        timing: { ...state.timing, fallProgressMs: 0 },
      });
      return beginClearingPhase(locked);
    }

    piece = {
      ...piece,
      position: { x: piece.position.x, y: piece.position.y - 1 },
    };
  }

  const stateAfterFall = { ...state, currentPiece: piece };
  if (!canMove(stateAfterFall.board, piece, 0, -1)) {
    const locked = lockCurrentPiece({
      ...stateAfterFall,
      timing: { ...stateAfterFall.timing, fallProgressMs: 0 },
    });
    return beginClearingPhase(locked);
  }

  return stateAfterFall;
}
