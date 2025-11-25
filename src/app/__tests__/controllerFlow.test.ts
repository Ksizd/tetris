import { describe, expect, it } from 'vitest';
import { GameController } from '../gameController';
import { GameCommandType, GameStatus, PieceOrientation, PieceType } from '../../core/types';
import { createInitialGameState } from '../../core/state/initialState';
import { Board } from '../../core/board';
import { CellContent } from '../../core/types';
import { GameEventType } from '../events';

describe('Controller flow: command -> state -> events', () => {
  it('command sequence moves and locks piece with events', () => {
    const base = createInitialGameState();
    const ctrl = new GameController({
      ...base,
      currentPiece: {
        type: PieceType.I,
        orientation: PieceOrientation.Deg90,
        position: { x: 0, y: 2 },
      },
    });

    ctrl.enqueueCommand({ type: GameCommandType.MoveRight });
    ctrl.enqueueCommand({ type: GameCommandType.HardDrop });
    const snap = ctrl.update(0);

    expect(snap.currentPiece).toBeNull();
    const events = ctrl.getEvents().map((e) => e.type);
    expect(events).toContain(GameEventType.PieceLocked);
  });

  it('clearing emits LinesCleared event', () => {
    const base = createInitialGameState();
    const board = Board.createEmpty(base.board.getDimensions());
    const width = board.getDimensions().width;
    // fill bottom except x=2 to allow I vertical to clear
    for (let x = 0; x < width; x += 1) {
      if (x === 2) continue;
      board.setCell({ x, y: 0 }, CellContent.Block);
    }
    const ctrl = new GameController({
      ...base,
      board,
      currentPiece: {
        type: PieceType.I,
        orientation: PieceOrientation.Deg90,
        position: { x: 0, y: 3 },
      },
    });

    ctrl.enqueueCommand({ type: GameCommandType.HardDrop });
    ctrl.update(0);

    expect(ctrl.getEvents().some((e) => e.type === GameEventType.LinesCleared)).toBe(true);
  });

  it('blocked spawn leads to game over with event', () => {
    const base = createInitialGameState();
    const { width, height } = base.board.getDimensions();
    const blockedBoard = Board.createEmpty({ width, height });
    for (let x = 0; x < width; x += 1) {
      blockedBoard.setCell({ x, y: height - 1 }, CellContent.Block);
    }
    const ctrl = new GameController({ ...base, board: blockedBoard, currentPiece: null });
    ctrl.update(1200);

    expect(ctrl.getSnapshot().gameStatus).toBe(GameStatus.GameOver);
    expect(ctrl.getEvents().some((e) => e.type === GameEventType.GameOver)).toBe(true);
  });
});
