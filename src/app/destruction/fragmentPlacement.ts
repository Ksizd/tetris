import { Vector3 } from 'three';
import { CubeVisual } from '../../render';

export interface CubeSize {
  sx: number;
  sy: number;
  sz: number;
}

function ensurePositiveSize(size: CubeSize): void {
  if (size.sx <= 0 || size.sy <= 0 || size.sz <= 0) {
    throw new Error('CubeSize must be positive in all dimensions');
  }
}

/**
 * Сэмплирует точку строго внутри объёма куба (равномерно по объёму) относительно центра cube.worldPos.
 * Вектор локального смещения = random(-0.5..0.5) * size по каждой оси.
 */
export function sampleFragmentPositionInsideCube(
  cube: CubeVisual,
  size: CubeSize,
  randomFn: () => number = Math.random
): Vector3 {
  ensurePositiveSize(size);
  const randomCentered = () => randomFn() - 0.5;
  const local = new Vector3(
    randomCentered() * size.sx,
    randomCentered() * size.sy,
    randomCentered() * size.sz
  );
  return cube.worldPos.clone().add(local);
}
