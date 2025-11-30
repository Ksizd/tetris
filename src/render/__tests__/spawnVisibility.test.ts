import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PieceOrientation, PieceType } from '../../core/types';
import { DEFAULT_BOARD_DIMENSIONS } from '../../core/constants/board';
import { getWorldBlocks } from '../../core/piece';
import { createBoardRenderConfig } from '../boardConfig';
import { BoardToWorldMapper } from '../boardToWorldMapper';
import { createRenderConfig } from '../renderConfig';
import { getTowerBounds } from '../towerBounds';
import { computeGameCameraPose, computeTowerBoundingSphere } from '../cameraSetup';

function computeCameraNear(bounds: ReturnType<typeof getTowerBounds>, blockSize: number, cameraPos: THREE.Vector3) {
  const sphere = computeTowerBoundingSphere(bounds);
  const distanceToCenter = cameraPos.distanceTo(sphere.center);
  const clearance = distanceToCenter - sphere.radius - blockSize * 0.5;
  return Math.max(0.05, Math.min(clearance, 2));
}

describe('spawn visibility', () => {
  it('renders all spawn blocks within tower bounds and camera frustum', () => {
    const aspect = 16 / 9;
    const renderConfig = createRenderConfig({}, aspect);
    const { boardDimensions } = renderConfig;
    const boardConfig = createBoardRenderConfig(boardDimensions, renderConfig.board);
    const mapper = new BoardToWorldMapper(boardDimensions, boardConfig);
    const bounds = getTowerBounds(boardDimensions, boardConfig);
    const pose = computeGameCameraPose(bounds, aspect, { fovDeg: renderConfig.camera.fov });

    const camera = new THREE.PerspectiveCamera(
      renderConfig.camera.fov,
      aspect,
      computeCameraNear(bounds, boardConfig.blockSize, pose.position),
      2000
    );
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const frustum = new THREE.Frustum();
    const viewProjection = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(viewProjection);

    const spawnX = Math.floor(boardDimensions.width / 2);
    const spawnY = boardDimensions.height - 1;

    const allTypes = Object.values(PieceType);
    allTypes.forEach((type) => {
      const piece = {
        type,
        orientation: PieceOrientation.Deg0,
        position: { x: spawnX, y: spawnY },
      };
      const blocks = getWorldBlocks(piece, boardDimensions);
      blocks.forEach((cell) => {
        const world = mapper.cellToWorldPosition(cell.x, cell.y, {
          allowOverflowY: cell.y >= boardDimensions.height,
        });
        expect(world.y).toBeGreaterThanOrEqual(bounds.minY - 1e-5);
        expect(world.y).toBeLessThanOrEqual(bounds.maxY + 1e-5);
        expect(frustum.containsPoint(world)).toBe(true);
      });
    });
  });
});
