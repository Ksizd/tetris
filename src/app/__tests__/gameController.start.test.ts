import { describe, expect, it } from 'vitest';
import { GameController } from '../gameController';
import { GameStatus } from '../../core/types';

describe('GameController startNewGame', () => {
  it('resets state and sets running with ready-to-spawn timing', () => {
    const controller = new GameController();
    controller.startNewGame();
    const snapshot = controller.getSnapshot();
    expect(snapshot.gameStatus).toBe(GameStatus.Running);
    expect(snapshot.timing.fallProgressMs).toBe(snapshot.timing.fallIntervalMs);
    expect(snapshot.linesCleared).toBe(0);
    expect(snapshot.score).toBe(0);
  });
});
