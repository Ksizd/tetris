import * as THREE from 'three';
import type { BoardDimensions } from '../core/types';
import type { BoardRenderConfig } from './boardConfig';
import type { PlatformLayout } from './platformLayout';
import type { DebugTag } from './debug/objectInspectorTypes';
import type { QualityLevel } from './renderConfig';
import { computeFootprintAngleOffsetRad, computeFootprintStepRad } from './footprintAngles';
import { simulateFootprintLavaSparks } from './footprintLavaSparksSim';
import { createFootprintLavaSparksRender, updateFootprintLavaSparksRender } from './footprintLavaSparksRender';
import type { FootprintLavaSparksRender } from './footprintLavaSparksRender';
import { createFootprintLavaSparksEmitterDebugPoints } from './footprintLavaSparksEmitters';

export interface FootprintLavaSparksFxLimits {
  maxParticles: number;
}

export interface FootprintLavaSparksFxParams {
  footprintInlayRef: THREE.Object3D;
  dimensions: BoardDimensions;
  board: BoardRenderConfig;
  platformLayout: PlatformLayout;
  quality?: QualityLevel;
  seed?: number;
  limits?: Partial<FootprintLavaSparksFxLimits>;
}

export interface FootprintLavaSparksFx {
  group: THREE.Group;
  dispose: () => void;
}

const KIND_EMBER = 0;
const KIND_DROPLET = 1;

const EMITTER_RING0 = 0;
const EMITTER_RING1 = 1;
const EMITTER_RADIAL = 2;

const VIOLATION_SPAWN_BELOW_LAVA = 1 << 0;
const VIOLATION_NON_FINITE = 1 << 1;
const VIOLATION_COUNT_EXCEEDED = 1 << 2;

const STEP_ONCE_DT_SEC = 1 / 60;
const SPAWN_Y_EPS_RATIO = 0.001;

export type ParticlePool = {
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
  temp0: Float32Array;
  temp: Float32Array;
  kind: Uint8Array;
  state: Uint8Array;
  splitAtSec: Float32Array;
  spin: Float32Array;
  rand: Float32Array;
  alpha: Float32Array;
  stretch: Float32Array;
  rot: Float32Array;
};

export type FootprintLavaSparksFxInternal = {
  seed: number;
  rand: () => number;
  quality: QualityLevel;
  blockSize: number;
  simTimeSec: number;
  lastDtSec: number;
  frozen: boolean;
  stepOnceRequested: boolean;
  violationMask: number;
  columns: number;
  stepRad: number;
  angleOffsetRad: number;
  ringATopY: number;
  lavaSurfaceY: number;
  liftY: number;
  thetaHalfW: number;
  grooveHalfW: number;
  R0: number;
  R1: number;
  radialMinR: number;
  radialMaxR: number;
  emitterTheta: Float32Array;
  emitterRadius: Float32Array;
  emitterKind: Uint8Array;
  nextBubblePopSec: number;
  nextSpatterBurstSec: number;
  bubbleRate: number;
  spatterRate: number;
  substepsLastFrame: number;
  debugSampleCount: number;
  debugSampleKind: Uint8Array;
  debugSamplePos: Float32Array;
  debugSampleVel: Float32Array;
  debugSampleTemp: Float32Array;
  debugSampleAge: Float32Array;
  render: FootprintLavaSparksRender;
  emitterDebug: THREE.Points | null;
  pool: ParticlePool;
};

type FootprintLavaSparksFxWithInternal = FootprintLavaSparksFx & {
  __internal: FootprintLavaSparksFxInternal;
};

const DEFAULT_SEED = 20250101;

function resolveMaxParticles(quality: QualityLevel): number {
  if (quality === 'low') return 200;
  if (quality === 'medium') return 400;
  return 800;
}

function resolveEventRates(quality: QualityLevel): { bubbleRate: number; spatterRate: number } {
  if (quality === 'low') return { bubbleRate: 1.25, spatterRate: 0.3 };
  if (quality === 'medium') return { bubbleRate: 2.4, spatterRate: 0.5 };
  return { bubbleRate: 4.0, spatterRate: 0.8 };
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function createParticlePool(maxParticles: number): ParticlePool {
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
    temp0: new Float32Array(max),
    temp: new Float32Array(max),
    kind: new Uint8Array(max),
    state: new Uint8Array(max),
    splitAtSec: new Float32Array(max),
    spin: new Float32Array(max),
    rand: new Float32Array(max),
    alpha: new Float32Array(max),
    stretch: new Float32Array(max),
    rot: new Float32Array(max),
  };
}

