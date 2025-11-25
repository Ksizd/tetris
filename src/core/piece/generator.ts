import { PieceType } from '../types';

export type PieceGeneratorMode = 'bag' | 'uniform';

export interface PieceGeneratorConfig {
  seed?: number;
  mode?: PieceGeneratorMode;
}

type Rng = () => number;

const ALL_PIECES: PieceType[] = [
  PieceType.I,
  PieceType.O,
  PieceType.T,
  PieceType.S,
  PieceType.Z,
  PieceType.J,
  PieceType.L,
];

export class PieceGenerator {
  private readonly rng: Rng;
  private readonly mode: PieceGeneratorMode;
  private bag: PieceType[] = [];

  constructor(config: PieceGeneratorConfig = {}) {
    const seed = config.seed ?? Date.now();
    this.rng = createSeededRng(seed);
    this.mode = config.mode ?? 'bag';
    if (this.mode === 'bag') {
      this.refillBag();
    }
  }

  next(): PieceType {
    if (this.mode === 'uniform') {
      return this.randomUniform();
    }

    if (this.bag.length === 0) {
      this.refillBag();
    }

    const piece = this.bag.pop();
    if (!piece) {
      // Should never happen, но страхуемся
      this.refillBag();
      return this.bag.pop() as PieceType;
    }
    return piece;
  }

  private randomUniform(): PieceType {
    const idx = Math.floor(this.rng() * ALL_PIECES.length);
    return ALL_PIECES[idx];
  }

  private refillBag(): void {
    this.bag = shuffle([...ALL_PIECES], this.rng);
  }
}

function createSeededRng(seed: number): Rng {
  // Простая LCG: X_{n+1} = (a * X_n + c) mod m
  let state = seed >>> 0;
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;

  return () => {
    state = (a * state + c) % m;
    return state / m;
  };
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
