import { describe, expect, it } from 'vitest';
import { composeInitialVelocity, computeVelocityBasis } from '../fragmentVelocity';
import { Vector3 } from 'three';

describe('fragmentVelocity', () => {
  it('computes outward and tangent basis', () => {
    const cubePos = new Vector3(1, 0, 0);
    const center = new Vector3(0, 0, 0);
    const { outward, tangent, up } = computeVelocityBasis(cubePos, center);
    expect(outward.x).toBeCloseTo(1);
    expect(outward.length()).toBeCloseTo(1);
    expect(tangent.z).toBeCloseTo(-1); // up x outward = tangent
    expect(tangent.length()).toBeCloseTo(1);
    expect(up.y).toBeCloseTo(1);
  });

  it('composes velocity from radial and tangential speeds', () => {
    const cubePos = new Vector3(0, 0, 2);
    const center = new Vector3(0, 0, 0);
    const velocity = composeInitialVelocity(cubePos, center, {
      radialSpeed: 5,
      tangentialSpeed: 2,
      upSpeed: 3,
      jitterStrength: 0,
    });
    // outward along +Z -> radial contributes (0,0,5)
    expect(velocity.z).toBeCloseTo(5);
    // tangent for +Z with up (0,1,0) => along +X
    expect(velocity.x).toBeCloseTo(2);
    expect(velocity.y).toBeCloseTo(3);
  });

  it('scales speed down with higher mass (1/sqrt(m))', () => {
    const cubePos = new Vector3(0, 0, 1);
    const center = new Vector3(0, 0, 0);
    const light = composeInitialVelocity(cubePos, center, {
      radialSpeed: 10,
      tangentialSpeed: 0,
      upSpeed: 0,
      mass: 1,
      jitterStrength: 0,
    });
    const heavy = composeInitialVelocity(cubePos, center, {
      radialSpeed: 10,
      tangentialSpeed: 0,
      upSpeed: 0,
      mass: 4,
      jitterStrength: 0,
    });
    expect(heavy.length()).toBeCloseTo(light.length() * 0.5);
  });
});
