import { describe, expect, it } from 'vitest';
import { GameState } from '../gameState';
import { tryMovePiece } from '../movement';
import { createInitialGameState } from '../initialState';
import { PieceOrientation, PieceType } from '../../types';
import { CellContent } from '../../types';

function createStateWithPiece(y: number): GameState {
  const base = createInitialGameState();
  const piece = {
    type: PieceType.I,
    orientation: PieceOrientation.Deg0,
    position: { x: 0, y },
  };
  return { ...base, currentPiece: piece };
}

describe('tryMovePiece horizontal moves', () => {
  it('moves left without changing vertical coordinate', () => {
    const state = createStateWithPiece(10);
    const result = tryMovePiece(state, { dx: -1, dy: 0, rotation: 0 });
    expect(result.moved).toBe(true);
    expect(result.state.currentPiece?.position.y).toBe(10);
  });

  it('blocks when moving into occupied cell', () => {
    const state = createStateWithPiece(0);
    const board = state.board.clone();
    board.setCell({ x: 1, y: 0 }, CellContent.Block);
    const withBlockedBoard = { ...state, board };

    const result = tryMovePiece(withBlockedBoard, { dx: 1, dy: 0, rotation: 0 });
    expect(result.moved).toBe(false);
    expect(result.reason).toBe('occupied');
  });
});
