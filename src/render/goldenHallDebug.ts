import * as THREE from 'three';
import { GOLDEN_HALL_NODE_NAMES } from './goldenHallEnvironment';

export type HallMaterialPreviewMode = 'off' | 'albedo' | 'roughness' | 'metalness';

const ORIGINAL_MATERIALS = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();

function restoreMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      const original = ORIGINAL_MATERIALS.get(mesh);
      if (original) {
        mesh.material = original;
      }
    }
  });
}

function createPreviewMaterial(original: THREE.Material, mode: HallMaterialPreviewMode): THREE.Material {
  const std = original as THREE.MeshStandardMaterial;
  const baseColor =
    mode === 'albedo'
      ? std.color ?? new THREE.Color(0xffffff)
      : new THREE.Color(
          mode === 'roughness' ? std.roughness ?? 0.5 : std.metalness ?? 0,
          mode === 'roughness' ? std.roughness ?? 0.5 : std.metalness ?? 0,
          mode === 'roughness' ? std.roughness ?? 0.5 : std.metalness ?? 0
        );
  const mat = new THREE.MeshBasicMaterial({
    color: baseColor,
    side: std.side ?? THREE.FrontSide,
    transparent: false,
  });
  mat.name = `hall-preview-${mode}`;
  return mat;
}

export function applyHallMaterialPreview(
  scene: THREE.Scene,
  mode: HallMaterialPreviewMode = 'off'
): void {
  const hallRoot = scene.getObjectByName(GOLDEN_HALL_NODE_NAMES.root);
  if (!hallRoot) return;

  if (mode === 'off') {
    restoreMaterials(hallRoot);
    return;
  }

  hallRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!ORIGINAL_MATERIALS.has(mesh)) {
      ORIGINAL_MATERIALS.set(mesh, mesh.material);
    }
    mesh.material = createPreviewMaterial(mesh.material as THREE.Material, mode);
  });
}
