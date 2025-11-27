import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  computeCameraPlacement,
  computeTowerHeight,
  DEFAULT_CAMERA_FOV,
  recomputeCameraPlacementForFrame,
} from '../cameraSetup';
import { createBoardRenderConfig } from '../boardConfig';

describe('cameraSetup', () => {
  const dimensions = { width: 6, height: 10 };

  it('computes tower height from dimensions and spacing', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 2, verticalSpacing: 3 });
    expect(computeTowerHeight(dimensions, config)).toBe((dimensions.height - 1) * 3 + 2);
  });

  it('places camera outside tower radius and looks at center', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 2 });
    const placement = computeCameraPlacement(dimensions, config);

    const distanceXZ = Math.hypot(placement.position.x, placement.position.z);
    expect(distanceXZ).toBeGreaterThan(config.towerRadius);
    expect(placement.target.x).toBeCloseTo(0);
    expect(placement.target.z).toBeCloseTo(0);
    const towerHeight = (dimensions.height - 1) * config.verticalSpacing + config.blockSize;
    expect(placement.target.y).toBeCloseTo(towerHeight * 0.55, 1);

    // Camera height ratio should be around 0.62 of tower height
    expect(placement.position.y / towerHeight).toBeGreaterThan(0.55);
    expect(placement.position.y / towerHeight).toBeLessThan(0.7);

    // Top and bottom must lie within the vertical fov cone
    const fovRad = (DEFAULT_CAMERA_FOV * Math.PI) / 180;
    const dir = placement.target.clone().sub(placement.position).normalize();
    const topVector = new THREE.Vector3(0, towerHeight, 0).sub(placement.position).normalize();
    const bottomVector = new THREE.Vector3(0, 0, 0).sub(placement.position).normalize();
    const angleToTop = dir.angleTo(topVector);
    const angleToBottom = dir.angleTo(bottomVector);
    const maxAngle = Math.max(angleToTop, angleToBottom);
    expect(maxAngle).toBeLessThan((fovRad / 2) * 1.12);
  });

  it('responds to fov overrides when computing camera distance', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 1.5 });
    const narrow = computeCameraPlacement(dimensions, config, { fovDeg: 30 });
    const wide = computeCameraPlacement(dimensions, config, { fovDeg: 70 });

    expect(narrow.position.length()).toBeGreaterThan(wide.position.length());
  });

  it('recomputes distance on demand to keep tower framed', () => {
    const config = createBoardRenderConfig(dimensions, { blockSize: 2 });
    const towerHeight = computeTowerHeight(dimensions, config);
    const target = new THREE.Vector3(0, towerHeight * 0.55, 0);
    const tooClosePlacement = {
      position: new THREE.Vector3(2, towerHeight * 0.62, 2),
      target,
    };

    const adjusted = recomputeCameraPlacementForFrame(dimensions, config, tooClosePlacement, 38);
    const originalHorizontal = Math.hypot(
      tooClosePlacement.position.x - target.x,
      tooClosePlacement.position.z - target.z
    );
    const adjustedHorizontal = Math.hypot(
      adjusted.position.x - adjusted.target.x,
      adjusted.position.z - adjusted.target.z
    );

    expect(adjustedHorizontal).toBeGreaterThan(originalHorizontal);
    expect(adjusted.target.y).toBeCloseTo(target.y);
    expect(adjusted.position.y).toBeCloseTo(tooClosePlacement.position.y);
  });
});
