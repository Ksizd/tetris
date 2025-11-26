/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { HudView } from '../hud';
import { createInitialGameState } from '../../core/state/initialState';
import { GameStatus } from '../../core/types';

describe('HudView', () => {
  it('renders score, level, lines, status', () => {
    const container = document.createElement('div');
    const hud = new HudView(container);
    const state = createInitialGameState({ initialLevel: 3 });
    const updated = { ...state, score: 1200, linesCleared: 4, gameStatus: GameStatus.Paused };

    hud.render(updated);

    expect(container.textContent).toContain('1200');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('Paused');
  });
});
