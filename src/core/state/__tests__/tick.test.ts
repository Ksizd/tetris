import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../initialState';
import { GameStatus, PieceOrientation, PieceType } from '../../types';
import { tickGame } from '../tick';
import { Board } from '../../board';
import { CellContent } from '../../types';

function makeStateWithPiece(y: number) {
  const state = createInitialGameState({ seed: 1, fallIntervalMs: 100 });
  return {
    ...state,
    currentPiece: {
      type: PieceType.I,
      orientation: PieceOrientation.Deg90, // вертикально для удобного падения
      position: { x: 0, y },
    },
  };
}

describe('tickGame', () => {
  it('does nothing if not enough time accumulated', () => {
    const state = makeStateWithPiece(2);
    const next = tickGame(state, 50); // half of 100ms interval
    expect(next.currentPiece?.position.y).toBe(2);
  });

  it('drops piece when enough time accumulates', () => {
    const state = makeStateWithPiece(2);
    const next = tickGame(state, 100);
    expect(next.currentPiece?.position.y).toBe(1);
  });

  it('spawns a piece when none present and space is free', () => {
    const state = createInitialGameState({ seed: 2, fallIntervalMs: 100 });
    const next = tickGame(state, 200);
    expect(next.currentPiece).not.toBeNull();
    expect(next.gameStatus).toBe(GameStatus.Running);
  });

  it('sets game over when spawn collides at the top', () => {
    const state = createInitialGameState({ seed: 3, fallIntervalMs: 100 });
    const { width, height } = state.board.getDimensions();
    // заполним верхний ряд, чтобы спаун наткнулся
    const filledBoard = Board.createEmpty({ width, height });
    for (let x = 0; x < width; x += 1) {
      filledBoard.setCell({ x, y: height - 1 }, CellContent.Block);
    }
    const blockedState = { ...state, board: filledBoard };
    const next = tickGame(blockedState, 200);
    expect(next.gameStatus).toBe(GameStatus.GameOver);
  });
});
