import type { QualityLevel } from './renderConfig';
import type { FootprintLavaSparksFx, FootprintLavaSparksFxInternal } from './footprintLavaSparksFx';

export interface FootprintLavaSparksReport {
  seed: number;
  quality: QualityLevel;
  simTimeSec: number;
  dtSec: number;
  substeps: number;
  maxParticles: number;
  counts: { total: number; embers: number; droplets: number };
  next: { bubblePopSec: number; spatterBurstSec: number };
  frozen: boolean;
  emittersVisible: boolean;
  violations: string[];
  sample: Array<{
    kind: 'ember' | 'droplet';
    pos: [number, number, number];
    vel: [number, number, number];
    temp: number;
    age: number;
  }>;
}

const KIND_DROPLET = 1;

const VIOLATION_SPAWN_BELOW_LAVA = 1 << 0;
const VIOLATION_NON_FINITE = 1 << 1;
const VIOLATION_COUNT_EXCEEDED = 1 << 2;

type FootprintLavaSparksFxWithInternal = FootprintLavaSparksFx & { __internal?: FootprintLavaSparksFxInternal };

function getInternal(fx: FootprintLavaSparksFx): FootprintLavaSparksFxInternal | null {
  return (fx as FootprintLavaSparksFxWithInternal).__internal ?? null;
}

export function setFootprintLavaSparksFrozen(fx: FootprintLavaSparksFx, frozen: boolean): void {
  const internal = getInternal(fx);
  if (!internal) {
    return;
  }
  internal.frozen = frozen;
  fx.group.userData.frozen = frozen;
}

export function requestFootprintLavaSparksStepOnce(fx: FootprintLavaSparksFx): void {
  const internal = getInternal(fx);
  if (!internal) {
    return;
  }
  internal.stepOnceRequested = true;
}

export function setFootprintLavaSparksEmittersVisible(fx: FootprintLavaSparksFx, visible: boolean): void {
  const internal = getInternal(fx);
  if (!internal) {
    return;
  }
  if (internal.emitterDebug) {
    internal.emitterDebug.visible = visible;
    fx.group.userData.emittersVisible = visible;
  }
}

export function buildFootprintLavaSparksReport(fx: FootprintLavaSparksFx): FootprintLavaSparksReport | null {
  const internal = getInternal(fx);
  if (!internal) {
    return null;
  }
  const pool = internal.pool;
  let embers = 0;
  let droplets = 0;
  for (let i = 0; i < pool.activeCount; i += 1) {
    const idx = pool.activeIndices[i];
    if (pool.kind[idx] === KIND_DROPLET) droplets += 1;
    else embers += 1;
  }

  const violations: string[] = [];
  if (internal.violationMask & VIOLATION_SPAWN_BELOW_LAVA) {
    violations.push('SPAWN_BELOW_LAVA_SURFACE');
  }
  if (internal.violationMask & VIOLATION_NON_FINITE) {
    violations.push('NON_FINITE_STATE');
  }
  if (internal.violationMask & VIOLATION_COUNT_EXCEEDED) {
    violations.push('ACTIVE_COUNT_EXCEEDED_MAX');
  }

  const sample: FootprintLavaSparksReport['sample'] = [];
  const count = Math.min(internal.debugSampleCount, 10);
  for (let i = 0; i < count; i += 1) {
    const kind = internal.debugSampleKind[i] === KIND_DROPLET ? 'droplet' : 'ember';
    sample.push({
      kind,
      pos: [
        internal.debugSamplePos[i * 3 + 0],
        internal.debugSamplePos[i * 3 + 1],
        internal.debugSamplePos[i * 3 + 2],
      ],
      vel: [
        internal.debugSampleVel[i * 3 + 0],
        internal.debugSampleVel[i * 3 + 1],
        internal.debugSampleVel[i * 3 + 2],
      ],
      temp: internal.debugSampleTemp[i],
      age: internal.debugSampleAge[i],
    });
  }

  return {
    seed: internal.seed,
    quality: internal.quality,
    simTimeSec: internal.simTimeSec,
    dtSec: internal.lastDtSec,
    substeps: internal.substepsLastFrame,
    maxParticles: pool.max,
    counts: { total: pool.activeCount, embers, droplets },
    next: { bubblePopSec: internal.nextBubblePopSec, spatterBurstSec: internal.nextSpatterBurstSec },
    frozen: internal.frozen,
    emittersVisible: internal.emitterDebug?.visible ?? false,
    violations,
    sample,
  };
}

