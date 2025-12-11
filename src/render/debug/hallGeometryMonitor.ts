import * as THREE from 'three';
import { HallLayoutRadii } from '../hallLayout';
import { PlatformLayout } from '../platformLayout';
import { HallGeometrySnapshot, HallObjectSnapshot } from './hallGeometrySnapshot';

export type InvariantId =
  | 'INV_PLATFORM_RINGA_FLOOR_ALIGNMENT'
  | 'INV_TOWER_BASE_ABOVE_RINGA'
  | 'INV_FOOTPRINT_HEIGHT_RANGE'
  | 'INV_FOOTPRINT_NOT_BURIED'
  | 'INV_FOOTPRINT_ORIENTATION'
  | 'INV_PLATFORM_RING_RADII_ORDER'
  | 'INV_PLATFORM_NO_DEEP_INTERSECTIONS'
  | 'INV_TOWER_NO_DEEP_INTERSECTIONS'
  | 'INV_HALL_FLOOR_NOT_ABOVE_TOWER'
  | 'INV_UNKNOWN_OBJECTS';

export interface HallGeometryViolation {
  invariant: InvariantId;
  severity: 'error' | 'warning';
  message: string;
  objectsInvolved: string[];
  details: Record<string, any>;
}

export interface HallGeometryMonitorConfig {
  floorEpsilon: number;
  penetrationEpsilon: number;
  footprintMaxOffset: number;
  footprintAboveEpsilon: number;
  orientationCosTolerance: number;
  ringOrderEpsilon: number;
}

export interface HallGeometryMonitorInput {
  snapshot: HallGeometrySnapshot;
  hallLayout: HallLayoutRadii;
  platformLayout: PlatformLayout;
  config?: Partial<HallGeometryMonitorConfig>;
}

const DEFAULT_CONFIG: HallGeometryMonitorConfig = {
  floorEpsilon: 0.01,
  penetrationEpsilon: 0.002,
  footprintMaxOffset: 0.05,
  footprintAboveEpsilon: 0.001,
  orientationCosTolerance: 0.996, // ~5 degrees
  ringOrderEpsilon: 1e-3,
};

export function analyzeHallGeometry(input: HallGeometryMonitorInput): { violations: HallGeometryViolation[] } {
  const cfg: HallGeometryMonitorConfig = { ...DEFAULT_CONFIG, ...(input.config ?? {}) };
  const violations: HallGeometryViolation[] = [];

  const ringA = unionBoxes(input.snapshot.platformRings.filter((r) => r.kind === 'platformRingA'));
  const ringB = unionBoxes(input.snapshot.platformRings.filter((r) => r.kind === 'platformRingB'));
  const ringC = unionBoxes(input.snapshot.platformRings.filter((r) => r.kind === 'platformRingC'));
  const platformAll = unionBoxes([
    ...input.snapshot.platformRings,
    ...input.snapshot.platformSides,
  ]);

  violations.push(
    ...checkPlatformRingAFloorAlignment(input.snapshot, input.platformLayout, ringA, cfg),
    ...checkTowerBasePenetration(input.snapshot, platformAll, cfg),
    ...checkFootprintHeightRange(input.snapshot, input.platformLayout, ringA, cfg),
    ...checkFootprintNotBuried(input.snapshot, ringA, cfg),
    ...checkFootprintOrientation(input.snapshot, cfg),
    ...checkPlatformRingRadiiOrder(input.snapshot, input.hallLayout, input.platformLayout, ringA, ringB, ringC, cfg),
    ...checkPlatformIntersections(input.snapshot, platformAll, cfg),
    ...checkTowerIntersections(input.snapshot, platformAll, cfg),
    ...checkHallFloorNotAboveTower(input.snapshot, ringA, cfg),
    ...checkUnknownObjects(input.snapshot)
  );

  return { violations };
}

