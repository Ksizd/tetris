import { describe, expect, it } from 'vitest';
import { allocateFragmentCounts } from '../fragmentCount';

describe('allocateFragmentCounts', () => {
  it('splits total with default weights and preserves sum', () => {
    const allocation = allocateFragmentCounts(20);
    expect(allocation.total).toBe(20);
    expect(allocation.smallCubes + allocation.plates + allocation.innerChunks).toBe(20);
    // default weights 0.5/0.3/0.2 => expect close to 10/6/4
    expect(allocation.smallCubes).toBe(10);
    expect(allocation.plates).toBe(6);
    expect(allocation.innerChunks).toBe(4);
  });

  it('uses custom weights and largest remainder distribution', () => {
    const allocation = allocateFragmentCounts(7, {
      smallCubes: 1,
      plates: 1,
      innerChunks: 1,
    });
    // 7 / 3 => 2,2,2 plus remainder 1 goes to first in order
    expect(allocation.smallCubes).toBe(3);
    expect(allocation.plates).toBe(2);
    expect(allocation.innerChunks).toBe(2);
    expect(allocation.smallCubes + allocation.plates + allocation.innerChunks).toBe(7);
  });

  it('throws when total is non-positive', () => {
    expect(() => allocateFragmentCounts(0)).toThrow();
  });

  it('throws when all weights are zero', () => {
    expect(() =>
      allocateFragmentCounts(5, { smallCubes: 0, plates: 0, innerChunks: 0 })
    ).toThrow();
  });
});
