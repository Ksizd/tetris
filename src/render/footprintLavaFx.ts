import * as THREE from 'three';
import type { BoardDimensions } from '../core/types';
import type { BoardRenderConfig } from './boardConfig';
import type { PlatformLayout } from './platformLayout';
import type { DebugTag } from './debug/objectInspectorTypes';

export interface FootprintLavaFxParams {
  dimensions: BoardDimensions;
  board: BoardRenderConfig;
  platformLayout: PlatformLayout;
  seed?: number;
  maxCount?: number;
  includeSteam?: boolean;
}

export interface FootprintLavaFx {
  group: THREE.Group;
  update: (timeSeconds: number) => void;
  dispose: () => void;
}

interface SparkState {
  kind: 'ring0' | 'ring1' | 'radial';
  baseTheta: number;
  baseRadius: number;
  baseY: number;
  phase: number;
  riseSpeed: number;
  riseHeight: number;
  driftSpeed: number;
  driftAmplitude: number;
  size: number;
  yaw: number;
  tilt: number;
}

const TWO_PI = Math.PI * 2;
const DEFAULT_SEED = 20241215;
const MIN_COLUMNS = 3;
const MIN_ANGULAR_SEGMENTS = 96;
const ANGULAR_MULTIPLIER = 12;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function computeThetaHalfWidth(columns: number): number {
  const angularSegments = Math.max(MIN_ANGULAR_SEGMENTS, columns * ANGULAR_MULTIPLIER);
  const dTheta = TWO_PI / columns;
  const microStep = TWO_PI / angularSegments;
  const baseThetaW = dTheta * 0.08;
  let steps = Math.max(2, Math.round(baseThetaW / microStep));
  if (steps % 2 === 1) {
    steps += 1;
  }
  return (steps * microStep) * 0.5;
}

export function createFootprintLavaFx(params: FootprintLavaFxParams): FootprintLavaFx | null {
  const columns = Math.max(MIN_COLUMNS, Math.floor(params.dimensions.width));
  const maxCount = Math.max(0, Math.floor(params.maxCount ?? 64));
  const count = Math.min(columns * 2, maxCount);
  if (count <= 0) {
    return null;
  }

  const rand = makeRandom(params.seed ?? DEFAULT_SEED);
  const { board, platformLayout: layout } = params;

  const towerRadius = board.towerRadius;
  const blockDepth = board.blockDepth;
  const blockSize = board.blockSize;

  const R0 = towerRadius - blockDepth * 0.5;
  const R1 = towerRadius + blockDepth * 0.5;

  const grooveW = clamp(blockDepth * 0.08, blockDepth * 0.06, blockDepth * 0.1);
  const grooveHalfW = grooveW * 0.5;
  const grooveD = clamp(blockSize * 0.08, blockSize * 0.04, blockSize * 0.08);
  const microBevelHeight = grooveD * 0.12;

  const thetaHalfW = computeThetaHalfWidth(columns);
  const dTheta = TWO_PI / columns;

  const radialGrooveMinR = R0 - grooveHalfW;
  const radialGrooveMaxR = R1 + grooveHalfW;

  const ringATopY = layout.baseY + layout.ringA.height;
  const lavaSurfaceY = ringATopY - grooveD + microBevelHeight * 0.95;

  const group = new THREE.Group();
  group.name = 'footprintLavaFx';
  group.userData.debugSelectable = false;
  group.userData.debugTag = {
    kind: 'hallFootprint',
    sourceFile: 'src/render/footprintLavaFx.ts',
    sourceFunction: 'createFootprintLavaFx',
  } satisfies DebugTag;

  const sparks = createSparkInstancedMesh({
    count,
    rand,
    columns,
    dTheta,
    thetaHalfW,
    R0,
    R1,
    grooveHalfW,
    radialGrooveMinR,
    radialGrooveMaxR,
    lavaSurfaceY,
    blockSize,
  });
  group.add(sparks.mesh);

  const steam = params.includeSteam
    ? createSteamRings({
        rand,
        yTop: ringATopY,
        innerR: radialGrooveMinR,
        outerR: radialGrooveMaxR,
        blockSize,
        columns,
      })
    : null;
  if (steam) {
    group.add(steam.group);
  }

  const update = (timeSeconds: number) => {
    sparks.update(timeSeconds);
    steam?.update(timeSeconds);
  };

  const dispose = () => {
    sparks.dispose();
    steam?.dispose();
  };

  return { group, update, dispose };
}

