/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { OverlayView } from '../overlay';
import { UIState } from '../uiState';

describe('OverlayView', () => {
  it('shows main menu and calls start', () => {
    const container = document.createElement('div');
    const onStart = vi.fn();
    const overlay = new OverlayView({ container, onStart });

    overlay.render(UIState.MainMenu);
    expect(container.textContent).toContain('Start Game');
    const button = container.querySelector('[data-testid="overlay-start"]');
    button?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onStart).toHaveBeenCalled();
  });

  it('shows game over and calls restart', () => {
    const container = document.createElement('div');
    const onRestart = vi.fn();
    const overlay = new OverlayView({ container, onRestart });

    overlay.render(UIState.GameOver);
    expect(container.textContent).toContain('Game Over');
    const button = container.querySelector('[data-testid="overlay-restart"]');
    button?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onRestart).toHaveBeenCalled();
  });

  it('hides overlay in playing state', () => {
    const container = document.createElement('div');
    const overlay = new OverlayView({ container });

    overlay.render(UIState.Playing);
    const panels = container.querySelectorAll('.overlay-panel');
    panels.forEach((panel) => {
      expect(panel).toHaveProperty('style');
      expect((panel as HTMLElement).style.display).toBe('none');
    });
  });
});
