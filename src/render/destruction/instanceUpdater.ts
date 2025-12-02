import { Color, InstancedMesh, Matrix4, Object3D, InstancedBufferAttribute, Vector3 } from 'three';
import { FragmentInstanceUpdate } from '../../app/destruction/fragmentInstances';

const dummy = new Object3D();
const tmpColor = new Color();
const tmpScale = new Vector3(1, 1, 1);

/**
 * Применяет обновления инстансов фрагментов к InstancedMesh (позиция, вращение, fade -> color/opacity).
 * fade сейчас прокидываем только через цветовую альфу; шейдерный канал должен поддерживать.
 */
export function applyFragmentInstanceUpdates(
  mesh: InstancedMesh,
  updates: readonly FragmentInstanceUpdate[],
  baseColor?: { r: number; g: number; b: number }
): void {
  const tintAttr = mesh.geometry.getAttribute('instanceTint') as InstancedBufferAttribute | undefined;
  const uvAttr = mesh.geometry.getAttribute('instanceUvRect') as InstancedBufferAttribute | undefined;
  for (const update of updates) {
    dummy.position.copy(update.position);
    dummy.quaternion.copy(update.rotation);
    dummy.scale.copy(update.scale ?? tmpScale);
    dummy.updateMatrix();
    mesh.setMatrixAt(update.instanceId, dummy.matrix as Matrix4);

    if (tintAttr && tintAttr.itemSize === 4) {
      const colorBase = baseColor ?? { r: 1, g: 1, b: 1 };
      const tint = (update.colorTint ?? 1) * update.fade;
      tintAttr.setXYZW(update.instanceId, colorBase.r * tint, colorBase.g * tint, colorBase.b * tint, 1);
    }

    if (uvAttr && uvAttr.itemSize === 4) {
      const u = update.uvRect;
      const u0 = u?.u0 ?? 0;
      const v0 = u?.v0 ?? 0;
      const u1 = u?.u1 ?? 1;
      const v1 = u?.v1 ?? 1;
      uvAttr.setXYZW(update.instanceId, u0, v0, u1, v1);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (tintAttr) {
    tintAttr.needsUpdate = true;
  }
  if (uvAttr) {
    uvAttr.needsUpdate = true;
  }
}
