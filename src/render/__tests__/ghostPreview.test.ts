import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBoardRenderConfig } from '../boardConfig';
import { BoardToWorldMapper } from '../boardToWorldMapper';
import { createBoardInstancedMesh } from '../boardInstancedMesh';
import { createActivePieceInstancedMesh } from '../activePieceInstancedMesh';
import { createRenderConfig } from '../renderConfig';
import { getTowerBounds } from '../towerBounds';
import { renderScene } from '../sceneRenderer';
import { createInitialGameState } from '../../core/state';

describe('ghost preview rendering', () => {
  const dimensions = { width: 4, height: 6 };
  const boardConfig = createBoardRenderConfig(dimensions, { blockSize: 1 });
  const mapper = new BoardToWorldMapper(dimensions, boardConfig);
  const renderConfig = createRenderConfig({ boardDimensions: dimensions, board: boardConfig });
  const towerBounds = getTowerBounds(dimensions, boardConfig);
  const camera = new THREE.PerspectiveCamera(
    renderConfig.camera.fov,
    16 / 9,
    0.1,
    1000
  );
  camera.position.copy(renderConfig.camera.position);
  camera.lookAt(renderConfig.camera.target);

  const baseCtx = {
    board: createBoardInstancedMesh(dimensions, boardConfig, renderConfig.materials),
    activePiece: createActivePieceInstancedMesh(boardConfig, renderConfig.materials),
    ghost: createActivePieceInstancedMesh(boardConfig, renderConfig.materials),
    mapper,
    renderConfig,
    fragments: undefined,
    camera,
    towerBounds,
    cameraBasePlacement: {
      position: renderConfig.camera.position.clone(),
      target: renderConfig.camera.target.clone(),
    },
  };

  it('sets ghost count to zero when no cells provided', () => {
    const snapshot = createInitialGameState({ board: dimensions });

    renderScene(baseCtx, snapshot, undefined, null, 0, { cells: [], visible: false });

    expect(baseCtx.ghost.mesh.count).toBe(0);
    expect(baseCtx.ghost.mesh.visible).toBe(false);
  });

  it('positions ghost block at mapped world coordinates', () => {
    const snapshot = createInitialGameState({ board: dimensions });
    const ghostCell = { x: 1, y: 2 };

    renderScene(baseCtx, snapshot, undefined, null, 0, { cells: [ghostCell], visible: true });

    expect(baseCtx.ghost.mesh.count).toBe(1);
    expect(baseCtx.ghost.mesh.visible).toBe(true);
    const matrix = new THREE.Matrix4();
    baseCtx.ghost.mesh.getMatrixAt(0, matrix);
    const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
    const expected = mapper.cellToWorldPosition(ghostCell.x, ghostCell.y);
    expect(pos.distanceTo(expected)).toBeLessThan(1e-6);
  });
});
