import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../initialState';
import { PieceOrientation, PieceType, CellContent } from '../../types';
import { computeHardDropPosition } from '../movement';

function makeStateWithPiece() {
  const base = createInitialGameState({ board: { width: 4, height: 6 } });
  const piece = {
    type: PieceType.O,
    orientation: PieceOrientation.Deg0,
    position: { x: 1, y: 4 },
  };
  return { ...base, currentPiece: piece };
}

describe('computeHardDropPosition', () => {
  it('drops piece to the first blocking layer', () => {
    const base = makeStateWithPiece();
    const board = base.board.clone();
    board.setCell({ x: 1, y: 0 }, CellContent.Block);
    board.setCell({ x: 2, y: 0 }, CellContent.Block);
    const state = { ...base, board };

    const landed = computeHardDropPosition(state);
    expect(landed).not.toBeNull();
    expect(landed?.position.y).toBe(1);
  });

  it('lands on floor when no obstacles are below', () => {
    const state = makeStateWithPiece();
    const landed = computeHardDropPosition(state);
    expect(landed?.position.y).toBe(0);
  });
});
