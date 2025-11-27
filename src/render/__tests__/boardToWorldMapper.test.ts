import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BoardToWorldMapper, createBoardRenderConfig } from '../boardToWorldMapper';

describe('BoardToWorldMapper', () => {
  const dimensions = { width: 4, height: 5 };

  it('maps cells onto the tower circumference with default radius formula', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 2 });
    const mapper = new BoardToWorldMapper(dimensions, { blockSize: 2 });
    const expectedRadius = config.towerRadius;

    const pos = mapper.cellToWorldPosition(1, 1);

    expect(pos.x).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(expectedRadius);
    expect(pos.y).toBeCloseTo(2);
  });

  it('wraps x around the tower and validates y bounds', () => {
    const config = createBoardRenderConfig(dimensions);
    const mapper = new BoardToWorldMapper(dimensions);
    const radius = config.towerRadius;

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

  it('returns radial orientation so that +Z faces outward', () => {
    const mapper = new BoardToWorldMapper(dimensions);
    const quaternion = mapper.getRadialOrientation(1);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const expectedDir = new THREE.Vector3(
      Math.cos((2 * Math.PI * 1) / dimensions.width),
      0,
      Math.sin((2 * Math.PI * 1) / dimensions.width)
    ).normalize();

    expect(forward.angleTo(expectedDir)).toBeLessThan(1e-6);
  });
});
