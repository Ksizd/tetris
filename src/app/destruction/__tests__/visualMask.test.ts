import { describe, expect, it } from 'vitest';
import { getHiddenCubeIds, getWholeCubesToRender } from '../visualMask';
import { RowDestructionSim, createCubeExplosionSlot } from '../rowDestructionSim';
import { CubeVisual } from '../../../render';
import { Vector3 } from 'three';
import { startCubeExplosion } from '../explosionLifecycle';
import { ULTRA_DESTRUCTION_PRESET } from '../destructionPresets';
import { DEFAULT_DESTRUCTION_QUALITY } from '../destructionQuality';

function makeRow(): RowDestructionSim {
  const cubes: CubeVisual[] = [
    { id: { x: 0, y: 0 }, worldPos: new Vector3() },
    { id: { x: 1, y: 0 }, worldPos: new Vector3(1, 0, 0) },
  ];
  return {
    level: 0,
    cubes,
    explosions: [createCubeExplosionSlot(0, 0), createCubeExplosionSlot(1, 100)],
    allCubesExploded: false,
    cubeSize: { sx: 1, sy: 1, sz: 1 },
    preset: ULTRA_DESTRUCTION_PRESET,
    quality: DEFAULT_DESTRUCTION_QUALITY,
  };
}

describe('visualMask', () => {
  it('returns whole cubes before their explosions start', () => {
    const row = makeRow();
    const visible = getWholeCubesToRender(row);
    expect(visible.map((c) => c.id.x)).toEqual([0, 1]);
    expect(getHiddenCubeIds(row).size).toBe(0);
  });

  it('hides cube once its explosion started', () => {
    const row = makeRow();
    startCubeExplosion(row, 0, 0);
    const visible = getWholeCubesToRender(row);
    expect(visible.map((c) => c.id.x)).toEqual([1]);
    const hidden = getHiddenCubeIds(row);
    expect(hidden.has('0:0')).toBe(true);
    expect(hidden.has('1:0')).toBe(false);
  });
});
