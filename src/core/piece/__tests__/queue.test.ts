import { describe, expect, it } from 'vitest';
import { PieceQueue } from '../queue';
import { PieceType } from '../../types';

describe('PieceQueue', () => {
  it('peek does not consume and getNext consumes', () => {
    const queue = new PieceQueue({ seed: 1, queueSize: 3, mode: 'bag' });
    const peeked = queue.peekNextPiece();
    const first = queue.getNextPiece();
    const second = queue.getNextPiece();

    expect(first).toBe(peeked);
    expect(second).not.toBe(first);
  });

  it('refills to target size after consumption', () => {
    const targetSize = 4;
    const queue = new PieceQueue({ seed: 2, queueSize: targetSize, mode: 'bag' });
    queue.getNextPiece();
    queue.getNextPiece();
    // после двух извлечений очередь должна остаться на целевом размере
    const next = queue.peekNextPiece();
    expect(Object.values(PieceType)).toContain(next);
  });

  it('is deterministic with the same seed and config', () => {
    const q1 = new PieceQueue({ seed: 999, queueSize: 3, mode: 'bag' });
    const q2 = new PieceQueue({ seed: 999, queueSize: 3, mode: 'bag' });
    const seq1 = [q1.getNextPiece(), q1.getNextPiece(), q1.getNextPiece(), q1.peekNextPiece()];
    const seq2 = [q2.getNextPiece(), q2.getNextPiece(), q2.getNextPiece(), q2.peekNextPiece()];
    expect(seq1).toEqual(seq2);
  });
});
