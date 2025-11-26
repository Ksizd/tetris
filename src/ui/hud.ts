import { GameState } from '../core/state/gameState';
import { GameStatus } from '../core/types';

export interface HudData {
  score: number;
  level: number;
  linesCleared: number;
  gameStatus: GameStatus;
}

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

  render(data: HudData): void {
    const { score, level, linesCleared, gameStatus } = data;
    this.elements.score.textContent = score.toString();
    this.elements.level.textContent = level.toString();
    this.elements.lines.textContent = linesCleared.toString();
    this.elements.status.textContent = formatStatus(gameStatus);
  }

  private createElements(container: HTMLElement): HudElements {
    const root = document.createElement('div');
    root.className = 'hud-card';

    const title = document.createElement('div');
    title.textContent = 'Tower Tetris';
    title.className = 'hud-title';

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
    row.className = 'hud-row';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.className = 'hud-label';

    const valueEl = document.createElement('span');
    valueEl.textContent = '0';
    valueEl.className = 'hud-value';

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

export function mapGameStateToHudData(state: Readonly<GameState>): HudData {
  return {
    score: state.score,
    level: state.level,
    linesCleared: state.linesCleared,
    gameStatus: state.gameStatus,
  };
}
