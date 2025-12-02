import { describe, expect, it } from 'vitest';
import { generateAngularVelocity, randomVectorWithinSphere } from '../fragmentAngular';
import { Vector3 } from 'three';

describe('fragmentAngular', () => {
  it('randomVectorWithinSphere respects magnitude range', () => {
    const vec = randomVectorWithinSphere({ min: 1, max: 3 }, () => 0.5);
    expect(vec.length()).toBeCloseTo(2); // mid of 1..3
  });

  it('randomVectorWithinSphere returns zero when max is zero', () => {
    const vec = randomVectorWithinSphere({ min: 0, max: 0 });
    expect(vec.equals(new Vector3(0, 0, 0))).toBe(true);
  });

  it('generateAngularVelocity uses material-specific range and randomFn', () => {
    // deterministic randoms: u=0 -> theta=0, v=0 -> z=-1, t=0.5 => magnitude mid
    let calls = 0;
    const rng = () => {
      calls += 1;
      return calls === 1 ? 0 : calls === 2 ? 0 : 0.5;
    };
    const vec = generateAngularVelocity('face', {
      ranges: { face: { min: 4, max: 8 } },
      randomFn: rng,
    });
    // direction along -Z, magnitude 6 => (0,0,-6)
    expect(vec.x).toBeCloseTo(0);
    expect(vec.y).toBeCloseTo(0);
    expect(vec.z).toBeCloseTo(-6);
  });

  it('throws on invalid range', () => {
    expect(() => randomVectorWithinSphere({ min: 3, max: 2 })).toThrow();
  });
});
