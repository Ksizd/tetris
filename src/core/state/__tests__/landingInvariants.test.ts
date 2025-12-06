import { describe, expect, it } from 'vitest';
import { Board } from '../../board';
import { CellContent, GameCommandType } from '../../types';
import { createInitialGameState } from '../initialState';
import { applyCommand } from '../commands';
import { tickGame } from '../tick';

function assertAllLockedCellsHaveSupport(board: Board): void {
  const { width, height } = board.getDimensions();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (board.getCell({ x, y }) !== CellContent.Block) {
        continue;
      }
      const supported = y === 0 || board.getCell({ x, y: y - 1 }) === CellContent.Block;
      expect(supported).toBe(true);
    }
  }
}

function spawnIfNeeded(state = createInitialGameState()): ReturnType<typeof createInitialGameState> {
  if (state.currentPiece) {
    return state;
  }
  const interval = state.timing.fallIntervalMs;
  return tickGame(state, interval);
}

function advanceUntilLocked(state: ReturnType<typeof createInitialGameState>): ReturnType<typeof createInitialGameState> {
  let working = state;
  let safety = 0;
  while (working.currentPiece && safety < 256) {
    const interval = working.timing.fallIntervalMs;
    working = tickGame(working, interval);
    safety += 1;
  }
  expect(safety).toBeLessThan(256);
  return working;
}

describe('landing invariants', () => {
  it('soft-drop gravity path leaves no unsupported locked cells', () => {
    let state = createInitialGameState({ board: { width: 6, height: 14 }, seed: 1234 });
    state = spawnIfNeeded(state);

    const afterLock = advanceUntilLocked(state);
    assertAllLockedCellsHaveSupport(afterLock.board);
  });

  it('hard drop locks immediately but still respects support invariant', () => {
    let state = createInitialGameState({ board: { width: 6, height: 14 }, seed: 5678 });
    state = spawnIfNeeded(state);

    state = applyCommand(state, { type: GameCommandType.HardDrop });
    // run a zero-time tick to process resulting lock/clearing
    const after = tickGame(state, 0);
    assertAllLockedCellsHaveSupport(after.board);
  });

  it('multiple successive locks (mixed soft/hard) keep all blocks supported', () => {
    let state = createInitialGameState({ board: { width: 6, height: 18 }, seed: 42 });
    const attempts = 8;
    for (let i = 0; i < attempts; i += 1) {
      state = spawnIfNeeded(state);
      if (i % 2 === 0) {
        // soft drop via gravity
        state = advanceUntilLocked(state);
      } else {
        state = applyCommand(state, { type: GameCommandType.HardDrop });
        state = tickGame(state, 0);
      }
      assertAllLockedCellsHaveSupport(state.board);
    }
  });
});
