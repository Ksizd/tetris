import { BoardDimensions } from '../types';
import { DEFAULT_BOARD_DIMENSIONS } from '../constants';
import { PieceGeneratorMode } from '../piece';
import { DEFAULT_FALL_SPEED, FallSpeedParams } from './fallSpeed';

export interface GameConfig {
  board: BoardDimensions;
  initialLevel: number;
  fallIntervalMs: number; // базовый интервал для уровня 1 (для обратной совместимости)
  seed?: number;
  pieceMode?: PieceGeneratorMode;
  fallSpeed?: Partial<FallSpeedParams>;
}

export const DEFAULT_GAME_CONFIG: GameConfig = Object.freeze({
  board: DEFAULT_BOARD_DIMENSIONS,
  initialLevel: 1,
  fallIntervalMs: DEFAULT_FALL_SPEED.baseIntervalMs,
  pieceMode: 'bag' as PieceGeneratorMode,
});
