import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';
import { RenderModeConfig } from './renderConfig';
import { createBoardPlaceholder } from './boardPlaceholder';
import { createTowerFootprint } from './towerFootprint';

export interface DebugOverlays {
  group: THREE.Group;
}

interface DebugOverlayParams {
  dimensions: BoardDimensions;
  board: BoardRenderConfig;
  renderMode: RenderModeConfig;
}

export function createDebugOverlays({
  dimensions,
  board,
  renderMode,
}: DebugOverlayParams): DebugOverlays {
  const group = new THREE.Group();
  const wantsGuides = renderMode.showGuides;
  const wantsRing = renderMode.showDebugRing;
  const wantsColliders = renderMode.showColliders;
  const isDebugMode = renderMode.kind !== 'game';

  if (isDebugMode || wantsGuides || wantsRing || wantsColliders) {
    if (wantsGuides || wantsRing) {
      const placeholder = createBoardPlaceholder(dimensions, board);
      placeholder.rails.forEach((rail) => {
        rail.visible = wantsGuides;
      });
      placeholder.baseRing.visible = wantsRing;
      group.add(placeholder.group);
    }

    if (wantsGuides) {
      const axes = new THREE.AxesHelper(board.towerRadius * 1.35);
      axes.position.y = board.blockSize * 0.1;
      group.add(axes);
    }

    if (wantsColliders) {
      const colliderHelper = new THREE.Group();
      colliderHelper.name = 'colliderDebugLayer';
      group.add(colliderHelper);
    }
  }

  // Always add a subtle production footprint so players have orientation without debug ring.
  const footprint = createTowerFootprint({
    dimensions,
    board,
    opacity: renderMode.kind === 'game' ? 0.36 : 0.4,
  });
  group.add(footprint.group);

  return { group };
}
