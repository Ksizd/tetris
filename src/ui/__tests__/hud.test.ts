/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { HudView, mapGameStateToHudData } from '../hud';
import { createInitialGameState } from '../../core/state/initialState';
import { GameStatus } from '../../core/types';
import { FALL_STATE_DEFAULT } from '../../core/state/gameState';

describe('HudView', () => {
  it('renders score, level, lines, status', () => {
    const container = document.createElement('div');
    const hud = new HudView(container);
    const state = createInitialGameState({ initialLevel: 3 });
    const updated = { ...state, score: 1200, linesCleared: 4, gameStatus: GameStatus.Paused };

    const hudData = mapGameStateToHudData(updated);
    hud.render(hudData);

    expect(container.textContent).toContain('1200');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('Paused');
  });

  it('shows lock timer when active', () => {
    const container = document.createElement('div');
    const hud = new HudView(container);
    const state = createInitialGameState({ initialLevel: 1 });
    const withLock = {
      ...state,
      fallState: { ...FALL_STATE_DEFAULT, landed: true, lockTimeMs: 300, lockDelayMs: 600, lockElapsedMs: 300 },
      gameStatus: GameStatus.Running,
    };
    const hudData = mapGameStateToHudData(withLock);
    hud.render(hudData);
    expect(container.textContent?.toLowerCase()).toContain('lock');
  });

  it('hides lock timer when inactive', () => {
    const container = document.createElement('div');
    const hud = new HudView(container);
    const state = createInitialGameState({ initialLevel: 1 });
    const hudData = mapGameStateToHudData(state);
    hud.render(hudData);
    const text = container.textContent?.toLowerCase() ?? '';
    expect(text).toContain('lock');
  });
});
