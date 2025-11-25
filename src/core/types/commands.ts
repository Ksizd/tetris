export enum GameCommandType {
  MoveLeft = 'move_left',
  MoveRight = 'move_right',
  RotateCW = 'rotate_cw',
  RotateCCW = 'rotate_ccw',
  SoftDrop = 'soft_drop',
  HardDrop = 'hard_drop',
  TogglePause = 'toggle_pause',
}

export type GameCommand =
  | { type: GameCommandType.MoveLeft }
  | { type: GameCommandType.MoveRight }
  | { type: GameCommandType.RotateCW }
  | { type: GameCommandType.RotateCCW }
  | { type: GameCommandType.SoftDrop }
  | { type: GameCommandType.HardDrop }
  | { type: GameCommandType.TogglePause };

export const ALL_GAME_COMMAND_TYPES: readonly GameCommandType[] = [
  GameCommandType.MoveLeft,
  GameCommandType.MoveRight,
  GameCommandType.RotateCW,
  GameCommandType.RotateCCW,
  GameCommandType.SoftDrop,
  GameCommandType.HardDrop,
  GameCommandType.TogglePause,
] as const;