function checkPlatformRingAFloorAlignment(
  snapshot: HallGeometrySnapshot,
  layout: PlatformLayout,
  ringABox: THREE.Box3 | null,
  cfg: HallGeometryMonitorConfig
): HallGeometryViolation[] {
  const violations: HallGeometryViolation[] = [];
  const ringATop = ringABox ? ringABox.max.y : layout.baseY + layout.ringA.height;
  const towerFloor = findTowerFloorY(snapshot);
  if (towerFloor === null) {
    return violations;
  }
  const gap = Math.abs(ringATop - towerFloor);
  if (gap > cfg.floorEpsilon) {
    violations.push({
      invariant: 'INV_PLATFORM_RINGA_FLOOR_ALIGNMENT',
      severity: 'error',
      message: `Ring A top (${ringATop.toFixed(4)}) misaligned with tower floor (${towerFloor.toFixed(
        4
      )}) by ${gap.toFixed(4)}`,
      objectsInvolved: collectNames(snapshot.platformRings),
      details: { ringATop, towerFloor, gap, epsilon: cfg.floorEpsilon },
    });
  }
  return violations;
}

function checkTowerBasePenetration(
  snapshot: HallGeometrySnapshot,
  platformBox: THREE.Box3 | null,
  cfg: HallGeometryMonitorConfig
): HallGeometryViolation[] {
  const violations: HallGeometryViolation[] = [];
  if (!platformBox) {
    return violations;
  }
  snapshot.towerCells.forEach((cell) => {
    const cellBox = boxFromSnapshot(cell);
    const penetration = penetrationDepth(platformBox, cellBox);
    if (penetration !== null && penetration > cfg.penetrationEpsilon) {
      violations.push({
        invariant: 'INV_TOWER_NO_DEEP_INTERSECTIONS',
        severity: 'error',
        message: `Tower cell intersects platform by ${penetration.toFixed(4)}`,
        objectsInvolved: [cell.name],
        details: { penetration, cellBox: cell.bbox, platformBox: serializeBox(platformBox) },
      });
    }
  });
  return violations;
}

function checkFootprintHeightRange(
  snapshot: HallGeometrySnapshot,
  layout: PlatformLayout,
  ringABox: THREE.Box3 | null,
  cfg: HallGeometryMonitorConfig
): HallGeometryViolation[] {
  const violations: HallGeometryViolation[] = [];
  if (!snapshot.footprints.length) {
    return violations;
  }
  const footprintBox = unionBoxes(snapshot.footprints);
  if (!footprintBox) {
    return violations;
  }
  const ringATop = ringABox ? ringABox.max.y : layout.baseY + layout.ringA.height;
  const minY = footprintBox.min.y;
  const maxY = footprintBox.max.y;
  if (minY < ringATop - cfg.floorEpsilon || maxY > ringATop + cfg.footprintMaxOffset + cfg.floorEpsilon) {
    violations.push({
      invariant: 'INV_FOOTPRINT_HEIGHT_RANGE',
      severity: 'error',
      message: `Footprint height range [${minY.toFixed(4)}, ${maxY.toFixed(4)}] outside allowed window near ringA (${ringATop.toFixed(
        4
      )})`,
      objectsInvolved: collectNames(snapshot.footprints),
      details: { minY, maxY, ringATop, offset: cfg.footprintMaxOffset, epsilon: cfg.floorEpsilon },
    });
  }
  return violations;
}

function checkFootprintNotBuried(
  snapshot: HallGeometrySnapshot,
  ringABox: THREE.Box3 | null,
  cfg: HallGeometryMonitorConfig
): HallGeometryViolation[] {
  const violations: HallGeometryViolation[] = [];
  if (!snapshot.footprints.length || !ringABox) {
    return violations;
  }
  const footprintBox = unionBoxes(snapshot.footprints);
  if (!footprintBox) {
    return violations;
  }
  const ringATop = ringABox.max.y;
  if (footprintBox.max.y <= ringATop + cfg.footprintAboveEpsilon) {
    violations.push({
      invariant: 'INV_FOOTPRINT_NOT_BURIED',
      severity: 'error',
      message: `Footprint buried: maxY=${footprintBox.max.y.toFixed(4)} is not above ringA top ${ringATop.toFixed(4)}`,
      objectsInvolved: collectNames(snapshot.footprints),
      details: { footprintBox: serializeBox(footprintBox), ringATop, epsilon: cfg.footprintAboveEpsilon },
    });
  }
  return violations;
}

