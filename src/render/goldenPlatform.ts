import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';
import { HallLayoutRadii } from './hallLayout';
import { PlatformLayout, computePlatformLayout } from './platformLayout';
import { createDefaultPlatformDesign } from './platformDesign';
import { createGoldenPlatformGeometry } from './goldenPlatformGeometry';
import { DebugTag } from './debug/objectInspectorTypes';
import { createFootprintSakuraLavaMaterial } from './footprintLavaMaterial';
import { createFootprintLavaFx } from './footprintLavaFx';
import { computeFootprintAngleOffsetRad } from './footprintAngles';

export interface GoldenPlatformInstance {
  mesh: THREE.Mesh;
  layout: PlatformLayout;
  update: (timeSeconds: number) => void;
  dispose: () => void;
}

export interface CreateGoldenPlatformParams {
  hallLayout: HallLayoutRadii;
  board: BoardRenderConfig;
  dimensions: BoardDimensions;
  designScale?: number;
}

const PLATFORM_ASSERT_EPS = 1e-4;
const FOOTPRINT_HELPER_EPS = 1e-6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function createFootprintInlayCoreHelper(
  layout: PlatformLayout,
  board: BoardRenderConfig,
  columns: number
): THREE.Mesh {
  const ringATopY = layout.baseY + layout.ringA.height;
  const R1 = board.towerRadius + board.blockDepth * 0.5;
  const grooveD = clamp(board.blockSize * 0.08, board.blockSize * 0.04, board.blockSize * 0.08);
  const height = Math.max(FOOTPRINT_HELPER_EPS, grooveD);
  const segments = Math.max(24, Math.min(96, Math.floor(columns) * 4));
  const geometry = new THREE.CylinderGeometry(R1, R1, height, segments, 1, true);
  const material = new THREE.MeshBasicMaterial({ visible: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'footprintInlayCore';
  mesh.position.y = ringATopY - height * 0.5;
  mesh.userData.debugSelectable = false;
  mesh.userData.debugTag = {
    kind: 'footprintCore',
    sourceFile: 'src/render/goldenPlatform.ts',
    sourceFunction: 'createFootprintInlayCoreHelper',
  } satisfies DebugTag;
  return mesh;
}

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
  const footprintAngleOffsetRad = computeFootprintAngleOffsetRad(params.dimensions.width);
  const geometry = createGoldenPlatformGeometry(layout, {
    segments: params.dimensions.width,
    ringADetailBand: {
      inner: params.board.towerRadius - params.board.blockDepth * 0.5,
      outer: params.board.towerRadius + params.board.blockDepth * 0.5,
    },
    footprintCarve: {
      towerRadius: params.board.towerRadius,
      blockDepth: params.board.blockDepth,
      blockSize: params.board.blockSize,
      columns: params.dimensions.width,
      angleOffsetRad: footprintAngleOffsetRad,
    },
  });

  const lava = createFootprintSakuraLavaMaterial({
    towerRadius: params.board.towerRadius,
    blockDepth: params.board.blockDepth,
    blockSize: params.board.blockSize,
    columns: params.dimensions.width,
    angleOffsetRad: footprintAngleOffsetRad,
  });

  const materials: THREE.Material[] = [
    new THREE.MeshStandardMaterial({ color: 0xd9b169, metalness: 0.55, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xc19444, metalness: 0.55, roughness: 0.62 }),
    lava.material,
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

  const footprintFx = createFootprintLavaFx({
    dimensions: params.dimensions,
    board: params.board,
    platformLayout: layout,
    includeSteam: false,
  });
  const footprintInlay = new THREE.Group();
  footprintInlay.name = 'footprintInlay';
  footprintInlay.userData.debugSelectable = false;
  footprintInlay.userData.debugTag = {
    kind: 'hallFootprint',
    sourceFile: 'src/render/goldenPlatform.ts',
    sourceFunction: 'createGoldenPlatform',
  } satisfies DebugTag;
  const footprintCore = createFootprintInlayCoreHelper(layout, params.board, params.dimensions.width);
  footprintInlay.add(footprintCore);
  if (footprintFx) {
    footprintInlay.add(footprintFx.group);
  }
  mesh.add(footprintInlay);

  const update = (timeSeconds: number) => {
    lava.uniforms.uTime.value = timeSeconds;
    footprintFx?.update(timeSeconds);
  };

  const dispose = () => {
    geometry.dispose();
    materials.forEach((m) => m.dispose());
    footprintFx?.dispose();
    footprintCore.geometry.dispose();
    (footprintCore.material as THREE.Material).dispose();
  };

  return { mesh, layout, update, dispose };
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
    const helperHeight = 0.002;
    const geom = new THREE.CylinderGeometry(outer, outer, helperHeight, segmentCount, 1, true);
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
    mesh.name = name;
    mesh.position.y = y - helperHeight * 0.5;
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
