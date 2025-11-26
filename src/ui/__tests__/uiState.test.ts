import { describe, expect, it } from 'vitest';
import { mapGameStatusToUIState, UIState } from '../uiState';
import { GameStatus } from '../../core/types';

describe('mapGameStatusToUIState', () => {
  it('maps idle to main menu', () => {
    expect(mapGameStatusToUIState(GameStatus.Idle)).toBe(UIState.MainMenu);
  });

  it('maps running and clearing to playing', () => {
    expect(mapGameStatusToUIState(GameStatus.Running)).toBe(UIState.Playing);
    expect(mapGameStatusToUIState(GameStatus.Clearing)).toBe(UIState.Playing);
  });

  it('maps paused to paused and game over to game over', () => {
    expect(mapGameStatusToUIState(GameStatus.Paused)).toBe(UIState.Paused);
    expect(mapGameStatusToUIState(GameStatus.GameOver)).toBe(UIState.GameOver);
  });
});