function expRand(rand: () => number, rate: number): number {
  if (!(rate > 0)) {
    return Number.POSITIVE_INFINITY;
  }
  const u = Math.min(1 - 1e-6, Math.max(1e-6, rand()));
  return -Math.log(1 - u) / rate;
}

function allocateParticle(pool: ParticlePool): number {
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

function freeParticle(pool: ParticlePool, idx: number): void {
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

function scheduleNextBubblePop(internal: FootprintLavaSparksFxInternal, nowSec: number): void {
  internal.nextBubblePopSec = nowSec + expRand(internal.rand, internal.bubbleRate);
}

function scheduleNextSpatterBurst(internal: FootprintLavaSparksFxInternal, nowSec: number): void {
  internal.nextSpatterBurstSec = nowSec + expRand(internal.rand, internal.spatterRate);
}

function computeThetaHalfWidth(columns: number, angularSegments: number): number {
  const dTheta = (Math.PI * 2) / columns;
  const microStep = (Math.PI * 2) / angularSegments;
  const baseThetaW = dTheta * 0.08;
  let steps = Math.max(2, Math.round(baseThetaW / microStep));
  if (steps % 2 === 1) {
    steps += 1;
  }
  return steps * microStep * 0.5;
}

function randRange(rand: () => number, min: number, max: number): number {
  return min + (max - min) * rand();
}

function spawnEmber(internal: FootprintLavaSparksFxInternal, emitterIndex: number, boost: number): void {
  const pool = internal.pool;
  const idx = allocateParticle(pool);
  if (idx < 0) {
    return;
  }

  const emitterKind = internal.emitterKind[emitterIndex];
  const baseTheta = internal.emitterTheta[emitterIndex];
  const baseRadius = internal.emitterRadius[emitterIndex];

  let theta = baseTheta;
  let radius = baseRadius;
  if (emitterKind === EMITTER_RADIAL) {
    theta = baseTheta + (internal.rand() * 2 - 1) * internal.thetaHalfW * 0.85;
    radius = randRange(internal.rand, internal.radialMinR, internal.radialMaxR);
  } else {
    theta = baseTheta + (internal.rand() * 2 - 1) * internal.stepRad * 0.45;
    radius = baseRadius + (internal.rand() * 2 - 1) * internal.grooveHalfW * 0.85;
  }

  const x = Math.cos(theta) * radius;
  const z = Math.sin(theta) * radius;
  let y = internal.lavaSurfaceY + internal.liftY;
  const minY = internal.lavaSurfaceY - internal.blockSize * SPAWN_Y_EPS_RATIO;
  if (y < minY) {
    internal.violationMask |= VIOLATION_SPAWN_BELOW_LAVA;
    y = minY;
  }

  pool.posX[idx] = x;
  pool.posY[idx] = y;
  pool.posZ[idx] = z;

  const invR = 1 / Math.max(1e-6, Math.sqrt(x * x + z * z));
  const rx = x * invR;
  const rz = z * invR;
  const tx = -rz;
  const tz = rx;

  const speed = randRange(internal.rand, 0.2, 1.2) * boost;
  const up = randRange(internal.rand, 0.55, 1.0) * speed;
  const lateral = randRange(internal.rand, 0.08, 0.22) * speed;
  const swirl = (internal.rand() * 2 - 1) * randRange(internal.rand, 0.25, 0.9) * lateral;
  const radial = (internal.rand() * 2 - 1) * randRange(internal.rand, 0.08, 0.35) * lateral;

  pool.velX[idx] = tx * swirl + rx * radial;
  pool.velY[idx] = up;
  pool.velZ[idx] = tz * swirl + rz * radial;

  pool.age[idx] = 0;
  pool.life[idx] = randRange(internal.rand, 0.7, 1.9);
  pool.size[idx] = randRange(internal.rand, 0.65, 1.25);
  pool.temp0[idx] = randRange(internal.rand, 0.85, 1.15);
  pool.temp[idx] = pool.temp0[idx];
  pool.kind[idx] = KIND_EMBER;
  pool.state[idx] = 0;
  pool.splitAtSec[idx] = 0;
  pool.spin[idx] = randRange(internal.rand, -2.0, 2.0);
  pool.rand[idx] = internal.rand();
  pool.alpha[idx] = 1;
  pool.stretch[idx] = 1;
  pool.rot[idx] = 0;
}

function spawnDroplet(internal: FootprintLavaSparksFxInternal, emitterIndex: number, boost: number): void {
  const pool = internal.pool;
  const idx = allocateParticle(pool);
  if (idx < 0) {
    return;
  }

  const emitterKind = internal.emitterKind[emitterIndex];
  const baseTheta = internal.emitterTheta[emitterIndex];
  const baseRadius = internal.emitterRadius[emitterIndex];

  let theta = baseTheta;
  let radius = baseRadius;
  if (emitterKind === EMITTER_RADIAL) {
    theta = baseTheta + (internal.rand() * 2 - 1) * internal.thetaHalfW * 0.55;
    radius = randRange(internal.rand, internal.radialMinR, internal.radialMaxR);
  } else {
    theta = baseTheta + (internal.rand() * 2 - 1) * internal.stepRad * 0.18;
    radius = baseRadius + (internal.rand() * 2 - 1) * internal.grooveHalfW * 0.65;
  }

  const x = Math.cos(theta) * radius;
  const z = Math.sin(theta) * radius;
  let y = internal.lavaSurfaceY + internal.liftY;
  const minY = internal.lavaSurfaceY - internal.blockSize * SPAWN_Y_EPS_RATIO;
  if (y < minY) {
    internal.violationMask |= VIOLATION_SPAWN_BELOW_LAVA;
    y = minY;
  }

  pool.posX[idx] = x;
  pool.posY[idx] = y;
  pool.posZ[idx] = z;

  const invR = 1 / Math.max(1e-6, Math.sqrt(x * x + z * z));
  const rx = x * invR;
  const rz = z * invR;
  const tx = -rz;
  const tz = rx;

  const speed = randRange(internal.rand, 1.0, 4.0) * boost;
  const up = randRange(internal.rand, 0.55, 1.0) * speed;
  const jet = randRange(internal.rand, 0.15, 0.65) * speed;
  const swirl = (internal.rand() * 2 - 1) * randRange(internal.rand, 0.05, 0.22) * speed;

  pool.velX[idx] = rx * jet + tx * swirl;
  pool.velY[idx] = up;
  pool.velZ[idx] = rz * jet + tz * swirl;

  pool.age[idx] = 0;
  pool.life[idx] = randRange(internal.rand, 0.5, 1.25);
  pool.size[idx] = randRange(internal.rand, 1.0, 1.85);
  pool.temp0[idx] = randRange(internal.rand, 1.05, 1.35);
  pool.temp[idx] = pool.temp0[idx];
  pool.kind[idx] = KIND_DROPLET;
  pool.state[idx] = 0;
  pool.splitAtSec[idx] = randRange(internal.rand, 0.15, 0.35);
  pool.spin[idx] = randRange(internal.rand, -5.0, 5.0);
  pool.rand[idx] = internal.rand();
  pool.alpha[idx] = 1;
  pool.stretch[idx] = 1;
  pool.rot[idx] = 0;
}

function spawnBubblePop(internal: FootprintLavaSparksFxInternal): void {
  const columns = internal.columns;
  const baseColumn = Math.floor(internal.rand() * columns);
  const count = 2 + Math.floor(internal.rand() * 5);
  const baseEmitter = baseColumn + columns * (internal.rand() < 0.5 ? 0 : 1);
  for (let i = 0; i < count; i += 1) {
    spawnEmber(internal, baseEmitter, randRange(internal.rand, 0.85, 1.2));
  }
}

function spawnSpatterBurst(internal: FootprintLavaSparksFxInternal): void {
  const columns = internal.columns;
  const baseColumn = Math.floor(internal.rand() * columns);
  const droplets = 6 + Math.floor(internal.rand() * 13);
  const embers = 5 + Math.floor(internal.rand() * 8);
  const baseEmitterRing = baseColumn + columns * (internal.rand() < 0.5 ? 0 : 1);
  const baseEmitterRadial = baseColumn + columns * 2;
  for (let i = 0; i < droplets; i += 1) {
    const useRadial = internal.rand() < 0.55;
    spawnDroplet(internal, useRadial ? baseEmitterRadial : baseEmitterRing, randRange(internal.rand, 0.95, 1.35));
  }
  for (let i = 0; i < embers; i += 1) {
    const useRadial = internal.rand() < 0.35;
    spawnEmber(internal, useRadial ? baseEmitterRadial : baseEmitterRing, randRange(internal.rand, 1.05, 1.45));
  }
}

export function createFootprintLavaSparksFx(params: FootprintLavaSparksFxParams): FootprintLavaSparksFx | null {
  const columns = Math.max(3, Math.floor(params.dimensions.width));
  const quality: QualityLevel = params.quality ?? 'ultra';
  const seed = params.seed ?? DEFAULT_SEED;
  const resolvedMaxParticles = resolveMaxParticles(quality);
  const maxParticles = Math.min(
    Math.max(0, params.limits?.maxParticles ?? resolvedMaxParticles),
    resolvedMaxParticles
  );
  if (maxParticles <= 0) {
    return null;
  }

  const pool = createParticlePool(maxParticles);
  const rand = makeRandom(seed);
  for (let i = 0; i < pool.max; i += 1) {
    pool.rand[i] = rand();
  }
  const stepRad = computeFootprintStepRad(columns);
  const angleOffsetRad = computeFootprintAngleOffsetRad(columns);
  const ringATopY = params.platformLayout.baseY + params.platformLayout.ringA.height;
  const grooveD = Math.min(Math.max(params.board.blockSize * 0.08, params.board.blockSize * 0.04), params.board.blockSize * 0.08);
  const microBevelHeight = grooveD * 0.12;
  const lavaSurfaceY = ringATopY - grooveD + microBevelHeight * 0.95;
  const liftY = params.board.blockSize * 0.01;

  const R0 = params.board.towerRadius - params.board.blockDepth * 0.5;
  const R1 = params.board.towerRadius + params.board.blockDepth * 0.5;
  const grooveW = Math.min(
    Math.max(params.board.blockDepth * 0.08, params.board.blockDepth * 0.06),
    params.board.blockDepth * 0.1
  );
  const grooveHalfW = grooveW * 0.5;
  const radialMinR = R0 - grooveHalfW;
  const radialMaxR = R1 + grooveHalfW;

  const angularSegments = Math.max(96, columns * 12);
  const thetaHalfW = computeThetaHalfWidth(columns, angularSegments);

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

  const { bubbleRate, spatterRate } = resolveEventRates(quality);

  const group = new THREE.Group();
  group.name = 'footprintLavaSparksFx';
  group.userData.debugSelectable = false;
  group.userData.debugTag = {
    kind: 'hallFootprint',
    sourceFile: 'src/render/footprintLavaSparksFx.ts',
    sourceFunction: 'createFootprintLavaSparksFx',
  } satisfies DebugTag;
  group.userData.seed = seed;
  group.userData.quality = quality;
  group.userData.maxParticles = pool.max;
  group.userData.columns = columns;
  group.userData.stepRad = stepRad;
  group.userData.angleOffsetRad = angleOffsetRad;
  group.userData.ringATopY = ringATopY;
  group.userData.lavaSurfaceY = lavaSurfaceY;
  group.userData.bubbleRate = bubbleRate;
  group.userData.spatterRate = spatterRate;
  group.userData.footprintInlayRefName = params.footprintInlayRef.name ?? '(unnamed)';

  const internal: FootprintLavaSparksFxInternal = {
    seed,
    rand,
    quality,
    blockSize: params.board.blockSize,
    simTimeSec: 0,
    lastDtSec: 0,
    frozen: false,
    stepOnceRequested: false,
    violationMask: 0,
    columns,
    stepRad,
    angleOffsetRad,
    ringATopY,
    lavaSurfaceY,
    liftY,
    thetaHalfW,
    grooveHalfW,
    R0,
    R1,
    radialMinR,
    radialMaxR,
    emitterTheta,
    emitterRadius,
    emitterKind,
    nextBubblePopSec: 0,
    nextSpatterBurstSec: 0,
    bubbleRate,
    spatterRate,
    substepsLastFrame: 1,
    debugSampleCount: 0,
    debugSampleKind: new Uint8Array(10),
    debugSamplePos: new Float32Array(10 * 3),
    debugSampleVel: new Float32Array(10 * 3),
    debugSampleTemp: new Float32Array(10),
    debugSampleAge: new Float32Array(10),
    render: null as unknown as FootprintLavaSparksRender,
    emitterDebug: null,
    pool,
  };
  group.userData.debugSampleKind = internal.debugSampleKind;
  group.userData.debugSamplePos = internal.debugSamplePos;
  group.userData.debugSampleVel = internal.debugSampleVel;
  group.userData.debugSampleTemp = internal.debugSampleTemp;
  group.userData.debugSampleAge = internal.debugSampleAge;
  scheduleNextBubblePop(internal, 0);
  scheduleNextSpatterBurst(internal, 0);

  internal.render = createFootprintLavaSparksRender(internal);
  group.add(internal.render.mesh);
  internal.emitterDebug = createFootprintLavaSparksEmitterDebugPoints({
    columns: internal.columns,
    emitterTheta: internal.emitterTheta,
    emitterRadius: internal.emitterRadius,
    emitterKind: internal.emitterKind,
    anchorY: internal.lavaSurfaceY + internal.liftY + internal.blockSize * 0.06,
    blockSize: internal.blockSize,
  });
  group.add(internal.emitterDebug);

  const dispose = () => {
    internal.render.dispose();
    if (internal.emitterDebug) {
      const geometry = internal.emitterDebug.geometry as THREE.BufferGeometry;
      const material = internal.emitterDebug.material as THREE.Material;
      geometry.dispose();
      material.dispose();
    }
  };

  const fx: FootprintLavaSparksFxWithInternal = {
    group,
    dispose,
    __internal: internal,
  };

  return fx;
}

export function updateFootprintLavaSparksFx(
  fx: FootprintLavaSparksFx,
  dtSec: number,
  timeSec: number,
  camera: THREE.Camera
): void {
  const internal = (fx as FootprintLavaSparksFxWithInternal).__internal;
  if (!internal) {
    return;
  }
  if (!Number.isFinite(dtSec) || !Number.isFinite(timeSec)) {
    return;
  }
  if (dtSec < 0) {
    return;
  }
  void camera;

  let dtUsed = dtSec;
  if (internal.frozen) {
    dtUsed = 0;
  }
  if (internal.stepOnceRequested) {
    internal.stepOnceRequested = false;
    dtUsed = STEP_ONCE_DT_SEC;
  }
  internal.lastDtSec = dtUsed;

  if (!(dtUsed > 0)) {
    fx.group.userData.activeCount = internal.pool.activeCount;
    fx.group.userData.freeCount = internal.pool.freeCount;
    fx.group.userData.lastDtSec = 0;
    fx.group.userData.simTimeSec = internal.simTimeSec;
    fx.group.userData.substepsLastFrame = internal.substepsLastFrame;
    fx.group.userData.violationMask = internal.violationMask;
    fx.group.userData.frozen = internal.frozen;
    fx.group.userData.emittersVisible = internal.emitterDebug?.visible ?? false;
    return;
  }

  internal.violationMask = 0;
  internal.simTimeSec += dtUsed;
  const simTimeSec = internal.simTimeSec;

  let guard = 0;
  while (internal.nextBubblePopSec <= simTimeSec && guard < 64) {
    spawnBubblePop(internal);
    scheduleNextBubblePop(internal, internal.nextBubblePopSec);
    guard += 1;
  }

  while (internal.nextSpatterBurstSec <= simTimeSec && guard < 64) {
    spawnSpatterBurst(internal);
    scheduleNextSpatterBurst(internal, internal.nextSpatterBurstSec);
    guard += 1;
  }

  const pool = internal.pool;
  simulateFootprintLavaSparks(internal, dtUsed, simTimeSec, allocateParticle, freeParticle);

  let i = 0;
  while (i < pool.activeCount) {
    const idx = pool.activeIndices[i];
    const ok =
      Number.isFinite(pool.posX[idx]) &&
      Number.isFinite(pool.posY[idx]) &&
      Number.isFinite(pool.posZ[idx]) &&
      Number.isFinite(pool.velX[idx]) &&
      Number.isFinite(pool.velY[idx]) &&
      Number.isFinite(pool.velZ[idx]);
    if (!ok) {
      internal.violationMask |= VIOLATION_NON_FINITE;
      freeParticle(pool, idx);
      continue;
    }
    i += 1;
  }

  if (pool.activeCount > pool.max) {
    internal.violationMask |= VIOLATION_COUNT_EXCEEDED;
  }

  updateFootprintLavaSparksRender(internal.render, internal, simTimeSec);

  let embers = 0;
  let droplets = 0;
  for (let i = 0; i < pool.activeCount; i += 1) {
    const idx = pool.activeIndices[i];
    if (pool.kind[idx] === KIND_DROPLET) droplets += 1;
    else embers += 1;
  }

  fx.group.userData.activeCount = pool.activeCount;
  fx.group.userData.activeEmbers = embers;
  fx.group.userData.activeDroplets = droplets;
  fx.group.userData.freeCount = pool.freeCount;
  fx.group.userData.lastDtSec = dtUsed;
  fx.group.userData.simTimeSec = simTimeSec;
  fx.group.userData.substepsLastFrame = internal.substepsLastFrame;
  fx.group.userData.debugSampleCount = internal.debugSampleCount;
  fx.group.userData.nextBubblePopSec = internal.nextBubblePopSec;
  fx.group.userData.nextSpatterBurstSec = internal.nextSpatterBurstSec;
  fx.group.userData.timeSec = simTimeSec;
  fx.group.userData.violationMask = internal.violationMask;
  fx.group.userData.frozen = internal.frozen;
  fx.group.userData.emittersVisible = internal.emitterDebug?.visible ?? false;
}
