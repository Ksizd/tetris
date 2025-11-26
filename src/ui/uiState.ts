import { GameStatus } from '../core/types';

export enum UIState {
  MainMenu = 'main_menu',
  Playing = 'playing',
  Paused = 'paused',
  GameOver = 'game_over',
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
