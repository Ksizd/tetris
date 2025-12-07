import { Board } from '../board';
import { DEFAULT_BOARD_DIMENSIONS } from '../constants';
import { GameStatus } from '../types';
import { PieceQueue } from '../piece';
import { DEFAULT_GAME_CONFIG, GameConfig } from './config';
import { GameState } from './gameState';
import { DEFAULT_FALL_SPEED, getFallIntervalMs } from './fallSpeed';
import { FALL_STATE_DEFAULT } from './gameState';

export function createInitialGameState(config: Partial<GameConfig> = {}): GameState {
  const merged: GameConfig = {
    ...DEFAULT_GAME_CONFIG,
    ...config,
    board: config.board ?? DEFAULT_BOARD_DIMENSIONS,
  };

  const fallParams = {
    ...DEFAULT_FALL_SPEED,
    baseIntervalMs: merged.fallIntervalMs ?? DEFAULT_FALL_SPEED.baseIntervalMs,
    ...(merged.fallSpeed ?? {}),
  };

  return {
    board: Board.createEmpty(merged.board),
    currentPiece: null,
    nextPieces: [],
    score: 0,
    level: merged.initialLevel,
    linesCleared: 0,
    gameStatus: GameStatus.Idle,
    timing: {
      fallProgressMs: 0,
      fallIntervalMs: getFallIntervalMs(merged.initialLevel, fallParams),
    },
    pieceQueue: new PieceQueue({ seed: merged.seed, mode: merged.pieceMode }),
    clearingLayers: [],
    fallState: { ...FALL_STATE_DEFAULT },
    spawnColumnHint: null,
  };
}
