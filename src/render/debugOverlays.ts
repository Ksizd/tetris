import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';
import { RenderModeConfig } from './renderConfig';
import { createBoardPlaceholder } from './boardPlaceholder';
import { createTowerFootprintDecor, createTowerFootprintDebug } from './towerFootprint';
import { HallLayoutRadii } from './hallLayout';

export interface DebugOverlays {
  group: THREE.Group;
}

interface DebugOverlayParams {
  dimensions: BoardDimensions;
  board: BoardRenderConfig;
  renderMode: RenderModeConfig;
  showRawFootprintOverlay?: boolean;
}

export function createDebugOverlays({
  dimensions,
  board,
  renderMode,
  showRawFootprintOverlay = false,
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

  // Debug-only raw footprint overlay to avoid duplication with production decor footprint.
  if (renderMode.kind !== 'game' && showRawFootprintOverlay) {
    const footprint = createTowerFootprintDebug({
      dimensions,
      board,
      opacity: 0.4,
    });
    group.add(footprint.group);
  }

  return { group };
}

export interface HallRadiiOverlay {
  group: THREE.Group;
  update: (layout: HallLayoutRadii, center: THREE.Vector3) => void;
  dispose: () => void;
}

export function createHallRadiiOverlay(
  layout: HallLayoutRadii,
  center: THREE.Vector3,
  elevation = 0.02
): HallRadiiOverlay {
  const group = new THREE.Group();
  group.name = 'hall-radii-overlay';
  group.position.set(center.x, center.y + elevation, center.z);

  const circle = (radius: number, color: number, segments = 96): THREE.LineLoop => {
    const geom = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = (i / segments) * Math.PI * 2;
      pts.push(Math.cos(t) * radius, 0, Math.sin(t) * radius);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color, toneMapped: false });
    const loop = new THREE.LineLoop(geom, mat);
    loop.renderOrder = 10;
    return loop;
  };

  const towerCircle = circle(layout.towerOuterRadius, 0x2ecc71);
  towerCircle.name = 'hall-radii-tower';
  const cameraCircle = circle(layout.cameraOrbitRadius, 0x4fc3f7);
  cameraCircle.name = 'hall-radii-camera';
  const hallCircle = circle(layout.hallInnerRadius, 0xf1c40f);
  hallCircle.name = 'hall-radii-hall';

  group.add(towerCircle, cameraCircle, hallCircle);

  const rebuild = (next: HallLayoutRadii) => {
    const applyRadius = (mesh: THREE.LineLoop, radius: number) => {
      const oldGeom = mesh.geometry as THREE.BufferGeometry;
      const segments = (oldGeom.getAttribute('position')?.count ?? 97) - 1;
      const pts: number[] = [];
      for (let i = 0; i <= segments; i += 1) {
        const t = (i / segments) * Math.PI * 2;
        pts.push(Math.cos(t) * radius, 0, Math.sin(t) * radius);
      }
      const newGeom = new THREE.BufferGeometry();
      newGeom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      mesh.geometry = newGeom;
      oldGeom.dispose();
    };
    applyRadius(towerCircle, next.towerOuterRadius);
    applyRadius(cameraCircle, next.cameraOrbitRadius);
    applyRadius(hallCircle, next.hallInnerRadius);
  };

  const dispose = () => {
    [towerCircle, cameraCircle, hallCircle].forEach((mesh) => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
  };

  return {
    group,
    update: (next, newCenter) => {
      group.position.set(newCenter.x, newCenter.y + elevation, newCenter.z);
      rebuild(next);
    },
    dispose,
  };
}
