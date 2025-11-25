import { describe, expect, it } from 'vitest';
import { PieceGenerator } from '../generator';
import { PieceType } from '../../types';

describe('PieceGenerator', () => {
  it('produces a 7-bag without repetition until refill', () => {
    const gen = new PieceGenerator({ seed: 42, mode: 'bag' });
    const firstBag = new Set<PieceType>();
    for (let i = 0; i < 7; i += 1) {
      firstBag.add(gen.next());
    }
    expect(firstBag.size).toBe(7);
  });

  it('is deterministic with the same seed in bag mode', () => {
    const genA = new PieceGenerator({ seed: 123, mode: 'bag' });
    const genB = new PieceGenerator({ seed: 123, mode: 'bag' });
    const seqA = Array.from({ length: 14 }, () => genA.next());
    const seqB = Array.from({ length: 14 }, () => genB.next());
    expect(seqA).toEqual(seqB);
  });

  it('works in uniform mode', () => {
    const gen = new PieceGenerator({ seed: 7, mode: 'uniform' });
    const picks = Array.from({ length: 5 }, () => gen.next());
    picks.forEach((p) => expect(Object.values(PieceType)).toContain(p));
  });
});