function checkFootprintOrientation(
  snapshot: HallGeometrySnapshot,
  cfg: HallGeometryMonitorConfig
): HallGeometryViolation[] {
  const violations: HallGeometryViolation[] = [];
  snapshot.footprints.forEach((fp) => {
    if (!fp.upNormal) {
      violations.push({
        invariant: 'INV_FOOTPRINT_ORIENTATION',
        severity: 'warning',
        message: `Footprint ${fp.name} lacks upNormal`,
        objectsInvolved: [fp.name],
        details: {},
      });
      return;
    }
    const up = new THREE.Vector3(...fp.upNormal).normalize();
    const dot = up.dot(new THREE.Vector3(0, 1, 0));
    if (dot < cfg.orientationCosTolerance) {
      violations.push({
        invariant: 'INV_FOOTPRINT_ORIENTATION',
        severity: 'error',
        message: `Footprint ${fp.name} tilted: dot(+Y)=${dot.toFixed(4)} below threshold ${cfg.orientationCosTolerance}`,
        objectsInvolved: [fp.name],
        details: { up: fp.upNormal, dot, threshold: cfg.orientationCosTolerance },
      });
    }
  });
  return violations;
}

function checkPlatformRingRadiiOrder(
  snapshot: HallGeometrySnapshot,
  hallLayout: HallLayoutRadii,
  platformLayout: PlatformLayout,
  ringABox: THREE.Box3 | null,
  ringBBox: THREE.Box3 | null,
  ringCBox: THREE.Box3 | null,
  cfg: HallGeometryMonitorConfig
): HallGeometryViolation[] {
  const violations: HallGeometryViolation[] = [];

  const rTower = hallLayout.towerOuterRadius;
  const rFootprintOuter = computeMaxRadius(snapshot.footprints);
  const rA = ringABox ? radiusFromBox(ringABox) : platformLayout.ringA.outer;
  const rB = ringBBox ? radiusFromBox(ringBBox) : platformLayout.ringB.outer;
  const rC = ringCBox ? radiusFromBox(ringCBox) : platformLayout.ringC.outer;
  const rHall = hallLayout.hallInnerRadius;

  const problems: string[] = [];
  if (rFootprintOuter !== null && !(rFootprintOuter > rTower + cfg.ringOrderEpsilon)) {
    problems.push('R_footprintOuter <= R_tower');
  }
  if (!(rA > rTower + cfg.ringOrderEpsilon)) {
    problems.push('R_ringA <= R_tower');
  }
  if (!(rFootprintOuter === null || rB > rFootprintOuter + cfg.ringOrderEpsilon)) {
    problems.push('R_ringB <= R_footprintOuter');
  }
  if (!(rB > rA + cfg.ringOrderEpsilon && rC > rB + cfg.ringOrderEpsilon && rHall > rC + cfg.ringOrderEpsilon)) {
    problems.push('Ring ordering violated (R_A < R_B < R_C < R_hallInner)');
  }
  if (problems.length) {
    violations.push({
      invariant: 'INV_PLATFORM_RING_RADII_ORDER',
      severity: 'error',
      message: problems.join('; '),
      objectsInvolved: collectNames(snapshot.platformRings),
      details: { rTower, rFootprintOuter, rA, rB, rC, rHall, epsilon: cfg.ringOrderEpsilon },
    });
  }
  return violations;
}

function checkPlatformIntersections(
  snapshot: HallGeometrySnapshot,
  platformBox: THREE.Box3 | null,
  cfg: HallGeometryMonitorConfig
): HallGeometryViolation[] {
  const violations: HallGeometryViolation[] = [];
  if (!platformBox) {
    return violations;
  }
  const footprintBox = unionBoxes(snapshot.footprints);
  if (footprintBox) {
    const penetration = penetrationDepth(platformBox, footprintBox);
    if (penetration !== null && penetration > cfg.penetrationEpsilon) {
      violations.push({
        invariant: 'INV_PLATFORM_NO_DEEP_INTERSECTIONS',
        severity: 'warning',
        message: `Platform intersects footprint by ${penetration.toFixed(4)}`,
        objectsInvolved: [...collectNames(snapshot.platformRings), ...collectNames(snapshot.footprints)],
        details: { penetration, platformBox: serializeBox(platformBox), footprintBox: serializeBox(footprintBox) },
      });
    }
  }
  return violations;
}

