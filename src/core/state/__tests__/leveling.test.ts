import { describe, expect, it } from 'vitest';
import { DEFAULT_LEVELING_RULES, updateLevel } from '../leveling';
import { DEFAULT_FALL_SPEED, getFallIntervalMs } from '../fallSpeed';

describe('leveling', () => {
  it('keeps level if threshold not reached', () => {
    const result = updateLevel(1, DEFAULT_LEVELING_RULES.linesPerLevel - 1);
    expect(result.level).toBe(1);
  });

  it('increments level when lines threshold is met', () => {
    const result = updateLevel(1, DEFAULT_LEVELING_RULES.linesPerLevel);
    expect(result.level).toBe(2);
  });

  it('uses fall speed for new level', () => {
    const targetLevel = 3;
    const result = updateLevel(1, DEFAULT_LEVELING_RULES.linesPerLevel * (targetLevel - 1));
    expect(result.fallIntervalMs).toBe(getFallIntervalMs(targetLevel, DEFAULT_FALL_SPEED));
  });
});
