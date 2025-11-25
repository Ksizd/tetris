import { describe, expect, it } from 'vitest';
import { DEFAULT_SCORE_RULES, getLineClearScore } from '../scoring';

describe('scoring', () => {
  it('awards base points per line clear count', () => {
    expect(getLineClearScore(1, 1, 1)).toBe(DEFAULT_SCORE_RULES.single);
    expect(getLineClearScore(2, 1, 1)).toBe(DEFAULT_SCORE_RULES.double);
    expect(getLineClearScore(3, 1, 1)).toBe(DEFAULT_SCORE_RULES.triple);
    expect(getLineClearScore(4, 1, 1)).toBe(DEFAULT_SCORE_RULES.tetris);
  });

  it('scales with level multiplier', () => {
    const base = getLineClearScore(2, 1, 1);
    const lvl3 = getLineClearScore(2, 3, 1);
    expect(lvl3).toBe(base * 3);
  });

  it('adds combo bonus for streak > 1', () => {
    const noCombo = getLineClearScore(1, 1, 1);
    const combo = getLineClearScore(1, 1, 3); // streak length 3 → +2 combo steps
    expect(combo).toBe(noCombo + DEFAULT_SCORE_RULES.comboBonus * 2);
  });
});
