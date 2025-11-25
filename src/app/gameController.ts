import { applyCommand } from '../core/state/commands';
import { GameCommand } from '../core/types/commands';
import { GameState } from '../core/state/gameState';
import { tickGame } from '../core/state/tick';
import { createInitialGameState, GameConfig } from '../core/state/initialState';
import { GameEvent, GameEventType } from './events';

/**
 * Application-layer controller: обрабатывает очередь команд и время,
 * отдаёт снэпшот состояния для рендера/ввода.
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
    this.collectEvents(prevState, this.state);
    return this.getSnapshot();
  }

  getEvents(): readonly GameEvent[] {
    return this.lastEvents;
  }

  getSnapshot(): Readonly<GameState> {
    // возвращаем копию, чтобы внешние мутации не портили внутреннее состояние
    return { ...this.state };
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

  private collectEvents(prev: GameState, current: GameState): void {
    if (prev.currentPiece && !current.currentPiece) {
      this.lastEvents.push({ type: GameEventType.PieceLocked });
    }

    const hadNoClearing = prev.clearingLayers.length === 0;
    const startedClearing = current.clearingLayers.length > 0 && hadNoClearing;
    if (startedClearing) {
      this.lastEvents.push({
        type: GameEventType.LinesCleared,
        layers: current.clearingLayers,
      });
    }

    const spawned = !prev.currentPiece && !!current.currentPiece;
    if (spawned) {
      this.lastEvents.push({ type: GameEventType.NewPieceSpawned });
    }

    if (prev.gameStatus !== current.gameStatus && current.gameStatus === 'game_over') {
      this.lastEvents.push({ type: GameEventType.GameOver });
    }
  }
}
