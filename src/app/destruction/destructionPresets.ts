export interface Range {
  min: number;
  max: number;
}

export interface DestructionPreset {
  fragmentCount: Range;
  lifetimeMs: Range;
  radialSpeed: Range; // units per second
  tangentialSpeed: Range; // units per second
  verticalSpeed: Range; // units per second
  fullPhysics: boolean;
}

/**
 * Пресет ultra для максимальной зрелищности: много фрагментов, длинная жизнь, высокая скорость вылета
 * и полная физика (гравитация, drag, столкновения с полом, радиус и т.д.).
 */
export const ULTRA_DESTRUCTION_PRESET: DestructionPreset = {
  fragmentCount: { min: 16, max: 32 },
  lifetimeMs: { min: 2200, max: 3600 },
  radialSpeed: { min: 6, max: 14 }, // хватает, чтобы улететь дальше 1-2 кубиков радиально
  tangentialSpeed: { min: 2, max: 8 },
  verticalSpeed: { min: -2, max: 6 },
  fullPhysics: true,
};

/**
 * Пресет low: меньше фрагментов, короче жизнь, пониженные скорости и упрощённая физика (можно без bounce).
 */
export const LOW_DESTRUCTION_PRESET: DestructionPreset = {
  fragmentCount: { min: 4, max: 8 },
  lifetimeMs: { min: 700, max: 1200 },
  radialSpeed: { min: 3, max: 7 },
  tangentialSpeed: { min: 1, max: 4 },
  verticalSpeed: { min: -1, max: 3 },
  fullPhysics: false,
};

