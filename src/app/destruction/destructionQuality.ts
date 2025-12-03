export type DestructionQuality = 'ultra_v1' | 'ultra_v2';

export const DEFAULT_DESTRUCTION_QUALITY: DestructionQuality = 'ultra_v2';

export function isDestructionQuality(value: unknown): value is DestructionQuality {
  return value === 'ultra_v1' || value === 'ultra_v2';
}
