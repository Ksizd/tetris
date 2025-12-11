import * as THREE from 'three';
import { RenderModeConfig } from '../renderConfig';

export type HallDebugKind =
  | 'towerCell'
  | 'towerRoot'
  | 'platformRingA'
  | 'platformRingB'
  | 'platformRingC'
  | 'platformSide'
  | 'footprintCore'
  | 'footprintDecor'
  | 'hallInnerShell'
  | 'hallOuterShell'
  | 'hallColumn'
  | 'hallCeiling'
  | 'hallFloor'
  | 'debugOverlay';

export type DebugObjectKind =
  | HallDebugKind
  | 'activePiece'
  | 'fragment'
  | 'hallWallSection'
  | 'hallDomeSegment'
  | 'hallFootprint'
  | 'atmosphereParticles'
  | 'light'
  | 'camera'
  | 'unknown';

/**
 * Debug tag attached to object.userData.debugTag (or instanceDebugTag for instanced meshes).
 * Primary source of truth for inspector metadata to avoid guessing by object names.
 */
export interface DebugTag {
  kind: DebugObjectKind;
  label?: string;
  sourceModule?: string;
  sourceFile?: string;
  sourceFunction?: string;
  boardCoords?: { ring: number; level: number; height: number };
  pieceId?: string;
  fragmentInfo?: { shardTemplateId?: number; instanceId?: number };
  hallSection?: { ring: 'inner' | 'middle' | 'outer'; segmentIndex: number; levelBand?: string };
  payload?: Record<string, unknown>;
}

export interface ObjectInspectorSelection {
  object: THREE.Object3D;
  instanceId?: number;
  debugTag?: DebugTag;
  hierarchyPath: string[];
}

export interface ObjectDebugInfo {
  object: THREE.Object3D;
  name: string;
  objectType: string;
  uuid: string;
  debugTag?: DebugTag;
  instanceId?: number;
  worldPosition: { x: number; y: number; z: number };
  worldRotationEuler: { x: number; y: number; z: number };
  worldScale: { x: number; y: number; z: number };
  hierarchyPath: string[];
  geometryInfo?: {
    type?: string;
    vertexCount?: number;
    indexCount?: number;
    drawRange?: { start: number; count: number };
    boundingBox?: { min: number[]; max: number[] };
  };
  materialInfo?: {
    name?: string;
    type?: string;
    transparent?: boolean;
    metalness?: number;
    roughness?: number;
    emissive?: number[] | null;
  };
  summaryForLLM: string;
  jsonForLLM: string;
}

/**
 * Inspector must never be active in normal game mode.
 */
export function isInspectorAllowed(renderMode: RenderModeConfig): boolean {
  return renderMode.kind !== 'game';
}

export function readDebugTag(target: THREE.Object3D, instanceId?: number): DebugTag | undefined {
  if (instanceId !== undefined && (target as any).userData?.instanceDebugTag) {
    return (target as any).userData.instanceDebugTag as DebugTag;
  }
  return (target as any).userData?.debugTag as DebugTag | undefined;
}

export function buildHierarchyPath(object: THREE.Object3D): string[] {
  const path: string[] = [];
  let current: THREE.Object3D | null = object;
  while (current) {
    path.unshift(current.name || current.type);
    current = current.parent;
  }
  return path;
}
