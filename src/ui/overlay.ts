import { UIState } from './uiState';

export interface OverlayParams {
  container: HTMLElement;
  onStart?: () => void;
  onRestart?: () => void;
}

export class OverlayView {
  private readonly container: HTMLElement;
  private readonly onStart?: () => void;
  private readonly onRestart?: () => void;
  private readonly mainMenuPanel: HTMLElement;
  private readonly gameOverPanel: HTMLElement;

  constructor(params: OverlayParams) {
    this.container = params.container;
    this.onStart = params.onStart;
    this.onRestart = params.onRestart;
    this.mainMenuPanel = this.createMainMenuPanel();
    this.gameOverPanel = this.createGameOverPanel();
    this.container.append(this.mainMenuPanel, this.gameOverPanel);
    this.hideAll();
  }

  render(uiState: UIState): void {
    this.hideAll();
    switch (uiState) {
      case UIState.MainMenu:
        this.mainMenuPanel.style.display = 'flex';
        break;
      case UIState.GameOver:
        this.gameOverPanel.style.display = 'flex';
        break;
      default:
        break;
    }
  }

  private hideAll() {
    this.mainMenuPanel.style.display = 'none';
    this.gameOverPanel.style.display = 'none';
  }

  private createMainMenuPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'overlay-panel';
    panel.dataset.testid = 'overlay-main-menu';
    const title = document.createElement('div');
    title.textContent = 'Tower Tetris';
    title.className = 'overlay-title';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Start Game';
    button.className = 'overlay-button';
    button.dataset.testid = 'overlay-start';
    button.addEventListener('click', () => this.onStart?.());
    panel.append(title, button);
    return panel;
  }

  private createGameOverPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'overlay-panel';
    panel.dataset.testid = 'overlay-game-over';
    const title = document.createElement('div');
    title.textContent = 'Game Over';
    title.className = 'overlay-title';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Restart';
    button.className = 'overlay-button';
    button.dataset.testid = 'overlay-restart';
    button.addEventListener('click', () => this.onRestart?.());
    panel.append(title, button);
    return panel;
  }
}
