import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';
import { HallLayoutRadii } from './hallLayout';
import { PlatformLayout, computePlatformLayout } from './platformLayout';
import { createDefaultPlatformDesign } from './platformDesign';
import { createGoldenPlatformGeometry } from './goldenPlatformGeometry';
import { DebugTag } from './debug/objectInspectorTypes';

export interface GoldenPlatformInstance {
  mesh: THREE.Mesh;
  layout: PlatformLayout;
  dispose: () => void;
}

export interface CreateGoldenPlatformParams {
  hallLayout: HallLayoutRadii;
  board: BoardRenderConfig;
  dimensions: BoardDimensions;
  designScale?: number;
}

const PLATFORM_ASSERT_EPS = 1e-4;

function assertPlatformInvariants(
  layout: PlatformLayout,
  board: BoardRenderConfig,
  hallLayout: HallLayoutRadii
): void {
  if (typeof console === 'undefined') {
    return;
  }
  const topA = layout.baseY + layout.ringA.height;
  const floor = -board.blockSize * 0.5;
  const gap = Math.abs(topA - floor);
  console.assert(
    gap <= 0.0105 + PLATFORM_ASSERT_EPS,
    '[goldenPlatform] ringA top must align with tower floor (<=1cm gap)',
    { topA, floor, gap }
  );
  console.assert(
    layout.ringC.outer <= hallLayout.platformOuterRadius + PLATFORM_ASSERT_EPS,
    '[goldenPlatform] ringC outer exceeds platformOuterRadius',
    { ringCOuter: layout.ringC.outer, platformOuterRadius: hallLayout.platformOuterRadius }
  );
  console.assert(
    Math.abs(layout.ringA.inner) <= PLATFORM_ASSERT_EPS,
    '[goldenPlatform] platform origin must stay at world center',
    { ringAInner: layout.ringA.inner }
  );
}

export function createGoldenPlatform(params: CreateGoldenPlatformParams): GoldenPlatformInstance {
  const design = createDefaultPlatformDesign(params.board.blockSize * (params.designScale ?? 1));
  const layout = computePlatformLayout(params.hallLayout, params.board, design);
  assertPlatformInvariants(layout, params.board, params.hallLayout);
  const geometry = createGoldenPlatformGeometry(layout, { segments: params.dimensions.width });

  const materials: THREE.Material[] = [
    new THREE.MeshStandardMaterial({ color: 0xd9b169, metalness: 0.55, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xf1c779, metalness: 0.6, roughness: 0.26 }),
    new THREE.MeshStandardMaterial({ color: 0xf6d48e, metalness: 0.65, roughness: 0.32 }),
    new THREE.MeshStandardMaterial({ color: 0xe6c27a, metalness: 0.6, roughness: 0.36 }),
    new THREE.MeshStandardMaterial({ color: 0xc89f54, metalness: 0.58, roughness: 0.4 }),
  ];

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = 'goldenPlatform';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  attachPlatformDebugHelpers(mesh, layout);

  const dispose = () => {
    geometry.dispose();
    materials.forEach((m) => m.dispose());
  };

  return { mesh, layout, dispose };
}

function attachPlatformDebugHelpers(target: THREE.Mesh, layout: PlatformLayout): void {
  const helperGroup = new THREE.Group();
  helperGroup.name = 'platform-debug-helpers';
  helperGroup.visible = false;
  helperGroup.userData.debugSelectable = false;

  const segmentCount = Math.max(24, Math.round(layout.ringC.outer * 8));

  const ringHelper = (
    inner: number,
    outer: number,
    y: number,
    kind: DebugTag['kind'],
    name: string
  ) => {
    const geom = new THREE.CylinderGeometry(outer, outer, 0.002, segmentCount, 1, true);
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
    mesh.name = name;
    mesh.position.y = y;
    mesh.userData.debugTag = { kind, sourceFile: 'src/render/goldenPlatform.ts' } satisfies DebugTag;
    helperGroup.add(mesh);
  };

  const sideHelper = (
    outer: number,
    yBottom: number,
    yTop: number,
    kind: DebugTag['kind'],
    name: string
  ) => {
    const height = Math.max(0.001, yTop - yBottom);
    const geom = new THREE.CylinderGeometry(outer, outer, height, segmentCount, 1, true);
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
    mesh.name = name;
    mesh.position.y = yBottom + height * 0.5;
    mesh.userData.debugTag = { kind, sourceFile: 'src/render/goldenPlatform.ts' } satisfies DebugTag;
    helperGroup.add(mesh);
  };

  const yA = layout.baseY + layout.ringA.height;
  const yB = layout.baseY + layout.ringB.height;
  const yC = layout.baseY + layout.ringC.height;

  ringHelper(layout.ringA.inner, layout.ringA.outer, yA, 'platformRingA', 'platform-ringA-helper');
  ringHelper(layout.ringB.inner, layout.ringB.outer, yB, 'platformRingB', 'platform-ringB-helper');
  ringHelper(layout.ringC.inner, layout.ringC.outer, yC, 'platformRingC', 'platform-ringC-helper');
  sideHelper(layout.ringC.outer, layout.baseY, yC, 'platformSide', 'platform-side-helper');

  target.add(helperGroup);
}
