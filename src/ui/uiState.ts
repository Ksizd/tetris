import { GameStatus } from '../core/types';
import { GameState } from '../core/state/gameState';

export enum UIState {
  MainMenu = 'main_menu',
  Playing = 'playing',
  Paused = 'paused',
  GameOver = 'game_over',
}

export interface LockTimerView {
  active: boolean;
  progress: number; // 0..1
  remainingMs: number;
}

export function mapGameStatusToUIState(status: GameStatus): UIState {
  switch (status) {
    case GameStatus.Running:
    case GameStatus.Clearing:
      return UIState.Playing;
    case GameStatus.Paused:
      return UIState.Paused;
    case GameStatus.GameOver:
      return UIState.GameOver;
    case GameStatus.Idle:
    default:
      return UIState.MainMenu;
  }
}

export function mapLockTimerView(state: Readonly<GameState>): LockTimerView {
  const { fallState } = state;
  const delay = Math.max(0, fallState.lockDelayMs);
  const remaining = Math.max(0, fallState.lockTimeMs);
  if (!fallState.landed || delay <= 0) {
    return { active: false, progress: 0, remainingMs: 0 };
  }
  const elapsedClamped = Math.min(delay, Math.max(0, fallState.lockElapsedMs));
  const progress = delay > 0 ? Math.min(1, elapsedClamped / delay) : 0;
  return {
    active: true,
    progress,
    remainingMs: remaining,
  };
}
