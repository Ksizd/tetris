/**
 * Базовые параметры уровня; будут расширены на этапах балансировки.
 */
export type LevelDefaults = {
  startLevel: number;
};

export const DEFAULT_LEVEL_PARAMS: LevelDefaults = Object.freeze({
  startLevel: 1,
});
