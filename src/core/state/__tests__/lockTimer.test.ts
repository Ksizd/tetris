import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../initialState';
import { GameStatus, PieceOrientation, PieceType } from '../../types';
import { tickGame } from '../tick';
import { LOCK_DELAY_MAX_MS } from '../lockDelay';

function makeGroundedState() {
  const base = createInitialGameState({ board: { width: 6, height: 6 } });
  return {
    ...base,
    currentPiece: {
      type: PieceType.O,
      orientation: PieceOrientation.Deg0,
      position: { x: 0, y: 0 },
    },
    gameStatus: GameStatus.Running,
  };
}

describe('lock timer exposure', () => {
  it('sets lock delay and elapsed on landing', () => {
    const landed = tickGame(makeGroundedState(), 16);
    expect(landed.fallState.landed).toBe(true);
    expect(landed.fallState.lockDelayMs).toBe(LOCK_DELAY_MAX_MS);
    expect(landed.fallState.lockTimeMs).toBe(LOCK_DELAY_MAX_MS);
    expect(landed.fallState.lockElapsedMs).toBe(0);
  });

  it('decrements remaining and increases elapsed during lock', () => {
    const grounded = makeGroundedState();
    const landed = tickGame(grounded, 0);
    const afterTick = tickGame(landed, 100);
    expect(afterTick.fallState.landed).toBe(true);
    expect(afterTick.fallState.lockTimeMs).toBe(LOCK_DELAY_MAX_MS - 100);
    expect(afterTick.fallState.lockElapsedMs).toBe(100);
    expect(afterTick.fallState.lockDelayMs).toBe(LOCK_DELAY_MAX_MS);
  });

  it('reports inactive timer when piece is airborne', () => {
    const base = createInitialGameState({ board: { width: 6, height: 6 } });
    const airborne = tickGame(
      {
        ...base,
        currentPiece: {
          type: PieceType.O,
          orientation: PieceOrientation.Deg0,
          position: { x: 0, y: 4 },
        },
        gameStatus: GameStatus.Running,
      },
      16
    );
    expect(airborne.fallState.landed).toBe(false);
    expect(airborne.fallState.lockElapsedMs).toBe(0);
  });
});
