import { PieceType } from '../types';
import { PieceGenerator, PieceGeneratorConfig } from './generator';

export interface PieceQueueConfig extends PieceGeneratorConfig {
  /**
   * Целевая длина очереди, которую мы поддерживаем (для HUD/спауна).
   */
  queueSize?: number;
}

export class PieceQueue {
  private readonly generator: PieceGenerator;
  private readonly targetSize: number;
  private readonly queue: PieceType[] = [];

  constructor(config: PieceQueueConfig = {}) {
    this.generator = new PieceGenerator(config);
    this.targetSize = Math.max(1, config.queueSize ?? 5);
    this.fillToTarget();
  }

  peekNextPiece(): PieceType {
    this.ensureNotEmpty();
    return this.queue[0];
  }

  getNextPiece(): PieceType {
    this.ensureNotEmpty();
    const next = this.queue.shift() as PieceType;
    this.fillToTarget();
    return next;
  }

  private ensureNotEmpty(): void {
    if (this.queue.length === 0) {
      this.queue.push(this.generator.next());
    }
  }

  private fillToTarget(): void {
    while (this.queue.length < this.targetSize) {
      this.queue.push(this.generator.next());
    }
  }
}
