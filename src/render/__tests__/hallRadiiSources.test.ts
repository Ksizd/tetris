import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computeGoldenHallLayout } from '../goldenHallLayout';
import { createRenderConfig } from '../renderConfig';
import { getTowerBounds } from '../towerBounds';
import {
  captureHallRadiusSources,
  deriveTowerRadii,
  measureCameraOrbit,
  readCurrentHallRadii,
} from '../hallRadiiSources';

describe('hall radius sources (15.1.1)', () => {
  it('captures tower, camera, and hall radii without mutating config', () => {
    const config = createRenderConfig();
    const layout = computeGoldenHallLayout(
      config.boardDimensions,
      config.board,
      config.goldenHall
    );
    const bounds = getTowerBounds(config.boardDimensions, config.board);
    const cameraBefore = config.camera.position.clone();

    const snapshot = captureHallRadiusSources({
      board: config.board,
      towerBounds: bounds,
      hallLayout: layout,
      cameraPosition: config.camera.position,
    });

    expect(config.camera.position.equals(cameraBefore)).toBe(true);
    expect(snapshot.tower.center.equals(bounds.center)).toBe(true);
    expect(snapshot.tower.footprintRadius).toBeCloseTo(config.board.towerRadius);
    expect(snapshot.tower.outerRadius).toBeCloseTo(
      config.board.towerRadius + config.board.blockDepth * 0.5
    );
    expect(snapshot.camera.radius).toBeCloseTo(
      new THREE.Vector2(
        cameraBefore.x - bounds.center.x,
        cameraBefore.z - bounds.center.z
      ).length()
    );
    expect(snapshot.hall.hallRadius).toBeCloseTo(layout.hallRadius);
    expect(snapshot.hall.platformRadius).toBeCloseTo(layout.base.outerRadius);
  });

  it('measures camera orbit relative to arbitrary tower center', () => {
    const center = new THREE.Vector3(4, 0, -2);
    const camera = new THREE.Vector3(9, 5, -2);
    const orbit = measureCameraOrbit(camera, center);

    expect(orbit.radius).toBeCloseTo(5);
    expect(orbit.deltaXZ.x).toBeCloseTo(5);
    expect(orbit.deltaXZ.y).toBeCloseTo(0);
  });

  it('derives tower radii directly from board config', () => {
    const board = {
      blockSize: 1,
      blockDepth: 0.8,
      towerRadius: 6.4,
      verticalSpacing: 1,
      verticalGap: 0,
      circumferentialGap: 0.05,
      edgeRadius: 0.05,
    };
    const tower = deriveTowerRadii(board);
    expect(tower.footprintRadius).toBeCloseTo(6.4);
    expect(tower.outerRadius).toBeCloseTo(6.8);
    expect(tower.center.equals(new THREE.Vector3(0, 0, 0))).toBe(true);
  });

  it('reads hall/platform radii from layout snapshot', () => {
    const hall = readCurrentHallRadii({
      footprint: {
        towerRadius: 3,
        outerRadius: 3.5,
        innerRadius: 2.8,
        height: 4,
        blockSize: 1,
        columnCount: 8,
      },
      base: {
        outerRadius: 5,
        height: 1,
        stepCount: 2,
        stepInsetRatio: 0.1,
        topY: 0,
        bottomY: -1,
      },
      hallRadius: 7,
      wallHeight: 3,
      wallCurvatureSegments: 32,
    } as const);

    expect(hall.hallRadius).toBe(7);
    expect(hall.platformRadius).toBe(5);
  });
});
