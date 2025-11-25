export enum GameEventType {
  LinesCleared = 'lines_cleared',
  PieceLocked = 'piece_locked',
  NewPieceSpawned = 'new_piece_spawned',
  GameOver = 'game_over',
}

export type GameEvent =
  | {
      type: GameEventType.LinesCleared;
      layers: number[];
    }
  | {
      type: GameEventType.PieceLocked;
    }
  | {
      type: GameEventType.NewPieceSpawned;
    }
  | {
      type: GameEventType.GameOver;
    };
