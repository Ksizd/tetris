import { CanonicalShard } from './canonicalShards';

export interface CanonicalShardReport {
  totalShards: number;
  byMaterial: Record<CanonicalShard['materialKind'], { count: number; volume: number }>;
  totalVolume: number;
  minVolume: number;
  maxVolume: number;
  averageVolume: number;
}

const MATERIALS: CanonicalShard['materialKind'][] = ['faceAndGold', 'goldInnerOnly'];

export interface CanonicalVolumeCheck {
  ok: boolean;
  totalVolume: number;
  expectedMin: number;
  expectedMax: number;
  tolerance: number;
  target: number;
  reason?: string;
}

export function buildCanonicalShardReport(shards: CanonicalShard[]): CanonicalShardReport {
  const byMaterial: Record<CanonicalShard['materialKind'], { count: number; volume: number }> = {
    faceAndGold: { count: 0, volume: 0 },
    goldInnerOnly: { count: 0, volume: 0 },
  };
  let totalVolume = 0;
  let minVolume = Number.POSITIVE_INFINITY;
  let maxVolume = 0;

  shards.forEach((shard) => {
    const v = Math.max(0, shard.approximateVolume);
    totalVolume += v;
    minVolume = Math.min(minVolume, v);
    maxVolume = Math.max(maxVolume, v);
    const bucket = byMaterial[shard.materialKind] ?? { count: 0, volume: 0 };
    bucket.count += 1;
    bucket.volume += v;
    byMaterial[shard.materialKind] = bucket;
  });

  if (shards.length === 0) {
    minVolume = 0;
  }

  const averageVolume = shards.length === 0 ? 0 : totalVolume / shards.length;

  return {
    totalShards: shards.length,
    byMaterial,
    totalVolume,
    minVolume,
    maxVolume,
    averageVolume,
  };
}

export function logCanonicalShardReport(shards: CanonicalShard[]): void {
  const report = buildCanonicalShardReport(shards);
  // eslint-disable-next-line no-console
  console.group('[canonical-shards] report');
  // eslint-disable-next-line no-console
  console.log('total:', report.totalShards);
  // eslint-disable-next-line no-console
  console.log('volume total/min/max/avg:', {
    total: report.totalVolume.toFixed(4),
    min: report.minVolume.toFixed(4),
    max: report.maxVolume.toFixed(4),
    avg: report.averageVolume.toFixed(4),
  });
  const table: Record<string, unknown> = {};
  MATERIALS.forEach((mat) => {
    const entry = report.byMaterial[mat];
    table[mat] = { count: entry?.count ?? 0, volume: (entry?.volume ?? 0).toFixed(4) };
  });
  // eslint-disable-next-line no-console
  console.table(table);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

export function validateCanonicalShardVolume(
  shards: CanonicalShard[],
  targetVolume = 1.0,
  tolerance = 0.15
): CanonicalVolumeCheck {
  const report = buildCanonicalShardReport(shards);
  const expectedMin = targetVolume * (1 - tolerance);
  const expectedMax = targetVolume * (1 + tolerance);
  const ok = report.totalVolume >= expectedMin && report.totalVolume <= expectedMax;
  return {
    ok,
    totalVolume: report.totalVolume,
    expectedMin,
    expectedMax,
    tolerance,
    target: targetVolume,
    reason: ok
      ? undefined
      : `totalVolume ${report.totalVolume.toFixed(4)} outside expected range [${expectedMin.toFixed(
          4
        )}, ${expectedMax.toFixed(4)}]`,
  };
}

export function assertCanonicalShardVolume(
  shards: CanonicalShard[],
  targetVolume = 1.0,
  tolerance = 0.15
): void {
  const res = validateCanonicalShardVolume(shards, targetVolume, tolerance);
  if (!res.ok) {
    throw new Error(res.reason ?? 'canonical shard volume validation failed');
  }
}
