import { describe, expect, it } from 'vitest';
import { analyzeHallGeometry } from '../hallGeometryMonitor';
import { HallGeometrySnapshot, HallObjectSnapshot } from '../hallGeometrySnapshot';
import { HallLayoutRadii } from '../../hallLayout';
import { PlatformLayout } from '../../platformLayout';

function makeSnapshot(overrides?: Partial<HallGeometrySnapshot>): HallGeometrySnapshot {
  const base: HallGeometrySnapshot = {
    towerCells: [
      makeObj({
        name: 'towerCell0',
        kind: 'towerCell',
        bbox: { min: [0, 0, 0], max: [1, 1, 1] },
      }),
    ],
    platformRings: [],
    platformSides: [],
    footprints: [
      makeObj({
        name: 'footprint',
        kind: 'footprintDecor',
        bbox: { min: [-1.6, 0, -1.6], max: [1.6, 0.01, 1.6] },
        upNormal: [0, 1, 0],
      }),
    ],
    hallFloor: [],
    hallShells: [],
    hallColumns: [],
    others: [],
  };
  return { ...base, ...(overrides ?? {}) };
}

function makeObj(
  data: Partial<HallObjectSnapshot> & { kind: HallObjectSnapshot['kind'] }
): HallObjectSnapshot {
  return {
    id: data.id ?? data.name ?? 'id',
    kind: data.kind,
    name: data.name ?? 'obj',
    worldPos: data.worldPos ?? [0, 0, 0],
    bbox:
      data.bbox ??
      ({
        min: [0, 0, 0],
        max: [1, 1, 1],
      } as any),
    approxRadiusXZ: data.approxRadiusXZ ?? 1,
    upNormal: data.upNormal,
    debugTag: data.debugTag,
  };
}

const BASE_LAYOUT: PlatformLayout = {
  baseY: 0,
  heightCore: 0,
  ringA: { inner: 0, outer: 2, height: 0 },
  ringB: { inner: 2, outer: 3, height: 0 },
  ringC: { inner: 3, outer: 4, height: 0 },
};

const BASE_HALL: HallLayoutRadii = {
  towerOuterRadius: 1,
  cameraOrbitRadius: 3,
  hallInnerRadius: 5,
  hallOuterRadius: 6,
  platformOuterRadius: 4,
};

describe('hallGeometryMonitor (17.5 acceptance)', () => {
  it('normal snapshot yields no violations', () => {
    const result = analyzeHallGeometry({
      snapshot: makeSnapshot(),
      hallLayout: BASE_HALL,
      platformLayout: BASE_LAYOUT,
      config: { floorEpsilon: 0.02 },
    });
    expect(result.violations.length).toBe(0);
  });

  it('footprint buried triggers INV_FOOTPRINT_NOT_BURIED', () => {
    const snap = makeSnapshot({
      footprints: [
        makeObj({
          name: 'footprintBuried',
          kind: 'footprintDecor',
          bbox: { min: [-1, -0.05, -1], max: [1, -0.01, 1] },
          upNormal: [0, 1, 0],
        }),
      ],
    });
    const result = analyzeHallGeometry({
      snapshot: snap,
      hallLayout: BASE_HALL,
      platformLayout: BASE_LAYOUT,
    });
    expect(result.violations.some((v) => v.invariant === 'INV_FOOTPRINT_NOT_BURIED')).toBe(true);
  });

  it('ring A raised above tower floor triggers alignment violation', () => {
    const layout: PlatformLayout = {
      ...BASE_LAYOUT,
      ringA: { ...BASE_LAYOUT.ringA, height: 0.2 },
    };
    const result = analyzeHallGeometry({
      snapshot: makeSnapshot(),
      hallLayout: BASE_HALL,
      platformLayout: layout,
      config: { floorEpsilon: 0.01 },
    });
    expect(
      result.violations.some((v) => v.invariant === 'INV_PLATFORM_RINGA_FLOOR_ALIGNMENT')
    ).toBe(true);
  });
});
