import { describe, expect, it } from 'vitest';
import { GameController } from '../gameController';
import { ActivePiece, GameCommandType, PieceOrientation, PieceType } from '../../core/types';
import { createInitialGameState } from '../../core/state/initialState';
import { GameEventType } from '../events';

describe('GameController', () => {
  it('processes queued commands on update', () => {
    const base = createInitialGameState();
    const customPiece: ActivePiece = {
      type: PieceType.I,
      orientation: PieceOrientation.Deg90,
      position: { x: 0, y: 2 },
    };
    const controller = new GameController({ ...base, currentPiece: customPiece });

    controller.enqueueCommand({ type: GameCommandType.MoveRight });
    const next = controller.update(0);
    expect(next.currentPiece?.position.x).toBe(1);
    expect(controller.getEvents().length).toBe(0);
  });

  it('exposes read-only snapshot (mutating original reference does not change controller state)', () => {
    const controller = new GameController();
    const snap = controller.getSnapshot();
    (snap as GameState).score = 999;
    const nextSnap = controller.getSnapshot();
    expect(nextSnap.score).not.toBe(999);
  });

  it('emits events for spawn', () => {
    const controller = new GameController(createInitialGameState());
    controller.update(1200); // накопим прогресс для спауна
    expect(controller.getEvents().some((e) => e.type === GameEventType.NewPieceSpawned)).toBe(true);
  });
});
