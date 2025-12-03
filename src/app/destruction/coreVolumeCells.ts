import { Vector3 } from 'three';
import { CoreGrid } from './coreJitterGrid';
import { CUBE_LOCAL_MAX, CUBE_LOCAL_MIN } from './cubeSpace';
import { CORE_BOUNDS, CORE_Z_RANGE } from './shellLayers';

export interface VolumeCell {
  id: number;
  corners: Vector3[]; // length = 8
  center: Vector3;
  sizeHint: Vector3;
}

function nodeIndex(divisions: number, ix: number, iy: number, iz: number): number {
  const n = divisions + 1;
  return (ix * n + iy) * n + iz;
}

function computeCenter(corners: Vector3[]): Vector3 {
  const c = new Vector3();
  corners.forEach((v) => c.add(v));
  return corners.length ? c.multiplyScalar(1 / corners.length) : c;
}

function computeSizeHint(corners: Vector3[]): Vector3 {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  corners.forEach((p) => {
    min.min(p);
    max.max(p);
  });
  return max.sub(min);
}

export function buildCoreVolumeCells(grid: CoreGrid): VolumeCell[] {
  const { divisions, nodes } = grid;
  const cells: VolumeCell[] = [];
  for (let ix = 0; ix < divisions; ix += 1) {
    for (let iy = 0; iy < divisions; iy += 1) {
      for (let iz = 0; iz < divisions; iz += 1) {
        const idx000 = nodeIndex(divisions, ix, iy, iz);
        const idx100 = nodeIndex(divisions, ix + 1, iy, iz);
        const idx010 = nodeIndex(divisions, ix, iy + 1, iz);
        const idx110 = nodeIndex(divisions, ix + 1, iy + 1, iz);
        const idx001 = nodeIndex(divisions, ix, iy, iz + 1);
        const idx101 = nodeIndex(divisions, ix + 1, iy, iz + 1);
        const idx011 = nodeIndex(divisions, ix, iy + 1, iz + 1);
        const idx111 = nodeIndex(divisions, ix + 1, iy + 1, iz + 1);

        const corners = [
          nodes[idx000].clone(),
          nodes[idx100].clone(),
          nodes[idx110].clone(),
          nodes[idx010].clone(),
          nodes[idx001].clone(),
          nodes[idx101].clone(),
          nodes[idx111].clone(),
          nodes[idx011].clone(),
        ];
        const center = computeCenter(corners);
        const sizeHint = computeSizeHint(corners);
        cells.push({ id: cells.length, corners, center, sizeHint });
      }
    }
  }
  return cells;
}

export function validateVolumeCells(cells: VolumeCell[]): { ok: boolean; outOfBounds: number } {
  let outOfBounds = 0;
  cells.forEach((cell) => {
    cell.corners.forEach((p) => {
      if (
        p.x < CORE_BOUNDS[0] - 1e-3 ||
        p.x > CORE_BOUNDS[1] + 1e-3 ||
        p.y < CORE_BOUNDS[0] - 1e-3 ||
        p.y > CORE_BOUNDS[1] + 1e-3 ||
        p.z < CORE_Z_RANGE[0] - 1e-3 ||
        p.z > CORE_Z_RANGE[1] + 1e-3
      ) {
        outOfBounds += 1;
      }
    });
  });
  return { ok: outOfBounds === 0, outOfBounds };
}