function checkTowerIntersections(
  snapshot: HallGeometrySnapshot,
  platformBox: THREE.Box3 | null,
  cfg: HallGeometryMonitorConfig
): HallGeometryViolation[] {
  const violations: HallGeometryViolation[] = [];
  if (!platformBox) {
    return violations;
  }
  snapshot.towerCells.forEach((cell) => {
    const box = boxFromSnapshot(cell);
    const penetration = penetrationDepth(platformBox, box);
    if (penetration !== null && penetration > cfg.penetrationEpsilon) {
      violations.push({
        invariant: 'INV_TOWER_NO_DEEP_INTERSECTIONS',
        severity: 'error',
        message: `Tower cell intersects platform by ${penetration.toFixed(4)}`,
        objectsInvolved: [cell.name],
        details: { penetration, box: cell.bbox, platformBox: serializeBox(platformBox) },
      });
    }
  });
  return violations;
}

function checkHallFloorNotAboveTower(
  snapshot: HallGeometrySnapshot,
  ringABox: THREE.Box3 | null,
  cfg: HallGeometryMonitorConfig
): HallGeometryViolation[] {
  const violations: HallGeometryViolation[] = [];
  if (!ringABox) {
    return violations;
  }
  const hallFloor = unionBoxes(snapshot.hallFloor);
  if (!hallFloor) {
    return violations;
  }
  const ringATop = ringABox.max.y;
  if (hallFloor.max.y > ringATop + cfg.floorEpsilon) {
    violations.push({
      invariant: 'INV_HALL_FLOOR_NOT_ABOVE_TOWER',
      severity: 'warning',
      message: `Hall floor top (${hallFloor.max.y.toFixed(4)}) is above ringA (${ringATop.toFixed(4)})`,
      objectsInvolved: collectNames(snapshot.hallFloor),
      details: { hallFloor: serializeBox(hallFloor), ringATop, epsilon: cfg.floorEpsilon },
    });
  }
  return violations;
}

function checkUnknownObjects(snapshot: HallGeometrySnapshot): HallGeometryViolation[] {
  if (!snapshot.others.length) {
    return [];
  }
  return [
    {
      invariant: 'INV_UNKNOWN_OBJECTS',
      severity: 'warning',
      message: `Found ${snapshot.others.length} unknown hall objects`,
      objectsInvolved: collectNames(snapshot.others),
      details: {},
    },
  ];
}

function findTowerFloorY(snapshot: HallGeometrySnapshot): number | null {
  if (!snapshot.towerCells.length) {
    return null;
  }
  let minY = Number.POSITIVE_INFINITY;
  snapshot.towerCells.forEach((cell) => {
    minY = Math.min(minY, cell.bbox.min[1]);
  });
  return minY === Number.POSITIVE_INFINITY ? null : minY;
}

function unionBoxes(entries: HallObjectSnapshot[]): THREE.Box3 | null {
  if (!entries.length) {
    return null;
  }
  const box = new THREE.Box3();
  entries.forEach((entry, idx) => {
    const b = boxFromSnapshot(entry);
    if (idx === 0) {
      box.copy(b);
    } else {
      box.union(b);
    }
  });
  return box;
}

function boxFromSnapshot(entry: HallObjectSnapshot): THREE.Box3 {
  const box = new THREE.Box3();
  box.min.set(entry.bbox.min[0], entry.bbox.min[1], entry.bbox.min[2]);
  box.max.set(entry.bbox.max[0], entry.bbox.max[1], entry.bbox.max[2]);
  return box;
}

function serializeBox(box: THREE.Box3): Record<string, number[]> {
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}

function penetrationDepth(a: THREE.Box3, b: THREE.Box3): number | null {
  const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
  const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
  const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
  if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) {
    return null;
  }
  return Math.min(overlapX, overlapY, overlapZ);
}

function collectNames(items: HallObjectSnapshot[]): string[] {
  return items.map((i) => i.name || i.id);
}

function computeMaxRadius(items: HallObjectSnapshot[]): number | null {
  if (!items.length) {
    return null;
  }
  let maxR = -Infinity;
  items.forEach((item) => {
    const r = radiusFromBox(boxFromSnapshot(item));
    maxR = Math.max(maxR, r);
  });
  return maxR === -Infinity ? null : maxR;
}

function radiusFromBox(box: THREE.Box3): number {
  return Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z));
}
