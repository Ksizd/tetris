import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGoldenHallDust, createGoldenHallLightShafts } from '../goldenHallFx';
import { GoldenHallLayout } from '../goldenHallLayout';

const SAMPLE_LAYOUT: GoldenHallLayout = {
  footprint: {
    towerRadius: 2,
    outerRadius: 2.4,
    innerRadius: 1.6,
    height: 12,
    blockSize: 1,
    columnCount: 32,
  },
  base: {
    outerRadius: 3.6,
    height: 2,
    stepCount: 3,
    stepInsetRatio: 0.12,
    topY: 0,
    bottomY: -2,
  },
  hallRadius: 6.2,
  wallHeight: 24,
  wallCurvatureSegments: 64,
};

describe('goldenHall dust FX', () => {
  it('skips creation on low quality', () => {
    const dust = createGoldenHallDust({ layout: SAMPLE_LAYOUT, quality: 'low' });
    expect(dust).toBeNull();
  });

  it('creates dust points within hall radius and above tower top', () => {
    const dust = createGoldenHallDust({ layout: SAMPLE_LAYOUT, quality: 'ultra', seed: 42 })!;
    expect(dust.group.name).toBe('hall-dust');
    const points = dust.group.children[0] as THREE.Points;
    const pos = (points.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const radiusLimit = SAMPLE_LAYOUT.hallRadius * 0.92 + 1e-3;
    const minY = SAMPLE_LAYOUT.footprint.height * 0.85;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(radiusLimit);
      expect(y).toBeGreaterThanOrEqual(minY);
    }
  });

  it('updates positions over time with subtle wobble', () => {
    const dust = createGoldenHallDust({ layout: SAMPLE_LAYOUT, quality: 'medium', seed: 7 })!;
    const points = dust.group.children[0] as THREE.Points;
    const pos = (points.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const before = pos.slice(0, 6);
    dust.update(100);
    const after = (points.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    expect(after[0]).not.toBeCloseTo(before[0]);
    expect(after[1]).not.toBeCloseTo(before[1]);
  });

  it('creates light shafts for ultra and skips low', () => {
    const shaftsLow = createGoldenHallLightShafts({ layout: SAMPLE_LAYOUT, quality: 'low' });
    expect(shaftsLow).toBeNull();

    const shafts = createGoldenHallLightShafts({ layout: SAMPLE_LAYOUT, quality: 'ultra', seed: 5 })!;
    expect(shafts.group.name).toBe('hall-light-shafts');
    expect(shafts.group.children.length).toBeGreaterThanOrEqual(3);
    const mesh = shafts.group.children[0] as THREE.Mesh;
    expect(mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
  });

  it('disables medium shafts by default but allows explicit opt-in', () => {
    expect(createGoldenHallLightShafts({ layout: SAMPLE_LAYOUT, quality: 'medium' })).toBeNull();

    const shaftsMedium = createGoldenHallLightShafts({
      layout: SAMPLE_LAYOUT,
      quality: 'medium',
      useLightShafts: true,
      seed: 3,
    })!;
    expect(shaftsMedium.group.children.length).toBeGreaterThanOrEqual(2);
  });

  it('disables dust or shafts when flags are false', () => {
    expect(createGoldenHallDust({ layout: SAMPLE_LAYOUT, quality: 'ultra', useDustFx: false })).toBeNull();
    expect(
      createGoldenHallLightShafts({ layout: SAMPLE_LAYOUT, quality: 'ultra', useLightShafts: false })
    ).toBeNull();
  });

  it('light shafts rotate slowly over time', () => {
    const shafts = createGoldenHallLightShafts({ layout: SAMPLE_LAYOUT, quality: 'ultra', seed: 2 })!;
    const mesh = shafts.group.children[0] as THREE.Mesh;
    const before = mesh.position.clone();
    shafts.update(500);
    const after = mesh.position;
    expect(after.x).not.toBeCloseTo(before.x);
    expect(after.z).not.toBeCloseTo(before.z);
  });
});
