import { GameCommand, GameCommandType } from '../core/types/commands';

type EventTargetLike = Pick<Window, 'addEventListener' | 'removeEventListener'>;
type CommandListener = (command: GameCommand) => void;

const KEY_TO_COMMAND: Record<string, GameCommandType | undefined> = {
  ArrowLeft: GameCommandType.MoveLeft,
  ArrowRight: GameCommandType.MoveRight,
  ArrowUp: GameCommandType.RotateCW,
  KeyZ: GameCommandType.RotateCCW,
  ArrowDown: GameCommandType.SoftDrop,
  Space: GameCommandType.HardDrop,
  KeyP: GameCommandType.TogglePause,
};
const AUTO_REPEAT_COMMANDS = new Set<GameCommandType>([
  GameCommandType.MoveLeft,
  GameCommandType.MoveRight,
  GameCommandType.SoftDrop,
]);

export interface AutoRepeatConfig {
  enabled?: boolean;
  initialDelayMs?: number;
  repeatIntervalMs?: number;
}

export interface KeyboardInputParams {
  onCommand: CommandListener;
  target?: EventTargetLike;
  preventDefault?: boolean;
  autoRepeat?: AutoRepeatConfig;
}

/**
 * Listens to keyboard events and translates them into high-level game commands.
 * Emits on keydown to avoid double-triggering toggles on keyup; keyup is tracked for future handling.
 */
export class KeyboardInput {
  private readonly target: EventTargetLike;
  private readonly onCommand: CommandListener;
  private readonly shouldPreventDefault: boolean;
  private readonly autoRepeatEnabled: boolean;
  private readonly autoRepeatInitialDelayMs: number;
  private readonly autoRepeatIntervalMs: number;
  private readonly repeatTimers = new Map<string, { start?: number; interval?: number }>();
  private readonly pressedKeys = new Set<string>();
  private readonly handleKeyDown = (event: KeyboardEvent) => this.onKeyDown(event);
  private readonly handleKeyUp = (event: KeyboardEvent) => this.onKeyUp(event);

  constructor(params: KeyboardInputParams) {
    const resolvedTarget = params.target ?? (typeof window !== 'undefined' ? window : undefined);
    if (!resolvedTarget) {
      throw new Error('KeyboardInput requires an event target');
    }
    this.target = resolvedTarget;
    this.onCommand = params.onCommand;
    this.shouldPreventDefault = params.preventDefault ?? true;
    this.autoRepeatEnabled = params.autoRepeat?.enabled ?? true;
    this.autoRepeatInitialDelayMs = params.autoRepeat?.initialDelayMs ?? 150;
    this.autoRepeatIntervalMs = params.autoRepeat?.repeatIntervalMs ?? 60;
  }

  start(): void {
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.repeat || this.pressedKeys.has(event.code)) {
      return;
    }
    const commandType = KEY_TO_COMMAND[event.code];
    if (!commandType) {
      return;
    }
    this.pressedKeys.add(event.code);
    if (this.shouldPreventDefault) {
      event.preventDefault?.();
    }
    this.onCommand({ type: commandType });
    if (this.autoRepeatEnabled && AUTO_REPEAT_COMMANDS.has(commandType)) {
      if (this.repeatTimers.has(event.code)) {
        return;
      }
      const start = setTimeout(() => {
        const interval = setInterval(
          () => this.onCommand({ type: commandType }),
          this.autoRepeatIntervalMs
        );
        this.repeatTimers.set(event.code, { interval });
      }, this.autoRepeatInitialDelayMs);
      this.repeatTimers.set(event.code, { start });
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (KEY_TO_COMMAND[event.code]) {
      if (this.shouldPreventDefault) {
        event.preventDefault?.();
      }
    }
    this.pressedKeys.delete(event.code);
    const timers = this.repeatTimers.get(event.code);
    if (timers?.start !== undefined) {
      clearTimeout(timers.start);
    }
    if (timers?.interval !== undefined) {
      clearInterval(timers.interval);
    }
    this.repeatTimers.delete(event.code);
  }
}
