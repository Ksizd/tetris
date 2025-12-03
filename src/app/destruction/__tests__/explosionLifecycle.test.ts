import { describe, expect, it } from 'vitest';
import { startCubeExplosion, shouldRenderWholeCube } from '../explosionLifecycle';
import { RowDestructionSim, createCubeExplosionSlot } from '../rowDestructionSim';
import { CubeVisual } from '../../../render';
import { Vector3 } from 'three';
import { ULTRA_DESTRUCTION_PRESET } from '../destructionPresets';
import { DEFAULT_DESTRUCTION_QUALITY } from '../destructionQuality';

function makeRowSim(): RowDestructionSim {
  const cubes: CubeVisual[] = [
    { id: { x: 0, y: 1 }, worldPos: new Vector3(0, 0, 0) },
    { id: { x: 1, y: 1 }, worldPos: new Vector3(1, 0, 0) },
  ];
  return {
    level: 1,
    cubes,
    explosions: [createCubeExplosionSlot(0, 100), createCubeExplosionSlot(1, 150)],
    allCubesExploded: false,
    cubeSize: { sx: 1, sy: 1, sz: 1 },
    preset: ULTRA_DESTRUCTION_PRESET,
    quality: DEFAULT_DESTRUCTION_QUALITY,
  };
}

describe('explosionLifecycle', () => {
  it('should render whole cube before its slot started', () => {
    const row = makeRowSim();
    expect(shouldRenderWholeCube(row, 0)).toBe(true);
    expect(shouldRenderWholeCube(row, 1)).toBe(true);
  });

  it('startCubeExplosion marks slot started and returns sim', () => {
    const row = makeRowSim();
    const sim = startCubeExplosion(row, 1, 200);

    const slot = row.explosions.find((s) => s.cubeIndex === 1);
    expect(slot?.started).toBe(true);
    expect(sim.cube).toBe(row.cubes[1]);
    expect(sim.startedAtMs).toBe(200);
    expect(sim.fragments.length).toBeGreaterThan(0);
  });

  it('shouldRenderWholeCube returns false after start', () => {
    const row = makeRowSim();
    startCubeExplosion(row, 0, 120);
    expect(shouldRenderWholeCube(row, 0)).toBe(false);
  });

  it('throws if slot missing', () => {
    const row = makeRowSim();
    expect(() => startCubeExplosion(row, 5, 0)).toThrow();
  });
});
