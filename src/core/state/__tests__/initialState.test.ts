import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../initialState';
import { DEFAULT_BOARD_DIMENSIONS } from '../../constants';
import { GameStatus, PieceType } from '../../types';

describe('createInitialGameState', () => {
  it('creates state with defaults and filled queue', () => {
    const state = createInitialGameState({ seed: 123, pieceMode: 'bag' });
    expect(state.board.getDimensions()).toEqual(DEFAULT_BOARD_DIMENSIONS);
    expect(state.currentPiece).toBeNull();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.linesCleared).toBe(0);
    expect(state.gameStatus).toBe(GameStatus.Idle);
    expect(state.nextPieces).toEqual([]);
    expect(state.timing.fallIntervalMs).toBeGreaterThan(0);

    const first = state.pieceQueue.peekNextPiece();
    expect(Object.values(PieceType)).toContain(first);
  });
});
