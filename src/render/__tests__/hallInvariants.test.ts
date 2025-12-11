import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRenderConfig } from '../renderConfig';
import { computeGoldenHallLayout } from '../goldenHallLayout';
import { getTowerBounds } from '../towerBounds';
import { evaluateHallInvariantStatus, measureHallInvariants } from '../hallInvariants';

describe('hall invariants (15.1.0)', () => {
  it('reads radii without mutating the camera and highlights current clearance', () => {
    const config = createRenderConfig();
    const layout = computeGoldenHallLayout(
      config.boardDimensions,
      config.board,
      config.goldenHall
    );
    const bounds = getTowerBounds(config.boardDimensions, config.board);
    const cameraBefore = config.camera.position.clone();

    const snapshot = measureHallInvariants({
      towerBounds: bounds,
      hallLayout: layout,
      cameraPosition: config.camera.position,
    });

    expect(config.camera.position.equals(cameraBefore)).toBe(true);
    expect(snapshot.hallInnerRadius).toBeGreaterThan(snapshot.towerOuterRadius);
    expect(snapshot.towerClearance).toBeGreaterThan(0);
    expect(snapshot.cameraOrbitRadius).toBeGreaterThan(0);

    const status = evaluateHallInvariantStatus(snapshot);
    expect(status.hallContainsTower).toBe(true);
    // Baseline: current hall layout still sits inside the camera orbit and needs redesign in 15.1.x.
    expect(status.hallContainsCamera).toBe(false);
  });

  it('uses the tower center when projecting the camera orbit radius', () => {
    const towerBounds = {
      center: new THREE.Vector3(5, 0, -3),
      radius: 2,
      minY: 0,
      maxY: 1,
    };
    const hallLayout = {
      footprint: {
        towerRadius: 4,
        outerRadius: 5,
        innerRadius: 3.5,
        height: 1,
        blockSize: 1,
        columnCount: 6,
      },
      base: {
        outerRadius: 5,
        height: 1,
        stepCount: 1,
        stepInsetRatio: 0.1,
        topY: 0,
        bottomY: -1,
      },
      hallRadius: 9,
      wallHeight: 3,
      wallCurvatureSegments: 16,
    } as const;
    const cameraPosition = new THREE.Vector3(8, 2, -3);

    const snapshot = measureHallInvariants({
      towerBounds,
      hallLayout,
      cameraPosition,
    });
    expect(snapshot.cameraOrbitRadius).toBeCloseTo(3);
    expect(snapshot.hallInnerRadius).toBeCloseTo(9);
    expect(snapshot.towerOuterRadius).toBeCloseTo(5);
  });
});
