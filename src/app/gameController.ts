import { applyCommand } from '../core/state/commands';
import { GameCommand } from '../core/types/commands';
import { GameState } from '../core/state/gameState';
import { tickGame } from '../core/state/tick';
import { createInitialGameState, GameConfig } from '../core/state/initialState';
import { GameEvent, GameEventType } from './events';
import { GameStatus } from '../core/types';

/**
 * Application-layer controller: orchestrates domain state updates, input commands and exposes snapshots.
 */
export class GameController {
  private state: GameState;
  private readonly pendingCommands: GameCommand[] = [];
  private lastEvents: GameEvent[] = [];

  constructor(initialState?: GameState) {
    this.state = initialState ?? createInitialGameState();
  }

  static createWithConfig(config?: Partial<GameConfig>): GameController {
    return new GameController(createInitialGameState(config));
  }

  enqueueCommand(command: GameCommand): void {
    this.pendingCommands.push(command);
  }

  update(deltaTimeMs: number): Readonly<GameState> {
    const prevState = this.state;
    this.lastEvents = [];
    this.flushCommands();
    this.state = tickGame(this.state, deltaTimeMs);
    this.collectEvents(prevState, this.state, this.lastEvents);
    return this.getSnapshot();
  }

  getEvents(): readonly GameEvent[] {
    return this.lastEvents;
  }

  getSnapshot(): Readonly<GameState> {
    return { ...this.state };
  }

  startNewGame(config?: Partial<GameConfig>): void {
    const initial = createInitialGameState(config);
    const timing = { ...initial.timing, fallProgressMs: initial.timing.fallIntervalMs };
    this.state = { ...initial, timing, gameStatus: GameStatus.Running };
  }

  /**
   * Applies an external state transition (e.g. after finishing destruction animation)
   * and appends the corresponding events to the current frame.
   */
  applyExternalState(nextState: GameState): Readonly<GameState> {
    const prevState = this.state;
    const additional: GameEvent[] = [];
    this.collectEvents(prevState, nextState, additional);
    this.state = nextState;
    this.lastEvents = [...this.lastEvents, ...additional];
    return this.getSnapshot();
  }

  private flushCommands(): void {
    if (this.pendingCommands.length === 0) {
      return;
    }
    while (this.pendingCommands.length > 0) {
      const command = this.pendingCommands.shift();
      if (!command) {
        continue;
      }
      this.state = applyCommand(this.state, command);
    }
  }

  private collectEvents(prev: GameState, current: GameState, bucket: GameEvent[]): void {
    if (prev.currentPiece && !current.currentPiece) {
      bucket.push({ type: GameEventType.PieceLocked });
    }

    const hadNoClearing = prev.clearingLayers.length === 0;
    const startedClearing =
      current.clearingLayers.length > 0 &&
      hadNoClearing &&
      current.gameStatus === GameStatus.Clearing;
    if (startedClearing) {
      bucket.push({
        type: GameEventType.StartLineDestruction,
        clearedLevels: current.clearingLayers,
      });
    }

    const spawned = !prev.currentPiece && !!current.currentPiece;
    if (spawned) {
      bucket.push({ type: GameEventType.NewPieceSpawned });
    }

    if (prev.gameStatus !== current.gameStatus && current.gameStatus === 'game_over') {
      bucket.push({ type: GameEventType.GameOver });
    }
  }
}
