import * as THREE from 'three';
import { ObjectDebugInfo, ObjectInspectorSelection, readDebugTag, buildHierarchyPath, isInspectorAllowed } from './objectInspectorTypes';
import { RenderModeConfig } from '../renderConfig';

export interface ObjectInspectorPickResult {
  info: ObjectDebugInfo | null;
  hit?: THREE.Intersection;
}

export interface ObjectInspectorParams {
  camera: THREE.Camera;
  scene: THREE.Scene;
  renderMode: RenderModeConfig;
  domElement: HTMLElement;
  onSelect?: (selection: ObjectInspectorSelection | null, info: ObjectDebugInfo | null) => void;
}

/**
  * Minimal inspector core: raycasts scene, handles instanced meshes, and builds ObjectDebugInfo.
  * Outline/highlight and UI are handled elsewhere (debugOverlays / hud).
  */
export class ObjectInspector {
  private readonly camera: THREE.Camera;
  private readonly scene: THREE.Scene;
  private readonly renderMode: RenderModeConfig;
  private readonly domElement: HTMLElement;
  private readonly raycaster = new THREE.Raycaster();
  private readonly onSelect?: (selection: ObjectInspectorSelection | null, info: ObjectDebugInfo | null) => void;
  private enabled = false;
  private selection: ObjectInspectorSelection | null = null;
  private readonly onClick = (ev: MouseEvent) => this.handleClick(ev);

  constructor(params: ObjectInspectorParams) {
    this.camera = params.camera;
    this.scene = params.scene;
    this.renderMode = params.renderMode;
    this.domElement = params.domElement;
    this.onSelect = params.onSelect;
  }

  enable(): void {
    if (!isInspectorAllowed(this.renderMode)) {
      return;
    }
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    this.domElement.addEventListener('click', this.onClick, { capture: true });
  }

  disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    this.domElement.removeEventListener('click', this.onClick, { capture: true });
    this.updateSelection(null, null);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  pick(ndcX: number, ndcY: number): ObjectInspectorPickResult {
    if (!isInspectorAllowed(this.renderMode)) {
      return { info: null };
    }
    // Ensure camera matrices are up to date before raycasting (orbit changes or resizes).
    this.camera.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    const hit = this.resolveHit(hits);
    if (!hit) {
      this.updateSelection(null, null);
      return { info: null };
    }
    const info = this.buildDebugInfo(hit);
    this.updateSelection(
      info
        ? {
            object: hit.object,
            instanceId: (hit as any).instanceId as number | undefined,
            debugTag: info.debugTag,
            hierarchyPath: info.hierarchyPath,
          }
        : null,
      info
    );
    return { info, hit };
  }

  getSelection(): ObjectInspectorSelection | null {
    return this.selection;
  }

  dispose(): void {
    this.disable();
  }

  private handleClick(ev: MouseEvent): void {
    if (!this.enabled) {
      return;
    }
    ev.stopPropagation();
    ev.preventDefault();
    const rect = this.domElement.getBoundingClientRect();
    const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    this.pick(ndcX, ndcY);
  }

  private resolveHit(hits: THREE.Intersection[]): THREE.Intersection | null {
    for (const h of hits) {
      if (!h.object?.visible) {
        continue;
      }
      if ((h.object as any).userData?.debugSelectable === false) {
        continue;
      }
      // Ignore inspector helpers/highlights to avoid self-picking.
      const name = h.object?.name ?? '';
      if (name.includes('inspectorHighlight')) {
        continue;
      }
      return h;
    }
    return null;
  }

  private updateSelection(selection: ObjectInspectorSelection | null, info: ObjectDebugInfo | null): void {
    this.selection = selection;
    if (this.onSelect) {
      this.onSelect(selection, info);
    }
  }

  private buildDebugInfo(hit: THREE.Intersection): ObjectDebugInfo | null {
    const target = hit.object;
    if (!target) {
      return null;
    }
    const instanceId = (hit as any).instanceId as number | undefined;
    const debugTag = readDebugTag(target, instanceId);
    const worldPositionVec = hit.point?.clone() ?? target.getWorldPosition(new THREE.Vector3());
    const worldQuaternion = target.getWorldQuaternion(new THREE.Quaternion());
    const worldEuler = new THREE.Euler().setFromQuaternion(worldQuaternion, 'XYZ');
    const worldScale = target.getWorldScale(new THREE.Vector3());
    const path = buildHierarchyPath(target);
    const geometryInfo = this.readGeometryInfo(target);
    const materialInfo = this.readMaterialInfo(target);
    const worldPosition = { x: worldPositionVec.x, y: worldPositionVec.y, z: worldPositionVec.z };
    const summaryForLLM = this.buildDumpForLLM({
      target,
      tag: debugTag,
      path,
      worldPosition,
      geometryInfo,
      materialInfo,
      instanceId,
    });
    const jsonForLLM = JSON.stringify(
      {
        name: target.name,
        type: target.type,
        uuid: target.uuid,
        path,
        debugTag,
        instanceId,
        worldPosition,
        geometryInfo,
        materialInfo,
      },
      null,
      2
    );

    return {
      name: target.name,
      objectType: target.type,
      uuid: target.uuid,
      object: target,
      debugTag,
      instanceId,
      worldPosition,
      worldRotationEuler: { x: worldEuler.x, y: worldEuler.y, z: worldEuler.z },
      worldScale: { x: worldScale.x, y: worldScale.y, z: worldScale.z },
      hierarchyPath: path,
      geometryInfo,
      materialInfo,
      summaryForLLM,
      jsonForLLM,
    };
  }

