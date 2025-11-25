import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { createInitialGameState } from '../initialState';
import { ActivePiece, GameCommandType, GameStatus, PieceOrientation, PieceType } from '../../types';

function stateWithPiece(
  overrides: Partial<ReturnType<typeof createInitialGameState>> & {
    currentPiece?: Partial<ActivePiece>;
  } = {}
) {
  const base = createInitialGameState({ seed: 1, fallIntervalMs: 100 });
  const { currentPiece: currentPieceOverride, ...rest } = overrides;
  return {
    ...base,
    ...rest,
    currentPiece: {
      type: PieceType.I,
      orientation: PieceOrientation.Deg90, // вертикальный
      position: { x: 0, y: 2 },
      ...currentPieceOverride,
    },
  };
}

describe('applyCommand', () => {
  it('moves left/right when possible', () => {
    const state = stateWithPiece();
    const movedLeft = applyCommand(state, { type: GameCommandType.MoveLeft });
    expect(movedLeft.currentPiece?.position.x).toBe(state.currentPiece!.position.x - 1);

    const movedRight = applyCommand(state, { type: GameCommandType.MoveRight });
    expect(movedRight.currentPiece?.position.x).toBe(state.currentPiece!.position.x + 1);
  });

  it('rotates when possible', () => {
    const state = stateWithPiece({
      currentPiece: {
        type: PieceType.T,
        orientation: PieceOrientation.Deg0,
        position: { x: 1, y: 2 },
      },
    });
    const rotated = applyCommand(state, { type: GameCommandType.RotateCW });
    expect(rotated.currentPiece?.orientation).toBe((state.currentPiece!.orientation + 1) % 4);
  });

  it('soft drop moves down by one if free', () => {
    const state = stateWithPiece();
    const dropped = applyCommand(state, { type: GameCommandType.SoftDrop });
    expect(dropped.currentPiece?.position.y).toBe(state.currentPiece!.position.y - 1);
  });

  it('hard drop locks immediately and starts clearing if needed', () => {
    const state = stateWithPiece();
    const afterDrop = applyCommand(state, { type: GameCommandType.HardDrop });
    expect(afterDrop.currentPiece).toBeNull();
    expect(Array.isArray(afterDrop.clearingLayers)).toBe(true);
  });

  it('toggle pause switches between paused and running (not during clearing)', () => {
    const state = stateWithPiece({ gameStatus: GameStatus.Running });
    const paused = applyCommand(state, { type: GameCommandType.TogglePause });
    expect(paused.gameStatus).toBe(GameStatus.Paused);
    const resumed = applyCommand(paused, { type: GameCommandType.TogglePause });
    expect(resumed.gameStatus).toBe(GameStatus.Running);
  });
});
