import { describe, expect, it } from 'vitest';
import { BoardToWorldMapper, calculateTowerRadius } from '../boardToWorldMapper';

describe('BoardToWorldMapper', () => {
  const dimensions = { width: 4, height: 5 };

  it('maps cells onto the tower circumference with default radius formula', () => {
    const mapper = new BoardToWorldMapper(dimensions, { blockSize: 2 });
    const expectedRadius = calculateTowerRadius(dimensions.width, 2);

    const pos = mapper.cellToWorldPosition(1, 1);

    expect(pos.x).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(expectedRadius);
    expect(pos.y).toBeCloseTo(2);
  });

  it('wraps x around the tower and validates y bounds', () => {
    const mapper = new BoardToWorldMapper(dimensions);
    const radius = calculateTowerRadius(dimensions.width, 1);

    const pos = mapper.cellToWorldPosition(-1, dimensions.height - 1);

    expect(pos.x).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(-radius);
    expect(pos.y).toBeCloseTo(dimensions.height - 1);

    expect(() => mapper.cellToWorldPosition(0, -1)).toThrow(RangeError);
    expect(() => mapper.cellToWorldPosition(0, dimensions.height)).toThrow(RangeError);
  });

  it('rejects non-integer coordinates', () => {
    const mapper = new BoardToWorldMapper(dimensions);
    expect(() => mapper.cellToWorldPosition(0.5, 0)).toThrow(TypeError);
    expect(() => mapper.cellToWorldPosition(0, 1.2)).toThrow(TypeError);
  });
});
