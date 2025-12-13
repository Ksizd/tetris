import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { createBoardRenderConfig } from '../boardConfig';
import { computeHallLayout, createDefaultHallLayoutConfig } from '../hallLayout';
import { computePlatformLayout } from '../platformLayout';
import {
  buildFootprintCarvedRingTopGeometry,
  getFootprintCarveRingAExtraRadii,
} from '../footprintInlayGeometry';

describe('footprint inlay geometry (15.3Ω)', () => {
  const dimensions = { ...DEFAULT_BOARD_DIMENSIONS, width: 12, height: 4 };
  const board = createBoardRenderConfig(dimensions);
  const hallLayout = computeHallLayout(
    {
      towerOuterRadius: board.towerRadius + board.blockDepth * 0.5,
      cameraOrbitRadius: (board.towerRadius + board.blockDepth * 0.5) * 2,
    },
    createDefaultHallLayoutConfig(board.blockSize)
  );
  const platformLayout = computePlatformLayout(hallLayout, board);

  it('builds real 3D grooves: expected Y span and non-empty groups', () => {
    const yTop = platformLayout.baseY + platformLayout.ringA.height;
    const carve = {
      towerRadius: board.towerRadius,
      blockDepth: board.blockDepth,
      blockSize: board.blockSize,
      columns: dimensions.width,
    };
    const extra = getFootprintCarveRingAExtraRadii(carve);
    const radii = [
      platformLayout.ringA.inner,
      ...extra.filter((r) => r > platformLayout.ringA.inner + 1e-6 && r < platformLayout.ringA.outer - 1e-6),
      platformLayout.ringA.outer,
    ]
      .slice()
      .sort((a, b) => a - b)
      .filter((r, i, arr) => i === 0 || Math.abs(r - arr[i - 1]) > 1e-6);

    const carved = buildFootprintCarvedRingTopGeometry({
      ringInner: platformLayout.ringA.inner,
      ringOuter: platformLayout.ringA.outer,
      yTop,
      angularSegments: Math.max(96, dimensions.width * 12),
      radii,
      carve,
    });

    expect(carved.indicesTop.length).toBeGreaterThan(0);
    expect(carved.indicesCarve.length).toBeGreaterThan(0);
    expect(carved.indicesLava.length).toBeGreaterThan(0);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(carved.positions, 3));
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    const grooveD = Math.min(board.blockSize * 0.08, Math.max(board.blockSize * 0.04, board.blockSize * 0.08));
    expect(box.max.y).toBeCloseTo(yTop, 4);
    expect(box.min.y).toBeCloseTo(yTop - grooveD, 3);

    const R0 = carve.towerRadius - carve.blockDepth * 0.5;
    const R1 = carve.towerRadius + carve.blockDepth * 0.5;
    const grooveW = Math.min(carve.blockDepth * 0.1, Math.max(carve.blockDepth * 0.06, carve.blockDepth * 0.08));
    const grooveHalfW = grooveW * 0.5;

    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const yBottom = yTop - grooveD;
    const epsY = 1e-3;
    let hasR0 = false;
    let hasR1 = false;
    for (let i = 0; i < pos.count; i += 1) {
      const yy = pos.getY(i);
      if (Math.abs(yy - yBottom) > epsY) continue;
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      if (Math.abs(r - R0) <= grooveHalfW + grooveW * 0.35) hasR0 = true;
      if (Math.abs(r - R1) <= grooveHalfW + grooveW * 0.35) hasR1 = true;
    }
    expect(hasR0).toBe(true);
    expect(hasR1).toBe(true);
  });

  it('is not a decal: has floor and wall normals', () => {
    const yTop = platformLayout.baseY + platformLayout.ringA.height;
    const carve = {
      towerRadius: board.towerRadius,
      blockDepth: board.blockDepth,
      blockSize: board.blockSize,
      columns: dimensions.width,
    };
    const radii = [
      platformLayout.ringA.inner,
      ...getFootprintCarveRingAExtraRadii(carve).filter(
        (r) => r > platformLayout.ringA.inner + 1e-6 && r < platformLayout.ringA.outer - 1e-6
      ),
      platformLayout.ringA.outer,
    ]
      .slice()
      .sort((a, b) => a - b)
      .filter((r, i, arr) => i === 0 || Math.abs(r - arr[i - 1]) > 1e-6);

    const carved = buildFootprintCarvedRingTopGeometry({
      ringInner: platformLayout.ringA.inner,
      ringOuter: platformLayout.ringA.outer,
      yTop,
      angularSegments: Math.max(96, dimensions.width * 12),
      radii,
      carve,
    });

    const grooveD = Math.min(board.blockSize * 0.08, Math.max(board.blockSize * 0.04, board.blockSize * 0.08));
    const yBottom = yTop - grooveD;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(carved.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(carved.normals, 3));

    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;

    const epsY = 1e-3;
    let hasFloorUp = false;
    let hasWall = false;
    for (let i = 0; i < pos.count; i += 1) {
      const yy = pos.getY(i);
      const ny = normal.getY(i);
      if (Math.abs(yy - yBottom) <= epsY && ny > 0.9) {
        hasFloorUp = true;
      }
      if (yy > yBottom + epsY && yy < yTop - epsY && ny < 0.8) {
        hasWall = true;
      }
      if (hasFloorUp && hasWall) break;
    }

    expect(hasFloorUp).toBe(true);
    expect(hasWall).toBe(true);
  });
});
