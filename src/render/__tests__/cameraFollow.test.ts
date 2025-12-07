import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { updateGameCamera, CameraFollowState } from '../cameraMotion';
import { TowerBounds } from '../towerBounds';
function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 100);
  camera.position.set(5, 5, 5);
  camera.lookAt(new THREE.Vector3(0, 5, 0));
  return camera;
}

const basePlacement = {
  position: new THREE.Vector3(8, 6, 0),
  target: new THREE.Vector3(0, 5, 0),
};

const bounds: TowerBounds = {
  center: new THREE.Vector3(0, 0, 0),
  radius: 3,
  minY: 0,
  maxY: 12,
};

describe('camera follow', () => {
  it('aligns to column 0 and looks at tower center', () => {
    const camera = createCamera();
    const follow: CameraFollowState = { enabled: true, columnIndex: 0, width: 10 };

    updateGameCamera(camera, basePlacement, bounds, follow, 16);

    const angle = Math.atan2(camera.position.z - bounds.center.z, camera.position.x - bounds.center.x);
    expect(angle).toBeCloseTo(0, 2);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const toCenter = bounds.center
      .clone()
      .setY(basePlacement.target.y)
      .sub(camera.position)
      .normalize();
    expect(direction.x).toBeCloseTo(toCenter.x, 3);
    expect(direction.y).toBeCloseTo(toCenter.y, 3);
    expect(direction.z).toBeCloseTo(toCenter.z, 3);
  });

  it('steps toward opposite column with smoothing', () => {
    const camera = createCamera();
    // Start on +X side, target pi (opposite column)
    const follow: CameraFollowState = { enabled: true, columnIndex: 5, width: 10 };

    updateGameCamera(camera, basePlacement, bounds, follow, 16);

    const angle = Math.atan2(camera.position.z - bounds.center.z, camera.position.x - bounds.center.x);
    expect(angle).toBeGreaterThan(0.05);
    expect(angle).toBeLessThan(Math.PI - 0.05);
  });
});
