export enum GameEventType {
  StartLineDestruction = 'StartLineDestruction',
  PieceLocked = 'piece_locked',
  NewPieceSpawned = 'new_piece_spawned',
  GameOver = 'game_over',
}

export type GameEvent =
  | {
      type: GameEventType.StartLineDestruction;
      clearedLevels: number[];
    }
  | {
      type: GameEventType.PieceLocked;
      cells: { x: number; y: number }[];
    }
  | {
      type: GameEventType.NewPieceSpawned;
    }
  | {
      type: GameEventType.GameOver;
    };