function createSparkInstancedMesh(params: {
  count: number;
  rand: () => number;
  columns: number;
  dTheta: number;
  thetaHalfW: number;
  R0: number;
  R1: number;
  grooveHalfW: number;
  radialGrooveMinR: number;
  radialGrooveMaxR: number;
  lavaSurfaceY: number;
  blockSize: number;
}): {
  mesh: THREE.InstancedMesh;
  update: (timeSeconds: number) => void;
  dispose: () => void;
} {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffc6ef,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, params.count);
  mesh.name = 'footprintLavaSparks';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.debugSelectable = false;
  mesh.userData.debugTag = {
    kind: 'hallFootprint',
    sourceFile: 'src/render/footprintLavaFx.ts',
    sourceFunction: 'createSparkInstancedMesh',
  } satisfies DebugTag;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const states: SparkState[] = [];
  const baseY = params.lavaSurfaceY + params.blockSize * 0.01;

  for (let i = 0; i < params.count; i += 1) {
    const kindRoll = params.rand();
    const kind: SparkState['kind'] =
      kindRoll < 0.44 ? 'ring0' : kindRoll < 0.88 ? 'ring1' : 'radial';

    const ringCenter = kind === 'ring1' ? params.R1 : params.R0;
    const baseRadius =
      kind === 'radial'
        ? lerp(params.radialGrooveMinR, params.radialGrooveMaxR, Math.sqrt(params.rand()))
        : ringCenter + (params.rand() * 2 - 1) * params.grooveHalfW * 0.85;

    const boundary = Math.floor(params.rand() * params.columns) * params.dTheta;
    const baseTheta =
      kind === 'radial'
        ? boundary + (params.rand() * 2 - 1) * params.thetaHalfW * 0.88
        : params.rand() * TWO_PI;

    states.push({
      kind,
      baseTheta,
      baseRadius,
      baseY: baseY + params.rand() * params.blockSize * 0.015,
      phase: params.rand() * TWO_PI,
      riseSpeed: lerp(0.35, 1.05, params.rand()),
      riseHeight: lerp(params.blockSize * 0.1, params.blockSize * 0.3, params.rand()),
      driftSpeed: lerp(0.6, 1.9, params.rand()),
      driftAmplitude:
        kind === 'radial'
          ? lerp(params.blockSize * 0.01, params.blockSize * 0.03, params.rand())
          : lerp(0.004, 0.012, params.rand()),
      size: lerp(params.blockSize * 0.03, params.blockSize * 0.055, params.rand()),
      yaw: params.rand() * TWO_PI,
      tilt: lerp(0.0, 0.55, params.rand()),
    });
  }

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const scale = new THREE.Vector3();

  const update = (timeSeconds: number) => {
    for (let i = 0; i < states.length; i += 1) {
      const s = states[i];
      const life = (timeSeconds * s.riseSpeed + s.phase) % 1;
      const rise = life * s.riseHeight;

      const fadeIn = smoothstep(0.0, 0.12, life);
      const fadeOut = 1 - smoothstep(0.78, 1.0, life);
      const intensity = Math.max(0, fadeIn * fadeOut);

      const y = s.baseY + rise;
      let theta = s.baseTheta;
      let radius = s.baseRadius;
      const drift = Math.sin(timeSeconds * s.driftSpeed + s.phase) * s.driftAmplitude;
      if (s.kind === 'radial') {
        radius = clamp(radius + drift, params.radialGrooveMinR, params.radialGrooveMaxR);
      } else {
        theta += drift;
      }

      position.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius);

      const spin = timeSeconds * 0.7 + s.phase * 0.15;
      euler.set(s.tilt, s.yaw + spin, 0);
      rotation.setFromEuler(euler);

      const sxy = Math.max(0, s.size * intensity);
      scale.set(sxy, sxy * 1.65, 1);

      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  update(0);

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { mesh, update, dispose };
}

