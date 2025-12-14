import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { BoardDimensions } from '../../core/types';
import type { PlatformLayout } from '../platformLayout';
import { createBoardRenderConfig } from '../boardConfig';
import { createFootprintLavaSparksFx, updateFootprintLavaSparksFx } from '../footprintLavaSparksFx';
import { buildFootprintLavaSparksReport } from '../footprintLavaSparksDebug';

function createTestPlatformLayout(): PlatformLayout {
  return {
    baseY: -1.2,
    heightCore: 1.0,
    ringA: { inner: 0, outer: 10, height: 0.5 },
    ringB: { inner: 10, outer: 11, height: 0.45 },
    ringC: { inner: 11, outer: 60, height: 0.4 },
  };
}

function runSim(seed: number, dtSec: number, seconds: number, maxParticles = 200) {
  const dimensions: BoardDimensions = { width: 16, height: 20 };
  const board = createBoardRenderConfig(dimensions, { blockSize: 1 });
  const platformLayout = createTestPlatformLayout();
  const fx = createFootprintLavaSparksFx({
    footprintInlayRef: new THREE.Group(),
    dimensions,
    board,
    platformLayout,
    quality: 'low',
    seed,
    limits: { maxParticles },
  });
  expect(fx).not.toBeNull();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  const steps = Math.max(1, Math.round(seconds / dtSec));
  for (let i = 0; i < steps; i += 1) {
    updateFootprintLavaSparksFx(fx!, dtSec, 0, camera);
  }
  const report = buildFootprintLavaSparksReport(fx!);
  expect(report).not.toBeNull();
  return { fx: fx!, report: report! };
}

describe('footprint lava sparks fx (footprint_fix 6.4)', () => {
  it('is deterministic for fixed seed and dt', () => {
    const dtSec = 1 / 60;
    const seconds = 4.0;
    const a = runSim(1337, dtSec, seconds);
    const b = runSim(1337, dtSec, seconds);

    expect(a.report.counts).toEqual(b.report.counts);
    expect(a.report.substeps).toEqual(b.report.substeps);

    const n = Math.min(a.report.sample.length, b.report.sample.length);
    for (let i = 0; i < n; i += 1) {
      const sa = a.report.sample[i];
      const sb = b.report.sample[i];
      expect(sa.kind).toEqual(sb.kind);
      expect(sa.temp).toBeCloseTo(sb.temp, 6);
      expect(sa.age).toBeCloseTo(sb.age, 6);
      for (let k = 0; k < 3; k += 1) {
        expect(sa.pos[k]).toBeCloseTo(sb.pos[k], 6);
        expect(sa.vel[k]).toBeCloseTo(sb.vel[k], 6);
      }
    }
  });

  it('stays within particle budget and keeps invariants quiet', () => {
    const dtSec = 1 / 30;
    const seconds = 30.0;
    const { report } = runSim(2025, dtSec, seconds, 200);
    expect(report.counts.total).toBeLessThanOrEqual(report.maxParticles);
    expect(report.violations).toEqual([]);
  });

  it('does not replace instanced attribute arrays during updates', () => {
    const { fx } = runSim(777, 1 / 60, 1.0, 200);
    const mesh = fx.group.getObjectByName('footprintLavaSparks') as THREE.Mesh | null;
    expect(mesh).not.toBeNull();
    const geom = mesh!.geometry as THREE.InstancedBufferGeometry;
    const posAttr = geom.getAttribute('iPos') as THREE.InstancedBufferAttribute;
    const velAttr = geom.getAttribute('iVel') as THREE.InstancedBufferAttribute;
    const posArray = posAttr.array;
    const velArray = velAttr.array;

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    for (let i = 0; i < 60; i += 1) {
      updateFootprintLavaSparksFx(fx, 1 / 60, 0, camera);
    }

    expect(posAttr.array).toBe(posArray);
    expect(velAttr.array).toBe(velArray);
  });
});

