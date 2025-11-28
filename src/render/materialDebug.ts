import * as THREE from 'three';
import { ActivePieceInstancedResources } from './activePieceInstancedMesh';
import { BoardInstancedResources } from './boardInstancedMesh';

export type MaterialDebugMode = 'none' | 'matcap' | 'flat';

interface OriginalMaterials {
  board: THREE.Material | THREE.Material[];
  active: THREE.Material | THREE.Material[];
}

export function createMaterialsSnapshot(
  board: BoardInstancedResources,
  active: ActivePieceInstancedResources
): OriginalMaterials {
  return {
    board: board.material,
    active: active.material,
  };
}

export function applyMaterialDebugMode(
  board: BoardInstancedResources,
  active: ActivePieceInstancedResources,
  mode: MaterialDebugMode,
  originals: OriginalMaterials
): void {
  if (mode === 'none') {
    board.mesh.material = originals.board;
    active.mesh.material = originals.active;
    return;
  }
  if (mode === 'matcap') {
    const matcapTex = createMatcapTexture();
    board.mesh.material = createMatcapMaterials(matcapTex);
    active.mesh.material = createMatcapMaterials(matcapTex);
    return;
  }
  // flat IDs
  board.mesh.material = createFlatMaterials();
  active.mesh.material = createFlatMaterials();
}

function createMatcapMaterials(matcap: THREE.Texture): THREE.MeshMatcapMaterial[] {
  return [
    new THREE.MeshMatcapMaterial({ matcap, color: 0xffffff, flatShading: false }),
    new THREE.MeshMatcapMaterial({ matcap, color: 0xffffff, flatShading: false }),
  ];
}

function createFlatMaterials(): THREE.MeshBasicMaterial[] {
  return [
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    new THREE.MeshBasicMaterial({ color: 0xffb347 }),
  ];
}

function createMatcapTexture(size = 256): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D context for matcap');
  }

  const grad = ctx.createRadialGradient(size * 0.4, size * 0.35, size * 0.1, size * 0.55, size * 0.6, size * 0.8);
  grad.addColorStop(0, '#fefefe');
  grad.addColorStop(0.45, '#e0e3ec');
  grad.addColorStop(0.75, '#9ea8bd');
  grad.addColorStop(1, '#4b4f5a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const rim = ctx.createRadialGradient(size * 0.8, size * 0.8, 0, size * 0.8, size * 0.8, size * 0.35);
  rim.addColorStop(0, 'rgba(255,255,255,0.4)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
