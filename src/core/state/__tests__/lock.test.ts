import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../initialState';
import { lockCurrentPiece } from '../lock';
import { PieceOrientation, PieceType } from '../../types';
import { CellContent } from '../../types';

describe('lockCurrentPiece', () => {
  it('writes piece blocks to board and clears currentPiece', () => {
    const state = createInitialGameState({ seed: 1 });
    const board = state.board.clone();
    const piece = {
      type: PieceType.I,
      orientation: PieceOrientation.Deg90, // вертикальный столбец
      position: { x: 0, y: 1 },
    };

    const next = lockCurrentPiece({ ...state, board, currentPiece: piece });
    expect(next.currentPiece).toBeNull();
    expect(next.board.getCell({ x: 2, y: 1 })).toBe(CellContent.Block);
    expect(next.board.getCell({ x: 2, y: 2 })).toBe(CellContent.Block);
    expect(next.board.getCell({ x: 2, y: 3 })).toBe(CellContent.Block);
    expect(next.board.getCell({ x: 2, y: 4 })).toBe(CellContent.Block);
  });

  it('ignores blocks outside vertical bounds', () => {
    const state = createInitialGameState({ seed: 1 });
    const board = state.board.clone();
    const piece = {
      type: PieceType.I,
      orientation: PieceOrientation.Deg90,
      position: { x: 0, y: -2 }, // часть выйдет ниже 0
    };
    const next = lockCurrentPiece({ ...state, board, currentPiece: piece });
    expect(next.board.getCell({ x: 0, y: 0 })).toBe(CellContent.Empty);
  });
});
