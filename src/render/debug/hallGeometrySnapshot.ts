import * as THREE from 'three';
import { DebugTag, HallDebugKind, readDebugTag } from './objectInspectorTypes';

export interface HallObjectSnapshot {
  id: string;
  kind: HallDebugKind;
  name: string;
  worldPos: [number, number, number];
  bbox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  approxRadiusXZ?: number;
  upNormal?: [number, number, number];
  debugTag?: DebugTag;
}

export interface HallGeometrySnapshot {
  towerCells: HallObjectSnapshot[];
  platformRings: HallObjectSnapshot[];
  platformSides: HallObjectSnapshot[];
  footprints: HallObjectSnapshot[];
  hallFloor: HallObjectSnapshot[];
  hallShells: HallObjectSnapshot[];
  hallColumns: HallObjectSnapshot[];
  others: HallObjectSnapshot[];
}

const HALL_KINDS = new Set<HallDebugKind>([
  'towerCell',
  'towerRoot',
  'platformRingA',
  'platformRingB',
  'platformRingC',
  'platformSide',
  'footprintCore',
  'footprintDecor',
  'hallInnerShell',
  'hallOuterShell',
  'hallColumn',
  'hallCeiling',
  'hallFloor',
  'debugOverlay',
]);

export function collectHallSnapshot(root: THREE.Object3D): HallGeometrySnapshot {
  const snapshot: HallGeometrySnapshot = {
    towerCells: [],
    platformRings: [],
    platformSides: [],
    footprints: [],
    hallFloor: [],
    hallShells: [],
    hallColumns: [],
    others: [],
  };

  root.traverse((obj) => {
    const tag = readDebugTag(obj);
    if (!tag || !isHallKind(tag.kind)) {
      return;
    }
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const up = getWorldUp(obj);
    const approxRadius = computeApproxRadiusXZ(box);

    const entry: HallObjectSnapshot = {
      id: obj.uuid,
      kind: tag.kind,
      name: obj.name || obj.type,
      worldPos: [center.x, center.y, center.z],
      bbox: {
        min: [box.min.x, box.min.y, box.min.z],
        max: [box.max.x, box.max.y, box.max.z],
      },
      approxRadiusXZ: approxRadius,
      upNormal: up ? [up.x, up.y, up.z] : undefined,
      debugTag: tag,
    };

    distribute(entry, snapshot);
  });

  return snapshot;
}

function distribute(entry: HallObjectSnapshot, snap: HallGeometrySnapshot): void {
  switch (entry.kind) {
    case 'towerCell':
    case 'towerRoot':
      snap.towerCells.push(entry);
      return;
    case 'platformRingA':
    case 'platformRingB':
    case 'platformRingC':
      snap.platformRings.push(entry);
      return;
    case 'platformSide':
      snap.platformSides.push(entry);
      return;
    case 'footprintCore':
    case 'footprintDecor':
      snap.footprints.push(entry);
      return;
    case 'hallFloor':
      snap.hallFloor.push(entry);
      return;
    case 'hallInnerShell':
    case 'hallOuterShell':
    case 'hallCeiling':
      snap.hallShells.push(entry);
      return;
    case 'hallColumn':
      snap.hallColumns.push(entry);
      return;
    default:
      snap.others.push(entry);
  }
}

function getWorldUp(obj: THREE.Object3D): THREE.Vector3 | null {
  const q = new THREE.Quaternion();
  obj.getWorldQuaternion(q);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
  return up;
}

function computeApproxRadiusXZ(box: THREE.Box3): number | undefined {
  if (!box.isEmpty()) {
    const maxR = Math.max(Math.abs(box.max.x), Math.abs(box.max.z), Math.abs(box.min.x), Math.abs(box.min.z));
    return maxR;
  }
  return undefined;
}

function isHallKind(kind: string): kind is HallDebugKind {
  return HALL_KINDS.has(kind as HallDebugKind);
}
