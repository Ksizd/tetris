import { DEFAULT_FALL_SPEED, getFallIntervalMs } from './fallSpeed';

export interface LevelingRules {
  linesPerLevel: number;
}

export const DEFAULT_LEVELING_RULES: LevelingRules = Object.freeze({
  linesPerLevel: 10,
});

export interface LevelProgress {
  level: number;
  fallIntervalMs: number;
}

export function updateLevel(
  currentLevel: number,
  totalLinesCleared: number,
  rules: LevelingRules = DEFAULT_LEVELING_RULES
): LevelProgress {
  const newLevel = Math.max(currentLevel, Math.floor(totalLinesCleared / rules.linesPerLevel) + 1);
  const fallIntervalMs = getFallIntervalMs(newLevel, DEFAULT_FALL_SPEED);
  return { level: newLevel, fallIntervalMs };
}
