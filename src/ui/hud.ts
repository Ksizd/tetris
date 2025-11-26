import { GameState } from '../core/state/gameState';
import { GameStatus } from '../core/types';

interface HudElements {
  root: HTMLElement;
  score: HTMLElement;
  level: HTMLElement;
  lines: HTMLElement;
  status: HTMLElement;
}

export class HudView {
  private readonly elements: HudElements;

  constructor(container: HTMLElement) {
    this.elements = this.createElements(container);
  }

  render(state: Readonly<GameState>): void {
    const { score, level, linesCleared, gameStatus } = state;
    this.elements.score.textContent = score.toString();
    this.elements.level.textContent = level.toString();
    this.elements.lines.textContent = linesCleared.toString();
    this.elements.status.textContent = formatStatus(gameStatus);
  }

  private createElements(container: HTMLElement): HudElements {
    const root = document.createElement('div');
    root.style.background = 'rgba(0, 0, 0, 0.55)';
    root.style.padding = '12px 14px';
    root.style.borderRadius = '8px';
    root.style.minWidth = '140px';
    root.style.fontFamily = 'Arial, sans-serif';
    root.style.fontSize = '14px';
    root.style.lineHeight = '1.4';
    root.style.pointerEvents = 'none';

    const title = document.createElement('div');
    title.textContent = 'Tower Tetris';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';

    const scoreRow = this.createRow('Score');
    const levelRow = this.createRow('Level');
    const linesRow = this.createRow('Lines');
    const statusRow = this.createRow('Status');

    root.append(title, scoreRow.row, levelRow.row, linesRow.row, statusRow.row);
    container.append(root);

    return {
      root,
      score: scoreRow.value,
      level: levelRow.value,
      lines: linesRow.value,
      status: statusRow.value,
    };
  }

  private createRow(label: string): { row: HTMLElement; value: HTMLElement } {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.opacity = '0.8';

    const valueEl = document.createElement('span');
    valueEl.textContent = '0';
    valueEl.style.fontWeight = 'bold';

    row.append(labelEl, valueEl);
    return { row, value: valueEl };
  }
}

function formatStatus(status: GameStatus): string {
  switch (status) {
    case GameStatus.Running:
      return 'Running';
    case GameStatus.Paused:
      return 'Paused';
    case GameStatus.Clearing:
      return 'Clearing';
    case GameStatus.GameOver:
      return 'Game Over';
    case GameStatus.Idle:
    default:
      return 'Idle';
  }
}
