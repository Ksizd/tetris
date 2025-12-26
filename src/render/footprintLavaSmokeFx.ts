import * as THREE from 'three';
import type { BoardDimensions } from '../core/types';
import type { BoardRenderConfig } from './boardConfig';
import type { PlatformLayout } from './platformLayout';
import type { DebugTag } from './debug/objectInspectorTypes';
import type { QualityLevel } from './renderConfig';
import { computeFootprintAngleOffsetRad, computeFootprintStepRad } from './footprintAngles';
import { simulateFootprintLavaSmoke } from './footprintLavaSmokeSim';
import {
  createFootprintLavaSmokeRender,
  updateFootprintLavaSmokeRender,
  type FootprintLavaSmokeRender,
} from './footprintLavaSmokeRender';

export interface FootprintLavaSmokeFxParams {
  footprintInlayRef: THREE.Object3D;
  dimensions: BoardDimensions;
  board: BoardRenderConfig;
  platformLayout: PlatformLayout;
  quality?: QualityLevel;
  seed?: number;
}

export interface FootprintLavaSmokeFx {
  group: THREE.Group;
  dispose: () => void;
}

export type SmokeParticlePool = {
  max: number;
  activeCount: number;
  activeIndices: Int32Array;
  activePos: Int32Array;
  freeList: Int32Array;
  freeCount: number;
  posX: Float32Array;
  posY: Float32Array;
  posZ: Float32Array;
  velX: Float32Array;
  velY: Float32Array;
  velZ: Float32Array;
  age: Float32Array;
  life: Float32Array;
  size: Float32Array;
  baseSize: Float32Array;
  baseStretch: Float32Array;
  alpha: Float32Array;
  glow: Float32Array;
  heat: Float32Array;
  rot: Float32Array;
  stretch: Float32Array;
  kind: Uint8Array;
  rand: Float32Array;
};

type SmokePerfFrame = {
  spawnMs: number;
  simMs: number;
  sortMs: number;
  fillMs: number;
  uploadMs: number;
  totalMs: number;
};

type SmokePerfAverages = {
  spawnMsAvg: number;
  simMsAvg: number;
  sortMsAvg: number;
  fillMsAvg: number;
  uploadMsAvg: number;
  totalMsAvg: number;
};

export type FootprintLavaSmokeFxInternal = {
  seed: number;
  rand: () => number;
  quality: QualityLevel;
  blockSize: number;
  blockDepth: number;
  simTimeSec: number;
  lastDtSec: number;
  substepsLastFrame: number;
  columns: number;
  stepRad: number;
  angleOffsetRad: number;
  towerRadius: number;
  ringATopY: number;
  lavaSurfaceY: number;
  liftY: number;
  emitY: number;
  thetaHalfW: number;
  grooveHalfW: number;
  R0: number;
  R1: number;
  radialMinR: number;
  radialMaxR: number;
  emitterTheta: Float32Array;
  emitterRadius: Float32Array;
  emitterKind: Uint8Array;
  spawnCursor: number;
  spawnRate: number;
  spawnCarry: number;
  nextPlumeSec: number;
  plumeRate: number;
  tuning: {
    spawnRateScale: number;
    lifeScale: number;
    baseSizeScale: number;
    heatHeightScale: number;
    lowBoostScale: number;
  };
  pool: SmokeParticlePool;
  render: FootprintLavaSmokeRender;
  perfFrame: SmokePerfFrame;
};

type FootprintLavaSmokeFxWithInternal = FootprintLavaSmokeFx & {
  __internal: FootprintLavaSmokeFxInternal;
};

