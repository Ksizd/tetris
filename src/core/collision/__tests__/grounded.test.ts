import { describe, expect, it } from 'vitest';
import { Board } from '../../board';
import { PieceOrientation, PieceType } from '../../types';
import { isGrounded } from '../movement';

function makeBoard(width: number, height: number): Board {
  return Board.createEmpty({ width, height });
}

describe('isGrounded', () => {
  it('returns false when there is space below', () => {
    const board = makeBoard(4, 6);
    const piece = {
      type: PieceType.I,
      orientation: PieceOrientation.Deg90,
      position: { x: 0, y: 3 },
    };
    expect(isGrounded(board, piece)).toBe(false);
  });

  it('returns true when touching the floor', () => {
    const board = makeBoard(4, 6);
    const piece = {
      type: PieceType.I,
      orientation: PieceOrientation.Deg90,
      position: { x: 0, y: 0 },
    };
    expect(isGrounded(board, piece)).toBe(true);
  });

  it('returns true when resting on another block', () => {
    const board = makeBoard(4, 6);
    board.setCell({ x: 0, y: 0 }, 1 as any); // mark occupied
    const piece = {
      type: PieceType.O,
      orientation: PieceOrientation.Deg0,
      position: { x: 0, y: 1 },
    };
    expect(isGrounded(board, piece)).toBe(true);
  });
});
