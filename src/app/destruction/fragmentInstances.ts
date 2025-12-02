import { Matrix4, Quaternion, Vector3 } from 'three';
import { Fragment } from './cubeDestructionSim';

export interface FragmentInstanceUpdate {
  instanceId: number;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  fade: number;
  uvRect?: { u0: number; v0: number; u1: number; v1: number };
  colorTint?: number;
}

/**
 * Формирует список обновлений инстансов для рендера: позиция, вращение, fade.
 * Матрицы не собираем здесь, чтобы рендер сам решал, как применять (instanced mesh / shader).
 */
export function buildFragmentInstanceUpdates(
  fragments: readonly Fragment[]
): FragmentInstanceUpdate[] {
  return fragments.map((fragment) => ({
    instanceId: fragment.instanceId,
    position: fragment.position.clone(),
    rotation: fragment.rotation.clone(),
    scale: fragment.scale.clone(),
    fade: fragment.fade,
    uvRect: fragment.uvRect,
    colorTint: fragment.colorTint,
  }));
}

/**
 * Утилита для тех, кто хочет сразу получить матрицу инстанса.
 */
export function toInstanceMatrices(updates: readonly FragmentInstanceUpdate[]): Matrix4[] {
  return updates.map((u) => new Matrix4().compose(u.position, u.rotation, new Vector3(1, 1, 1)));
}
