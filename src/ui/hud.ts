import { GameState } from '../core/state/gameState';
import { GameStatus } from '../core/types';
import { mapLockTimerView } from './uiState';

export interface HudData {
  score: number;
  level: number;
  linesCleared: number;
  gameStatus: GameStatus;
  lockTimer: {
    active: boolean;
    progress: number;
    remainingMs: number;
  };
}

interface HudElements {
  root: HTMLElement;
  score: HTMLElement;
  level: HTMLElement;
  lines: HTMLElement;
  status: HTMLElement;
  lockRing: HTMLElement;
  lockLabel: HTMLElement;
}

export class HudView {
  private readonly elements: HudElements;

  constructor(container: HTMLElement) {
    this.elements = this.createElements(container);
  }

  render(data: HudData): void {
    const { score, level, linesCleared, gameStatus, lockTimer } = data;
    this.elements.score.textContent = score.toString();
    this.elements.level.textContent = level.toString();
    this.elements.lines.textContent = linesCleared.toString();
    this.elements.status.textContent = formatStatus(gameStatus);
    this.renderLockTimer(lockTimer);
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
    const lockRow = this.createLockRow();

    root.append(title, scoreRow.row, levelRow.row, linesRow.row, statusRow.row, lockRow.row);
    container.append(root);

    return {
      root,
      score: scoreRow.value,
      level: levelRow.value,
      lines: linesRow.value,
      status: statusRow.value,
      lockRing: lockRow.ring,
      lockLabel: lockRow.label,
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

  private createLockRow(): {
    row: HTMLElement;
    ring: HTMLElement;
    label: HTMLElement;
  } {
    const row = document.createElement('div');
    row.className = 'hud-row lock-row';
    const label = document.createElement('span');
    label.textContent = 'Lock';
    label.className = 'hud-label';
    const ring = document.createElement('div');
    ring.className = 'hud-lock-ring';
    Object.assign(ring.style, {
      width: '42px',
      height: '42px',
      borderRadius: '50%',
      border: '1px solid rgba(255, 215, 128, 0.35)',
      background: 'conic-gradient(rgba(255, 215, 128, 0.9) 0deg, rgba(255, 215, 128, 0.12) 0deg)',
      boxShadow: '0 0 8px rgba(255, 215, 128, 0.35)',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
      opacity: '0.25',
      transform: 'scale(0.9)',
    });
    row.append(label, ring);
    return { row, ring, label };
  }

  private renderLockTimer(lock: HudData['lockTimer']): void {
    const ring = this.elements.lockRing;
    const label = this.elements.lockLabel;
    if (!lock.active) {
      ring.style.opacity = '0.15';
      ring.style.transform = 'scale(0.85)';
      ring.style.background =
        'conic-gradient(rgba(255, 215, 128, 0.12) 0deg, rgba(255, 215, 128, 0.06) 360deg)';
      label.textContent = 'Lock';
      return;
    }
    const progressDeg = Math.max(0, Math.min(1, lock.progress)) * 360;
    ring.style.background = `conic-gradient(rgba(255,215,128,0.9) ${progressDeg}deg, rgba(255,215,128,0.12) ${progressDeg}deg)`;
    ring.style.opacity = '1';
    ring.style.transform = 'scale(1)';
    label.textContent = `Lock ${(Math.ceil(lock.remainingMs / 100) / 10).toFixed(1)}s`;
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
    lockTimer: mapLockTimerView(state),
  };
}
