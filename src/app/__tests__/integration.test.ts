import { describe, expect, it } from 'vitest';
import { GameController } from '../gameController';
import { GameCommandType, GameStatus, PieceOrientation, PieceType } from '../../core/types';
import { createInitialGameState } from '../../core/state/initialState';
import { Board } from '../../core/board';
import { CellContent } from '../../core/types';
import { GameEventType } from '../events';

function controllerWithPiece(
  piece: { x: number; y: number },
  orientation = PieceOrientation.Deg90
) {
  const base = createInitialGameState();
  const customPiece = {
    type: PieceType.I,
    orientation,
    position: { x: piece.x, y: piece.y },
  };
  return new GameController({ ...base, currentPiece: customPiece, gameStatus: GameStatus.Running });
}

describe('Integration: controller + domain', () => {
  it('piece falls and locks on the floor', () => {
    const ctrl = controllerWithPiece({ x: 0, y: 1 });
    ctrl.enqueueCommand({ type: GameCommandType.HardDrop });
    ctrl.update(0);
    expect(ctrl.getSnapshot().currentPiece).toBeNull();
    expect(ctrl.getEvents().some((e) => e.type === GameEventType.PieceLocked)).toBe(true);
  });

  it('sequence clears a layer', () => {
    const base = createInitialGameState();
    const board = Board.createEmpty(base.board.getDimensions());
    for (let x = 0; x < board.getDimensions().width; x += 1) {
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
      gameStatus: GameStatus.Running,
    });
    ctrl.enqueueCommand({ type: GameCommandType.HardDrop });
    ctrl.update(0);
    expect(ctrl.getEvents().some((e) => e.type === GameEventType.LinesCleared)).toBe(true);
  });

  it('goes to game over when spawn is blocked', () => {
    const base = createInitialGameState();
    const { width, height } = base.board.getDimensions();
    const blockedBoard = Board.createEmpty({ width, height });
    for (let x = 0; x < width; x += 1) {
      blockedBoard.setCell({ x, y: height - 1 }, CellContent.Block);
    }
    const deterministicQueue = {
      getNextPiece: () => PieceType.T,
      peekNextPiece: () => PieceType.T,
    };
    const ctrl = new GameController({
      ...base,
      board: blockedBoard,
      currentPiece: null,
      pieceQueue: deterministicQueue as unknown as typeof base.pieceQueue,
      gameStatus: GameStatus.Running,
    });
    ctrl.update(1200);
    expect(ctrl.getSnapshot().gameStatus).toBe('game_over');
    expect(ctrl.getEvents().some((e) => e.type === GameEventType.GameOver)).toBe(true);
  });
});
