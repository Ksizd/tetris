import { describe, expect, it } from 'vitest';
import { getWorldBlocks } from '../position';
import { ActivePiece, PieceOrientation, PieceType } from '../../types';

const boardDims = { width: 4, height: 10 };
const wideBoardDims = { width: 54, height: 10 };

function makePiece(overrides: Partial<ActivePiece>): ActivePiece {
  return {
    type: PieceType.I,
    orientation: PieceOrientation.Deg0,
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('getWorldBlocks', () => {
  it('projects blocks with wrapping on x', () => {
    const piece = makePiece({ position: { x: 3, y: 0 } }); // I horizontal
    const blocks = getWorldBlocks(piece, boardDims);
    const xs = blocks.map((b) => b.x).sort((a, b) => a - b);
    expect(xs).toEqual([0, 1, 2, 3]); // wrapped from 6,7 back to 2,3,... normalized
  });

  it('keeps y without wrapping', () => {
    const piece = makePiece({ position: { x: 0, y: -1 } });
    const blocks = getWorldBlocks(piece, boardDims);
    const ys = blocks.map((b) => b.y);
    expect(ys).toEqual([0, 0, 0, 0]); // y from -1 + local y=[1,1,1,1] in I base
    expect(Math.min(...ys)).toBeLessThanOrEqual(0); // no wrapping by y
  });

  it('respects orientation changes when computing world coords', () => {
    const piece = makePiece({
      type: PieceType.T,
      orientation: PieceOrientation.Deg90,
      position: { x: 1, y: 2 },
    });
    const blocks = getWorldBlocks(piece, boardDims);
    expect(blocks).toEqual([
      { x: 0, y: 3 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
    ]);
  });

  it('wraps correctly on a wide board with many columns', () => {
    const piece = makePiece({ position: { x: wideBoardDims.width - 1, y: 0 } }); // I horizontal at edge
    const blocks = getWorldBlocks(piece, wideBoardDims);
    const xs = blocks.map((b) => b.x).sort((a, b) => a - b);
    expect(xs).toEqual([0, 1, 2, wideBoardDims.width - 1]);
  });
});