function createSteamRings(params: {
  rand: () => number;
  yTop: number;
  innerR: number;
  outerR: number;
  blockSize: number;
  columns: number;
}): {
  group: THREE.Group;
  update: (timeSeconds: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'footprintLavaSteam';
  group.userData.debugSelectable = false;
  group.userData.debugTag = {
    kind: 'hallFootprint',
    sourceFile: 'src/render/footprintLavaFx.ts',
    sourceFunction: 'createSteamRings',
  } satisfies DebugTag;

  const segments = Math.max(64, Math.floor(params.columns) * 8);
  const width = Math.max(1e-4, params.outerR - params.innerR);
  const pad = Math.min(width * 0.06, params.blockSize * 0.08);

  const baseInner = Math.max(1e-4, params.innerR - pad);
  const baseOuter = Math.max(baseInner + 1e-4, params.outerR + pad);

  const inner2 = Math.max(1e-4, baseInner - pad * 0.6);
  const outer2 = Math.max(inner2 + 1e-4, baseOuter + pad * 1.25);

  const y0 = params.yTop + params.blockSize * 0.03;
  const y1 = params.yTop + params.blockSize * 0.055;

  const ring0 = createSteamRingMesh({
    inner: baseInner,
    outer: baseOuter,
    segments,
    y: y0,
    opacity: 0.12,
    color: 0xffd1f2,
  });
  const ring1 = createSteamRingMesh({
    inner: inner2,
    outer: outer2,
    segments,
    y: y1,
    opacity: 0.075,
    color: 0xffe2f8,
  });

  ring0.mesh.scale.set(1, 1, 1);
  ring1.mesh.scale.set(1, 1, 1);

  group.add(ring0.mesh);
  group.add(ring1.mesh);

  const phase0 = params.rand() * TWO_PI;
  const phase1 = params.rand() * TWO_PI;

  const update = (timeSeconds: number) => {
    const s0 = 1 + 0.008 * Math.sin(timeSeconds * 0.55 + phase0);
    const s1 = 1 + 0.01 * Math.sin(timeSeconds * 0.43 + phase1);
    ring0.mesh.scale.set(s0, s0, s0);
    ring1.mesh.scale.set(s1, s1, s1);
    ring0.mesh.position.y = y0 + params.blockSize * 0.006 * Math.sin(timeSeconds * 0.62 + phase0);
    ring1.mesh.position.y = y1 + params.blockSize * 0.007 * Math.sin(timeSeconds * 0.51 + phase1);
  };

  const dispose = () => {
    ring0.dispose();
    ring1.dispose();
  };

  return { group, update, dispose };
}

function createSteamRingMesh(params: {
  inner: number;
  outer: number;
  segments: number;
  y: number;
  opacity: number;
  color: number;
}): { mesh: THREE.Mesh; dispose: () => void } {
  const geometry = new THREE.RingGeometry(params.inner, params.outer, params.segments, 1);
  const material = new THREE.MeshBasicMaterial({
    color: params.color,
    transparent: true,
    opacity: params.opacity,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'footprintLavaSteamRing';
  mesh.frustumCulled = false;
  mesh.position.y = params.y;
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData.debugSelectable = false;
  mesh.userData.debugTag = {
    kind: 'hallFootprint',
    sourceFile: 'src/render/footprintLavaFx.ts',
    sourceFunction: 'createSteamRingMesh',
  } satisfies DebugTag;

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { mesh, dispose };
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
