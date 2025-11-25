import { describe, expect, it } from 'vitest';
import { Board } from '../board';
import { CellContent } from '../../types';

describe('Board', () => {
  const dims = { width: 4, height: 3 };

  it('creates an empty board with all cells empty', () => {
    const board = Board.createEmpty(dims);
    for (let y = 0; y < dims.height; y += 1) {
      for (let x = 0; x < dims.width; x += 1) {
        expect(board.getCell({ x, y })).toBe(CellContent.Empty);
      }
    }
  });

  it('sets and gets a cell with wrap-around by x', () => {
    const board = Board.createEmpty(dims);
    board.setCell({ x: -1, y: 1 }, CellContent.Block);
    expect(board.getCell({ x: dims.width - 1, y: 1 })).toBe(CellContent.Block);
  });

  it('throws on out-of-bounds y', () => {
    const board = Board.createEmpty(dims);
    expect(() => board.getCell({ x: 0, y: -1 })).toThrow();
    expect(() => board.setCell({ x: 0, y: dims.height }, CellContent.Block)).toThrow();
  });

  it('checks layer fullness', () => {
    const board = Board.createEmpty(dims);
    const y = 1;
    for (let x = 0; x < dims.width; x += 1) {
      board.setCell({ x, y }, CellContent.Block);
    }
    expect(board.isLayerFull(y)).toBe(true);
    board.setCell({ x: 0, y }, CellContent.Empty);
    expect(board.isLayerFull(y)).toBe(false);
  });

  it('clears a layer', () => {
    const board = Board.createEmpty(dims);
    const y = 2;
    for (let x = 0; x < dims.width; x += 1) {
      board.setCell({ x, y }, CellContent.Block);
    }
    board.clearLayer(y);
    for (let x = 0; x < dims.width; x += 1) {
      expect(board.getCell({ x, y })).toBe(CellContent.Empty);
    }
  });

  it('clones board state', () => {
    const board = Board.createEmpty(dims);
    board.setCell({ x: 1, y: 1 }, CellContent.Block);
    const copy = board.clone();
    board.setCell({ x: 1, y: 1 }, CellContent.Empty);
    expect(copy.getCell({ x: 1, y: 1 })).toBe(CellContent.Block);
  });
});
