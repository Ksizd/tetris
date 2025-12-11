import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ObjectInspector } from '../objectInspector';
import { DebugTag } from '../objectInspectorTypes';

function createInspector(scene: THREE.Scene, camera: THREE.Camera): ObjectInspector {
  return new ObjectInspector({
    scene,
    camera,
    renderMode: { kind: 'visualDebug', showGuides: true, showDebugRing: true, showColliders: true },
    domElement: document.createElement('div'),
  });
}

describe('objectInspector picking (16.8)', () => {
  it('builds debug info for a simple Mesh with debugTag', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    const tag: DebugTag = {
      kind: 'towerCell',
      boardCoords: { ring: 0, level: 0, height: 0 },
      sourceFile: 'src/render/boardRenderer.ts',
      sourceFunction: 'renderBoard',
    };
    mesh.userData.debugTag = tag;
    scene.add(mesh);

    const inspector = createInspector(scene, camera);
    const result = inspector.pick(0, 0);
    expect(result.info).toBeTruthy();
    expect(result.info?.debugTag?.kind).toBe('towerCell');
    expect(result.info?.geometryInfo?.vertexCount).toBeGreaterThan(0);
    expect(result.info?.materialInfo?.type).toBe('MeshStandardMaterial');
    expect(result.info?.summaryForLLM).toMatch(/OBJECT_DEBUG_DUMP_BEGIN/);
  });

  it('records instanceId for InstancedMesh hit', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const inst = new THREE.InstancedMesh(geom, mat, 1);
    const m = new THREE.Matrix4().identity();
    inst.setMatrixAt(0, m);
    inst.userData.instanceDebugTag = { kind: 'fragment', fragmentInfo: { shardTemplateId: 1, instanceId: 0 } };
    scene.add(inst);

    const inspector = createInspector(scene, camera);
    const result = inspector.pick(0, 0);
    expect(result.info).toBeTruthy();
    expect(result.info?.instanceId).toBe(0);
    expect(result.info?.debugTag?.kind).toBe('fragment');
    expect(result.info?.summaryForLLM).toMatch(/fragment/);
  });
});
