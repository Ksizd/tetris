import { ActivePiece, GameStatus, PieceOrientation } from '../types';
import { canMove, canPlacePiece } from '../collision';
import { GameState } from './gameState';

export function tickGame(state: GameState, deltaTimeMs: number): GameState {
  if (state.gameStatus === GameStatus.GameOver || state.gameStatus === GameStatus.Paused) {
    return state;
  }

  const nextTiming = { ...state.timing, fallProgressMs: state.timing.fallProgressMs + deltaTimeMs };
  let nextState: GameState = { ...state, timing: nextTiming };

  if (nextTiming.fallProgressMs < nextTiming.fallIntervalMs) {
    return nextState;
  }

  // накопили достаточно времени — пробуем опустить фигуру
  const fallSteps = Math.floor(nextTiming.fallProgressMs / nextTiming.fallIntervalMs);
  nextTiming.fallProgressMs -= fallSteps * nextTiming.fallIntervalMs;

  if (!nextState.currentPiece) {
    nextState = spawnPiece(nextState);
    return nextState;
  }

  const moved = tryMovePiece(nextState, { dx: 0, dy: -fallSteps });
  if (moved) {
    nextState = moved;
    return nextState;
  }

  // не смогли опустить — в следующем шаге появится логика фиксации (этап 4.4)
  return nextState;
}

function spawnPiece(state: GameState): GameState {
  const pieceType = state.pieceQueue.getNextPiece();
  const spawn: ActivePiece = {
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

function tryMovePiece(state: GameState, move: { dx: number; dy: number }): GameState | null {
  const piece = state.currentPiece;
  if (!piece) {
    return null;
  }

  if (!canMove(state.board, piece, move.dx, move.dy)) {
    return null;
  }

  return {
    ...state,
    currentPiece: {
      ...piece,
      position: { x: piece.position.x + move.dx, y: piece.position.y + move.dy },
    },
  };
}
