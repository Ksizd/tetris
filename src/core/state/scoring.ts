export interface ScoreRules {
  single: number;
  double: number;
  triple: number;
  tetris: number;
  comboBonus: number;
}

export const DEFAULT_SCORE_RULES: ScoreRules = Object.freeze({
  single: 100,
  double: 300,
  triple: 500,
  tetris: 800,
  comboBonus: 50,
});

export function getLineClearScore(
  linesCleared: number,
  level: number,
  comboStreak: number,
  rules: ScoreRules = DEFAULT_SCORE_RULES
): number {
  if (linesCleared <= 0) {
    return 0;
  }

  const base =
    linesCleared === 1
      ? rules.single
      : linesCleared === 2
        ? rules.double
        : linesCleared === 3
          ? rules.triple
          : rules.tetris;

  const levelMultiplier = Math.max(1, level);
  const comboBonus = comboStreak > 1 ? rules.comboBonus * (comboStreak - 1) : 0;

  return base * levelMultiplier + comboBonus;
}
