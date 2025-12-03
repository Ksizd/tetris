import { ShardTemplate } from './shardTemplate';
import { generateShardTemplates, ShardGenerationOptions } from './shardTemplateGenerator';
import { validateShardCoverage, ShardCoverageCheckResult } from './shardVolumeMap';

export interface ShardTemplateSet {
  templates: ShardTemplate[];
  coverage: ShardCoverageCheckResult;
}

export interface ShardTemplateSetOptions extends ShardGenerationOptions {
  coverageResolution?: number;
  minCoveredFraction?: number;
}

let cachedDefault: ShardTemplateSet | null = null;

export function createShardTemplateSet(options: ShardTemplateSetOptions = {}): ShardTemplateSet {
  const templates = generateShardTemplates(options);
  const coverage = validateShardCoverage(templates, {
    resolution: options.coverageResolution ?? 8,
    minCoveredFraction: options.minCoveredFraction ?? 0.55,
  });
  if (!coverage.ok) {
    throw new Error(
      `ShardTemplate coverage too low: ${coverage.coveredFraction.toFixed(2)} < ${coverage.requiredFraction}`
    );
  }
  return { templates, coverage };
}

/**
 * Возвращает кэшированный набор шардов для единичного куба (использует Math.random).
 * Вызов без параметров будет генерировать только один раз за сессию.
 */
export function getDefaultShardTemplateSet(): ShardTemplateSet {
  if (!cachedDefault) {
    cachedDefault = createShardTemplateSet();
  }
  return cachedDefault;
}

/**
 * Для тестов / перегенерации (например, при смене параметров).
 */
export function resetDefaultShardTemplateSet(): void {
  cachedDefault = null;
}
