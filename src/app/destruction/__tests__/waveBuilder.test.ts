import { describe, expect, it } from 'vitest';
import { buildLinearExplosionWave } from '../waveBuilder';
import { CubeVisual } from '../../../render';
import { Vector3 } from 'three';

function makeCubes(count: number): CubeVisual[] {
  const arr: CubeVisual[] = [];
  for (let i = 0; i < count; i += 1) {
    arr.push({
      id: { x: i, y: 0 },
      // позиция не влияет на волну, но нужна заглушка для структуры
      worldPos: new Vector3(i, 0, 0),
    });
  }
  return arr;
}

describe('buildLinearExplosionWave', () => {
  it('builds slots with linear timing and started=false', () => {
    const cubes = makeCubes(3);
    const slots = buildLinearExplosionWave({
      cubes,
      globalStartMs: 100,
      delayBetweenCubesMs: 50,
    });

    expect(slots).toEqual([
      { cubeIndex: 0, startTimeMs: 100, started: false },
      { cubeIndex: 1, startTimeMs: 150, started: false },
      { cubeIndex: 2, startTimeMs: 200, started: false },
    ]);
  });

  it('returns empty array for empty cubes list', () => {
    const slots = buildLinearExplosionWave({
      cubes: [],
      globalStartMs: 0,
      delayBetweenCubesMs: 30,
    });
    expect(slots).toEqual([]);
  });

  it('throws on non-positive delay', () => {
    expect(() =>
      buildLinearExplosionWave({
        cubes: makeCubes(1),
        globalStartMs: 0,
        delayBetweenCubesMs: 0,
      })
    ).toThrow();
  });
});
