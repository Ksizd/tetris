import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { createBoardRenderConfig } from '../boardConfig';
import { BoardToWorldMapper } from '../boardToWorldMapper';
import { createTowerFootprintDecor, getFootprintRadius } from '../towerFootprint';
import { createDefaultHallLayoutConfig, computeHallLayout } from '../hallLayout';
import { computePlatformLayout } from '../platformLayout';

describe('towerFootprint invariants (15.3.0)', () => {
  const dimensions = { ...DEFAULT_BOARD_DIMENSIONS, height: 2 };
  const boardConfig = createBoardRenderConfig(dimensions);

  it('aligns cell center (row 0) to the center of its footprint sector', () => {
    const mapper = new BoardToWorldMapper(dimensions, boardConfig);
    const footprint = createTowerFootprintDecor({ dimensions, board: boardConfig });
    const ringMesh = footprint.group.getObjectByName('towerFootprintBase') as
      | THREE.Mesh<THREE.RingGeometry>
      | null;
    expect(ringMesh).toBeTruthy();
    const { innerRadius, outerRadius } = (ringMesh!.geometry as THREE.RingGeometry).parameters;

    const x = 3;
    const worldPos = mapper.cellToWorldPosition(x, 0);
    const radius = Math.hypot(worldPos.x, worldPos.z);
    expect(radius).toBeGreaterThan(innerRadius - 1e-5);
    expect(radius).toBeLessThan(outerRadius + 1e-5);

    const angle = Math.atan2(worldPos.z, worldPos.x);
    const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
    const step = (Math.PI * 2) / dimensions.width;
    const expectedCenter = step * x;
    expect(normalizedAngle).toBeCloseTo(expectedCenter, 6);
  });

  it('remains a visual-only layer (does not mutate board render config)', () => {
    const snapshot = { ...boardConfig };
    createTowerFootprintDecor({ dimensions, board: boardConfig });
    expect(boardConfig).toEqual(snapshot);
  });

  it('sits slightly above the platform top to avoid z-fighting', () => {
    const footprint = createTowerFootprintDecor({ dimensions, board: boardConfig });
    const ringMesh = footprint.group.getObjectByName('towerFootprintBase') as
      | THREE.Mesh<THREE.RingGeometry>
      | null;
    expect(ringMesh).toBeTruthy();
    const hallLayout = computeHallLayout(
      {
        towerOuterRadius: boardConfig.towerRadius + boardConfig.blockDepth * 0.5,
        cameraOrbitRadius: (boardConfig.towerRadius + boardConfig.blockDepth * 0.5) * 2,
      },
      createDefaultHallLayoutConfig(boardConfig.blockSize)
    );
    const platformLayout = computePlatformLayout(hallLayout, boardConfig);
    const platformTop = platformLayout.baseY + platformLayout.ringA.height;
    expect(ringMesh!.position.y).toBeGreaterThan(platformTop);
  });

  it('getFootprintRadius matches outer radius used in footprint geometry', () => {
    const footprint = createTowerFootprintDecor({ dimensions, board: boardConfig });
    const ringMesh = footprint.group.getObjectByName('towerFootprintBase') as
      | THREE.Mesh<THREE.RingGeometry>
      | null;
    expect(ringMesh).toBeTruthy();
    const expectedRadius = getFootprintRadius(boardConfig);
    const outerRadius = (ringMesh!.geometry as THREE.RingGeometry).parameters.outerRadius;
    expect(outerRadius).toBeCloseTo(expectedRadius, 6);
  });
});
