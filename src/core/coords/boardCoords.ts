import { BoardDimensions, CellCoord } from '../types';

/**
 * Приводит x к диапазону [0, width) с учётом циклической обёртки по окружности.
 */
export function wrapX(x: number, width: number): number {
  if (width <= 0) {
    throw new Error('Board width must be positive for wrapX');
  }
  const mod = x % width;
  if (mod === 0) {
    return 0; // нормализуем -0 в 0 для стабильного сравнения
  }
  return mod < 0 ? mod + width : mod;
}

/**
 * Проверяет валидность координат с учётом высоты и циклической обёртки по x.
 */
export function isInsideBoard(coord: CellCoord, dimensions: BoardDimensions): boolean {
  const { width, height } = dimensions;
  if (height <= 0 || width <= 0) {
    return false;
  }
  const normalizedX = wrapX(coord.x, width);
  return normalizedX >= 0 && normalizedX < width && coord.y >= 0 && coord.y < height;
}

/**
 * Возвращает соседей (влево/вправо/вверх/вниз) для цилиндрического поля.
 * Для x применяется обёртка, для y — проверка границ.
 */
export function getNeighbors(
  coord: CellCoord,
  dimensions: BoardDimensions
): Partial<{
  left: CellCoord;
  right: CellCoord;
  up: CellCoord;
  down: CellCoord;
}> {
  const { width, height } = dimensions;
  const neighbors: Partial<Record<'left' | 'right' | 'up' | 'down', CellCoord>> = {};

  if (width > 0) {
    neighbors.left = { x: wrapX(coord.x - 1, width), y: coord.y };
    neighbors.right = { x: wrapX(coord.x + 1, width), y: coord.y };
  }

  if (coord.y > 0) {
    neighbors.down = { x: coord.x, y: coord.y - 1 };
  }

  if (coord.y + 1 < height) {
    neighbors.up = { x: coord.x, y: coord.y + 1 };
  }

  return neighbors;
}
