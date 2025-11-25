import { BoardDimensions, CellContent, CellCoord } from '../types';
import { wrapX } from '../coords';

/**
 * Хранит состояние цилиндрического поля.
 * Логика фигур/гравитации появится на следующих этапах.
 */
export class Board {
  private readonly dimensions: BoardDimensions;
  private readonly cells: CellContent[];

  /**
   * Внутренний конструктор. Для создания пустой доски будет фабрика (этап 2.3.2).
   */
  private constructor(dimensions: BoardDimensions, cells: CellContent[]) {
    this.dimensions = dimensions;
    this.cells = cells;
  }

  /**
   * Создать пустую доску с заданными размерами.
   */
  static createEmpty(dimensions: BoardDimensions): Board {
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      throw new Error('Board dimensions must be positive');
    }
    const size = dimensions.width * dimensions.height;
    const cells = new Array<CellContent>(size).fill(CellContent.Empty);
    return new Board(dimensions, cells);
  }

  /**
   * Временная вспомогательная фабрика для будущих шагов, ожидает корректный массив.
   */
  static unsafeFromCells(dimensions: BoardDimensions, cells: CellContent[]): Board {
    return new Board(dimensions, cells);
  }

  getDimensions(): BoardDimensions {
    return this.dimensions;
  }

  getCell(coord: CellCoord): CellContent {
    return this.cells[this.toIndex(coord)];
  }

  setCell(coord: CellCoord, content: CellContent): void {
    this.cells[this.toIndex(coord)] = content;
  }

  isLayerFull(_y: number): boolean {
    const y = this.ensureValidRow(_y);
    const { width } = this.dimensions;
    const start = y * width;
    for (let i = 0; i < width; i += 1) {
      if (this.cells[start + i] === CellContent.Empty) {
        return false;
      }
    }
    return true;
  }

  clearLayer(_y: number): void {
    const y = this.ensureValidRow(_y);
    const { width } = this.dimensions;
    const start = y * width;
    for (let i = 0; i < width; i += 1) {
      this.cells[start + i] = CellContent.Empty;
    }
  }

  clone(): Board {
    return new Board(this.dimensions, [...this.cells]);
  }

  private toIndex(coord: CellCoord): number {
    const { width, height } = this.dimensions;
    if (coord.y < 0 || coord.y >= height) {
      throw new RangeError(`Y coordinate out of bounds: ${coord.y}`);
    }
    const normalizedX = wrapX(coord.x, width);
    return coord.y * width + normalizedX;
  }

  private ensureValidRow(y: number): number {
    const { height } = this.dimensions;
    if (y < 0 || y >= height) {
      throw new RangeError(`Row out of bounds: ${y}`);
    }
    return y;
  }
}