const DEFAULT_SEED = 20250205;
const MIN_COLUMNS = 3;
const MIN_ANGULAR_SEGMENTS = 96;
const ANGULAR_MULTIPLIER = 12;
const KIND_BASE = 0;
const KIND_PLUME = 1;
const EMITTER_RING0 = 0;
const EMITTER_RING1 = 1;
const EMITTER_RADIAL = 2;
const TWO_PI = Math.PI * 2;
const BASE_LIFE_SEC = 3.6;
const PERF_EMA_ALPHA = 0.12;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function updateEma(prev: number, next: number, alpha: number): number {
  if (!(prev > 0)) {
    return next;
  }
  return prev + (next - prev) * alpha;
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function computeThetaHalfWidth(columns: number, angularSegments: number): number {
  const dTheta = TWO_PI / columns;
  const microStep = TWO_PI / angularSegments;
  const baseThetaW = dTheta * 0.08;
  let steps = Math.max(2, Math.round(baseThetaW / microStep));
  if (steps % 2 === 1) {
    steps += 1;
  }
  return steps * microStep * 0.5;
}

function resolveMaxParticles(quality: QualityLevel): number {
  if (quality === 'low') return 900;
  if (quality === 'medium') return 1600;
  if (quality === 'ultra2') return 3400;
  return 2600;
}

function resolveSpawnRate(quality: QualityLevel): number {
  return resolveMaxParticles(quality) / BASE_LIFE_SEC;
}

function resolvePlumeRate(quality: QualityLevel): number {
  return 0;
}

function expRand(rand: () => number, rate: number): number {
  if (!(rate > 0)) {
    return Number.POSITIVE_INFINITY;
  }
  const u = Math.min(1 - 1e-6, Math.max(1e-6, rand()));
  return -Math.log(1 - u) / rate;
}

function createSmokeParticlePool(maxParticles: number): SmokeParticlePool {
  const max = Math.max(0, Math.floor(maxParticles));
  const activeIndices = new Int32Array(max);
  const activePos = new Int32Array(max);
  const freeList = new Int32Array(max);
  for (let i = 0; i < max; i += 1) {
    activePos[i] = -1;
    freeList[i] = i;
  }

  return {
    max,
    activeCount: 0,
    activeIndices,
    activePos,
    freeList,
    freeCount: max,
    posX: new Float32Array(max),
    posY: new Float32Array(max),
    posZ: new Float32Array(max),
    velX: new Float32Array(max),
    velY: new Float32Array(max),
    velZ: new Float32Array(max),
    age: new Float32Array(max),
    life: new Float32Array(max),
    size: new Float32Array(max),
    baseSize: new Float32Array(max),
    baseStretch: new Float32Array(max),
    alpha: new Float32Array(max),
    glow: new Float32Array(max),
    heat: new Float32Array(max),
    rot: new Float32Array(max),
    stretch: new Float32Array(max),
    kind: new Uint8Array(max),
    rand: new Float32Array(max),
  };
}

function allocateParticle(pool: SmokeParticlePool): number {
  if (pool.freeCount <= 0) {
    return -1;
  }
  pool.freeCount -= 1;
  const idx = pool.freeList[pool.freeCount];
  pool.activePos[idx] = pool.activeCount;
  pool.activeIndices[pool.activeCount] = idx;
  pool.activeCount += 1;
  return idx;
}

function freeParticle(pool: SmokeParticlePool, idx: number): void {
  const posInActive = pool.activePos[idx];
  if (posInActive < 0) {
    return;
  }
  const lastIdx = pool.activeIndices[pool.activeCount - 1];
  pool.activeIndices[posInActive] = lastIdx;
  pool.activePos[lastIdx] = posInActive;
  pool.activeCount -= 1;
  pool.activePos[idx] = -1;
  pool.freeList[pool.freeCount] = idx;
  pool.freeCount += 1;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randRange(rand: () => number, min: number, max: number): number {
  return min + (max - min) * rand();
}

function randRangeInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function scheduleNextPlume(internal: FootprintLavaSmokeFxInternal, nowSec: number): void {
  internal.nextPlumeSec = Number.POSITIVE_INFINITY;
}

function chooseEmitterKind(rand: () => number, kind: number): number {
  void rand;
  void kind;
  return EMITTER_RING0;
}

function computeEmitterIndex(
  internal: FootprintLavaSmokeFxInternal,
  columnIndex: number,
  emitterKind: number
): number {
  return columnIndex + internal.columns * emitterKind;
}

function spawnSmokeParticle(
  internal: FootprintLavaSmokeFxInternal,
  columnIndex: number,
  kind: number,
  ringJitterScale: number
): void {
  const pool = internal.pool;
  const idx = allocateParticle(pool);
  if (idx < 0) {
    return;
  }

  const emitterKind = chooseEmitterKind(internal.rand, kind);
  const emitterIndex = computeEmitterIndex(internal, columnIndex, emitterKind);
  const baseTheta = internal.emitterTheta[emitterIndex];
  const baseRadius = internal.emitterRadius[emitterIndex];

  let theta = baseTheta;
  let radius = baseRadius;
  if (emitterKind === EMITTER_RADIAL) {
    theta = baseTheta + (internal.rand() * 2 - 1) * internal.thetaHalfW * 0.85;
    radius = lerp(internal.radialMinR, internal.radialMaxR, internal.rand());
  } else {
    const grooveJitter = internal.grooveHalfW * 0.75;
    theta = baseTheta + (internal.rand() * 2 - 1) * ringJitterScale;
    radius = baseRadius + (internal.rand() * 2 - 1) * grooveJitter;
  }

  const rx = Math.cos(theta);
  const rz = Math.sin(theta);
  const tx = -rz;
  const tz = rx;

  const isPlume = kind === KIND_PLUME;
  const life = isPlume
    ? randRange(internal.rand, 3.6, 5.4)
    : randRange(internal.rand, 2.8, 4.6);
  const baseSize = isPlume
    ? randRange(internal.rand, internal.blockSize * 0.85, internal.blockSize * 1.45)
    : randRange(internal.rand, internal.blockSize * 0.38, internal.blockSize * 0.8);
  const vy0 = isPlume
    ? randRange(internal.rand, 0.55, 1.0)
    : randRange(internal.rand, 0.26, 0.58);
  const tangentSpeed = isPlume
    ? randRange(internal.rand, 0.06, 0.14)
    : randRange(internal.rand, 0.05, 0.11);
  const radialIn = isPlume
    ? randRange(internal.rand, 0.03, 0.08)
    : randRange(internal.rand, 0.03, 0.08);
  const stretch0 = isPlume
    ? randRange(internal.rand, 1.15, 1.55)
    : randRange(internal.rand, 1.1, 1.45);
  const rot = internal.rand() * TWO_PI;

  const x = rx * radius;
  const z = rz * radius;
  const y = internal.emitY + internal.rand() * internal.blockSize * 0.02;

  const vx = tx * tangentSpeed - rx * radialIn;
  const vy = vy0;
  const vz = tz * tangentSpeed - rz * radialIn;

  pool.posX[idx] = x;
  pool.posY[idx] = y;
  pool.posZ[idx] = z;
  pool.velX[idx] = vx;
  pool.velY[idx] = vy;
  pool.velZ[idx] = vz;
  pool.age[idx] = 0;
  pool.life[idx] = life * internal.tuning.lifeScale;
  pool.size[idx] = baseSize * internal.tuning.baseSizeScale;
  pool.baseSize[idx] = baseSize * internal.tuning.baseSizeScale;
  pool.alpha[idx] = 1;
  pool.glow[idx] = 1;
  pool.heat[idx] = 1;
  pool.rot[idx] = rot;
  pool.stretch[idx] = stretch0;
  pool.baseStretch[idx] = stretch0;
  pool.kind[idx] = kind;
  pool.rand[idx] = internal.rand();
}

function spawnBaseSmoke(internal: FootprintLavaSmokeFxInternal): void {
  const col = internal.spawnCursor % internal.columns;
  internal.spawnCursor += 1;
  spawnSmokeParticle(internal, col, KIND_BASE, internal.stepRad * 0.22);
}

function spawnPlumeBurst(internal: FootprintLavaSmokeFxInternal): void {
  void internal;
}

export function createFootprintLavaSmokeFx(params: FootprintLavaSmokeFxParams): FootprintLavaSmokeFx {
  const columns = Math.max(MIN_COLUMNS, Math.floor(params.dimensions.width));
  const seed = params.seed ?? DEFAULT_SEED;
  const rand = makeRandom(seed);
  const quality = params.quality ?? 'ultra';

  const stepRad = computeFootprintStepRad(columns);
  const angleOffsetRad = computeFootprintAngleOffsetRad(columns);

  const towerRadius = params.board.towerRadius;
  const blockDepth = params.board.blockDepth;
  const blockSize = params.board.blockSize;

  const R0 = towerRadius - blockDepth * 0.5;
  const R1 = towerRadius + blockDepth * 0.5;

  const grooveW = clamp(blockDepth * 0.08, blockDepth * 0.06, blockDepth * 0.1);
  const grooveHalfW = grooveW * 0.5;
  const grooveD = clamp(blockSize * 0.08, blockSize * 0.04, blockSize * 0.08);
  const microBevelHeight = grooveD * 0.12;

  const ringATopY = params.platformLayout.baseY + params.platformLayout.ringA.height;
  const lavaSurfaceY = ringATopY - grooveD + microBevelHeight * 0.95;
  const liftY = blockSize * 0.01;
  const emitY = lavaSurfaceY + liftY + blockSize * 0.004;

  const radialMinR = R0 - grooveHalfW;
  const radialMaxR = R1 + grooveHalfW;

  const angularSegments = Math.max(MIN_ANGULAR_SEGMENTS, columns * ANGULAR_MULTIPLIER);
  const thetaHalfW = computeThetaHalfWidth(columns, angularSegments);

  const pool = createSmokeParticlePool(resolveMaxParticles(quality));

  const emitterTheta = new Float32Array(columns * 3);
  const emitterRadius = new Float32Array(columns * 3);
  const emitterKind = new Uint8Array(columns * 3);
  for (let col = 0; col < columns; col += 1) {
    const boundaryTheta = col * stepRad + angleOffsetRad;
    const centerTheta = boundaryTheta + stepRad * 0.5;
    emitterTheta[col + columns * 0] = centerTheta;
    emitterRadius[col + columns * 0] = R0;
    emitterKind[col + columns * 0] = EMITTER_RING0;
    emitterTheta[col + columns * 1] = centerTheta;
    emitterRadius[col + columns * 1] = R1;
    emitterKind[col + columns * 1] = EMITTER_RING1;
    emitterTheta[col + columns * 2] = boundaryTheta;
    emitterRadius[col + columns * 2] = (radialMinR + radialMaxR) * 0.5;
    emitterKind[col + columns * 2] = EMITTER_RADIAL;
  }

  const plumeRate = resolvePlumeRate(quality);
  const spawnRate = resolveSpawnRate(quality);
  const tuning = {
    spawnRateScale: 0.75,
    lifeScale: 1,
    baseSizeScale: 1,
    heatHeightScale: 1.05,
    lowBoostScale: 0.85,
  };

  const group = new THREE.Group();
  group.name = 'footprintLavaSmokeFx';
  group.userData.debugSelectable = false;
  group.userData.debugTag = {
    kind: 'hallFootprint',
    sourceFile: 'src/render/footprintLavaSmokeFx.ts',
    sourceFunction: 'createFootprintLavaSmokeFx',
  } satisfies DebugTag;
  group.userData.seed = seed;
  group.userData.quality = quality;
  group.userData.maxParticles = pool.max;
  group.userData.columns = columns;
  group.userData.stepRad = stepRad;
  group.userData.angleOffsetRad = angleOffsetRad;
  group.userData.ringATopY = ringATopY;
  group.userData.lavaSurfaceY = lavaSurfaceY;
  group.userData.emitY = emitY;
  group.userData.spawnRate = spawnRate;
  group.userData.plumeRate = plumeRate;
  group.userData.tuning = tuning;
  group.userData.perf = {
    spawnMsAvg: 0,
    simMsAvg: 0,
    sortMsAvg: 0,
    fillMsAvg: 0,
    uploadMsAvg: 0,
    totalMsAvg: 0,
  } satisfies SmokePerfAverages;
  group.userData.footprintInlayRefName = params.footprintInlayRef.name ?? '(unnamed)';

  const internal: FootprintLavaSmokeFxInternal = {
    seed,
    rand,
    quality,
    blockSize,
    blockDepth,
    simTimeSec: 0,
    lastDtSec: 0,
    substepsLastFrame: 1,
    columns,
    stepRad,
    angleOffsetRad,
    towerRadius,
    ringATopY,
    lavaSurfaceY,
    liftY,
    emitY,
    thetaHalfW,
    grooveHalfW,
    R0,
    R1,
    radialMinR,
    radialMaxR,
    emitterTheta,
    emitterRadius,
    emitterKind,
    spawnCursor: 0,
    spawnRate,
    spawnCarry: 0,
    nextPlumeSec: 0,
    plumeRate,
    tuning,
    pool,
    render: null as unknown as FootprintLavaSmokeRender,
    perfFrame: {
      spawnMs: 0,
      simMs: 0,
      sortMs: 0,
      fillMs: 0,
      uploadMs: 0,
      totalMs: 0,
    },
  };

  scheduleNextPlume(internal, 0);

  internal.render = createFootprintLavaSmokeRender(internal);
  group.add(internal.render.group);

  const dispose = () => {
    internal.render.dispose();
  };

  const fx: FootprintLavaSmokeFxWithInternal = {
    group,
    dispose,
    __internal: internal,
  };

  return fx;
}

export function updateFootprintLavaSmokeFx(
  fx: FootprintLavaSmokeFx,
  dtSec: number,
  timeSec: number,
  camera: THREE.Camera
): void {
  const internal = (fx as FootprintLavaSmokeFxWithInternal).__internal;
  if (!internal) {
    return;
  }
  if (!Number.isFinite(dtSec) || !Number.isFinite(timeSec) || dtSec < 0) {
    return;
  }

  internal.lastDtSec = dtSec;
  if (!(dtSec > 0)) {
    fx.group.userData.activeCount = internal.pool.activeCount;
    fx.group.userData.freeCount = internal.pool.freeCount;
    fx.group.userData.lastDtSec = 0;
    fx.group.userData.simTimeSec = internal.simTimeSec;
    fx.group.userData.spawnCarry = internal.spawnCarry;
    fx.group.userData.spawnRate = internal.spawnRate;
    fx.group.userData.nextPlumeSec = internal.nextPlumeSec;
    return;
  }

  const perfFrame = internal.perfFrame;
  const frameStartMs = nowMs();

  internal.simTimeSec += dtSec;
  const simTimeSec = internal.simTimeSec;
  const spawnRateScaled = internal.spawnRate * internal.tuning.spawnRateScale;
  internal.spawnCarry += dtSec * spawnRateScaled;
  internal.spawnCarry = Math.min(internal.spawnCarry, internal.pool.max * 2);

  const spawnStartMs = nowMs();
  const spawnCount = Math.min(
    Math.floor(internal.spawnCarry),
    internal.pool.freeCount
  );
  for (let i = 0; i < spawnCount; i += 1) {
    spawnBaseSmoke(internal);
  }
  internal.spawnCarry -= spawnCount;
  perfFrame.spawnMs = nowMs() - spawnStartMs;

  let guard = 0;
  while (internal.nextPlumeSec <= simTimeSec && guard < 1) {
    scheduleNextPlume(internal, internal.nextPlumeSec);
    guard += 1;
  }

  const simStartMs = nowMs();
  simulateFootprintLavaSmoke(internal, dtSec, simTimeSec);
  perfFrame.simMs = nowMs() - simStartMs;

  updateFootprintLavaSmokeRender(internal.render, internal, simTimeSec, camera, perfFrame);
  const renderEndMs = nowMs();
  perfFrame.totalMs = renderEndMs - frameStartMs;

  const perfAvg = fx.group.userData.perf as SmokePerfAverages | undefined;
  if (perfAvg) {
    perfAvg.spawnMsAvg = updateEma(perfAvg.spawnMsAvg, perfFrame.spawnMs, PERF_EMA_ALPHA);
    perfAvg.simMsAvg = updateEma(perfAvg.simMsAvg, perfFrame.simMs, PERF_EMA_ALPHA);
    perfAvg.sortMsAvg = updateEma(perfAvg.sortMsAvg, perfFrame.sortMs, PERF_EMA_ALPHA);
    perfAvg.fillMsAvg = updateEma(perfAvg.fillMsAvg, perfFrame.fillMs, PERF_EMA_ALPHA);
    perfAvg.uploadMsAvg = updateEma(perfAvg.uploadMsAvg, perfFrame.uploadMs, PERF_EMA_ALPHA);
    perfAvg.totalMsAvg = updateEma(perfAvg.totalMsAvg, perfFrame.totalMs, PERF_EMA_ALPHA);
  }

  fx.group.userData.activeCount = internal.pool.activeCount;
  fx.group.userData.freeCount = internal.pool.freeCount;
  fx.group.userData.lastDtSec = dtSec;
  fx.group.userData.simTimeSec = simTimeSec;
  fx.group.userData.spawnCarry = internal.spawnCarry;
  fx.group.userData.spawnRate = spawnRateScaled;
  fx.group.userData.nextPlumeSec = internal.nextPlumeSec;
  fx.group.userData.timeSec = timeSec;
}
