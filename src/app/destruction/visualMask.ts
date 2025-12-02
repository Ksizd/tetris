import { CubeVisual } from '../../render';
import { RowDestructionSim } from './rowDestructionSim';
import { shouldRenderWholeCube } from './explosionLifecycle';

export function getWholeCubesToRender(row: RowDestructionSim): CubeVisual[] {
  return row.cubes.filter((_, idx) => shouldRenderWholeCube(row, idx));
}

export function getHiddenCubeIds(row: RowDestructionSim): Set<string> {
  const hidden = new Set<string>();
  row.cubes.forEach((cube, idx) => {
    if (!shouldRenderWholeCube(row, idx)) {
      hidden.add(`${cube.id.x}:${cube.id.y}`);
    }
  });
  return hidden;
}
