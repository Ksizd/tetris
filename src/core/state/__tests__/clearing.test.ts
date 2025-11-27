import { describe, expect, it } from 'vitest';
import { Board } from '../../board';
import { CellContent } from '../../types';
import { beginClearingPhase, completeClearingPhase, findFullLayers } from '../clearing';
import { createInitialGameState } from '../initialState';
import { GameStatus } from '../../types';

describe('findFullLayers', () => {
  it('returns empty array when no full layers', () => {
    const board = Board.createEmpty({ width: 3, height: 3 });
    expect(findFullLayers(board)).toEqual([]);
  });

  it('detects fully filled layers', () => {
    const board = Board.createEmpty({ width: 3, height: 4 });
    // fill y=1 and y=3
    for (const y of [1, 3]) {
      for (let x = 0; x < 3; x += 1) {
        board.setCell({ x, y }, CellContent.Block);
      }
    }
    expect(findFullLayers(board)).toEqual([1, 3]);
  });

  it('handles large width boards without missing full layers', () => {
    const board = Board.createEmpty({ width: 54, height: 3 });
    for (let x = 0; x < 54; x += 1) {
      board.setCell({ x, y: 0 }, CellContent.Block);
    }
    expect(findFullLayers(board)).toEqual([0]);
  });
});

describe('beginClearingPhase', () => {
  it('marks clearing when layers are full', () => {
    const state = createInitialGameState();
    const board = state.board.clone();
    for (let x = 0; x < board.getDimensions().width; x += 1) {
      board.setCell({ x, y: 0 }, CellContent.Block);
    }
    const next = beginClearingPhase({ ...state, board });
    expect(next.clearingLayers).toEqual([0]);
    expect(next.gameStatus).toBe(GameStatus.Clearing);
  });

  it('keeps status when no layers to clear', () => {
    const state = createInitialGameState();
    const next = beginClearingPhase(state);
    expect(next.clearingLayers).toEqual([]);
    expect(next.gameStatus).toBe(GameStatus.Idle);
  });

  it('completes clearing by dropping rows and spawning new piece', () => {
    const state = createInitialGameState({ seed: 10 });
    const board = state.board.clone();
    const { width } = board.getDimensions();
    // y=0 full, y=1 has a block at x=0 to drop
    for (let x = 0; x < width; x += 1) {
      board.setCell({ x, y: 0 }, CellContent.Block);
    }
    board.setCell({ x: 0, y: 1 }, CellContent.Block);

    const clearingState = beginClearingPhase({ ...state, board });
    const finished = completeClearingPhase(clearingState);

    expect(finished.clearingLayers).toEqual([]);
    expect(finished.linesCleared).toBe(state.linesCleared + 1);
    // блок из y=1 должен упасть на y=0 после очистки
    expect(finished.board.getCell({ x: 0, y: 0 })).toBe(CellContent.Block);
    expect(finished.currentPiece).not.toBeNull();
    expect(
      finished.gameStatus === GameStatus.Running || finished.gameStatus === GameStatus.GameOver
    ).toBe(true);
  });
});