  private readGeometryInfo(obj: THREE.Object3D): ObjectDebugInfo['geometryInfo'] {
    const geom = (obj as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!geom) {
      return undefined;
    }
    const pos = geom.getAttribute('position');
    const index = geom.getIndex();
    const bbox = geom.boundingBox ?? (() => geom.computeBoundingBox(), geom.boundingBox) ?? undefined;
    return {
      type: geom.type,
      vertexCount: pos?.count,
      indexCount: index?.count,
      drawRange: geom.drawRange ? { start: geom.drawRange.start, count: geom.drawRange.count } : undefined,
      boundingBox: bbox
        ? {
            min: [bbox.min.x, bbox.min.y, bbox.min.z],
            max: [bbox.max.x, bbox.max.y, bbox.max.z],
          }
        : undefined,
    };
  }

  private readMaterialInfo(obj: THREE.Object3D): ObjectDebugInfo['materialInfo'] {
    const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) {
      return undefined;
    }
    const first = Array.isArray(mat) ? mat[0] : mat;
    const m = first as THREE.MeshStandardMaterial;
    return {
      name: first.name,
      type: first.type,
      transparent: first.transparent,
      metalness: (m as any).metalness,
      roughness: (m as any).roughness,
      emissive: m.emissive ? [m.emissive.r, m.emissive.g, m.emissive.b] : null,
    };
  }

  private buildDumpForLLM(params: {
    target: THREE.Object3D;
    tag?: ReturnType<typeof readDebugTag>;
    path: string[];
    worldPosition: { x: number; y: number; z: number };
    geometryInfo?: ObjectDebugInfo['geometryInfo'];
    materialInfo?: ObjectDebugInfo['materialInfo'];
    instanceId?: number;
  }): string {
    const { target, tag, path, worldPosition, geometryInfo, materialInfo, instanceId } = params;
    const lines: string[] = [];
    lines.push('OBJECT_DEBUG_DUMP_BEGIN');
    lines.push(`Object: ${target.type}${target.name ? ` "${target.name}"` : ''}`);
    if (instanceId !== undefined) {
      lines.push(`Instance: ${instanceId}`);
    }
    lines.push(`Debug kind: ${tag?.kind ?? 'unknown'}`);
    lines.push(`Hierarchy: ${path.join(' > ')}`);
    lines.push(
      `World position: {x: ${worldPosition.x.toFixed(3)}, y: ${worldPosition.y.toFixed(
        3
      )}, z: ${worldPosition.z.toFixed(3)}}`
    );
    if (tag?.boardCoords) {
      lines.push(
        `Board coords: { ring: ${tag.boardCoords.ring}, level: ${tag.boardCoords.level}, height: ${tag.boardCoords.height} }`
      );
    }
    if (tag?.hallSection) {
      lines.push(
        `Hall section: { ring: ${tag.hallSection.ring}, segmentIndex: ${tag.hallSection.segmentIndex}${
          tag.hallSection.levelBand ? `, levelBand: ${tag.hallSection.levelBand}` : ''
        } }`
      );
    }
    if (geometryInfo) {
      const verts = geometryInfo.vertexCount ?? '?';
      const idx = geometryInfo.indexCount ?? '?';
      lines.push(`Geometry: ${geometryInfo.type ?? 'BufferGeometry'} (vertices=${verts}, indices=${idx})`);
    }
    if (materialInfo) {
      lines.push(
        `Material: ${materialInfo.type ?? 'Material'}${materialInfo.name ? ` "${materialInfo.name}"` : ''} (metalness=${
          materialInfo.metalness ?? '?'
        }, roughness=${materialInfo.roughness ?? '?'}, emissive=${materialInfo.emissive ?? 'none'}, transparent=${
          materialInfo.transparent ?? false
        })`
      );
    }
    if (tag?.sourceFile || tag?.sourceModule || tag?.sourceFunction) {
      const sourceParts = [tag.sourceModule, tag.sourceFile, tag.sourceFunction].filter(Boolean);
      lines.push(`Source: ${sourceParts.join(' : ')}`);
    }
    lines.push('OBJECT_DEBUG_DUMP_END');
    return lines.join('\n');
  }
}
