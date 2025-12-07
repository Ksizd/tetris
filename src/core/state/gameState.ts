import { Board } from '../board';
import { ActivePiece, GameStatus, PieceType } from '../types';
import { PieceQueue } from '../piece';

export interface FallTiming {
  fallProgressMs: number;
  fallIntervalMs: number;
}

export interface FallState {
  landed: boolean;
  lockTimeMs: number;
  lockMovesCount: number;
}

export const FALL_STATE_DEFAULT: FallState = {
  landed: false,
  lockTimeMs: 0,
  lockMovesCount: 0,
};

/**
 * Доменное состояние игры без рендера и ввода.
 */
export interface GameState {
  board: Board;
  currentPiece: ActivePiece | null;
  nextPieces: PieceType[];
  score: number;
  level: number;
  linesCleared: number;
  gameStatus: GameStatus;
  timing: FallTiming;
  pieceQueue: PieceQueue;
  clearingLayers: number[];
  fallState: FallState;
  spawnColumnHint?: number | null;
}
