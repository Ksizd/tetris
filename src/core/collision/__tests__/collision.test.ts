import { describe, expect, it } from 'vitest';
import { Board } from '../../board';
import { CellContent, PieceOrientation, PieceType, RotationDirection } from '../../types';
import { canMove, canRotate } from '../movement';
import { canPlacePiece } from '../canPlacePiece';
import { ActivePiece } from '../../types';

const dims = { width: 4, height: 4 };

function makeBoardWithBottomFilled(): Board {
  const board = Board.createEmpty(dims);
  for (let x = 0; x < dims.width; x += 1) {
    board.setCell({ x, y: 0 }, CellContent.Block);
  }
  return board;
}

function makePiece(overrides: Partial<ActivePiece> = {}): ActivePiece {
  return {
    type: PieceType.I,
    orientation: PieceOrientation.Deg0,
    position: { x: 0, y: 1 },
    ...overrides,
  };
}

describe('collision checks', () => {
  it('detects collision with bottom boundary', () => {
    const board = Board.createEmpty(dims);
    const piece = makePiece({ position: { x: 0, y: 0 }, orientation: PieceOrientation.Deg90 });
    expect(canMove(board, piece, 0, -1)).toBe(false); // would move part of I below y=0
    expect(canPlacePiece(board, piece)).toBe(true);
  });

  it('wraps horizontally when checking collision (no side walls)', () => {
    const board = Board.createEmpty(dims);
    const piece = makePiece({
      position: { x: dims.width - 1, y: 2 },
      orientation: PieceOrientation.Deg90,
    });
    expect(canMove(board, piece, 1, 0)).toBe(true);
    expect(canMove(board, piece, -1, 0)).toBe(true);
  });

  it('detects collision with existing blocks', () => {
    const board = makeBoardWithBottomFilled();
    const piece = makePiece({ position: { x: 0, y: 1 } });
    expect(canMove(board, piece, 0, -2)).toBe(false); // would overlap bottom blocks
  });

  it('allows rotate if space free, blocks rotate if overlap', () => {
    const board = Board.createEmpty(dims);
    const piece = makePiece({
      type: PieceType.T,
      orientation: PieceOrientation.Deg0,
      position: { x: 1, y: 1 },
    });
    expect(canRotate(board, piece, RotationDirection.Clockwise)).toBe(true);

    // place a block to collide with rotation
    board.setCell({ x: 3, y: 3 }, CellContent.Block);
    expect(canRotate(board, piece, RotationDirection.Clockwise)).toBe(false);
  });
});
