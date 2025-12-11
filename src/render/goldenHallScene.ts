import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';
import { computeGoldenHallLayout, GoldenHallLayout } from './goldenHallLayout';
import {
  addCenterInsert,
  addHallFloorSeam,
  addHallLightRim,
  addHallMainWall,
  addHallPanels,
  addHallPillars,
  addLowerBaseDisk,
  buildBaseDetails,
  buildBaseSteps,
  buildHallGroup,
  createGoldenHallParts,
} from './goldenHallEnvironment';
import {
  GoldenHallMaterialSet,
  createGoldenHallMaterials,
} from './goldenHallMaterials';
import { createGoldenHallDust, createGoldenHallLightShafts } from './goldenHallFx';
import { GoldenHallConfig, QualityLevel } from './renderConfig';
import { HallLayoutRadii } from './hallLayout';
import { TowerBounds } from './towerBounds';
import { DebugTag } from './debug/objectInspectorTypes';

export interface GoldenHallInstance {
  layout: GoldenHallLayout;
  materials: GoldenHallMaterialSet;
  baseGroup: THREE.Group;
  hallGroup: THREE.Group;
  fxGroup: THREE.Group;
  updateFx: ((dtMs: number) => void) | null;
  dispose: () => void;
}

export interface CreateGoldenHallParams {
  towerBounds: TowerBounds;
  dimensions: BoardDimensions;
  board: BoardRenderConfig;
  goldenHall: GoldenHallConfig;
  quality: QualityLevel;
  envMap?: THREE.Texture | null;
  materials?: GoldenHallMaterialSet;
  hallLayout?: HallLayoutRadii;
}

export function createGoldenHall(params: CreateGoldenHallParams): GoldenHallInstance | null {
  if (!params.goldenHall.enabled) {
    return null;
  }
  const quality = params.quality;
  const materials =
    params.materials ??
    createGoldenHallMaterials({
      quality,
      envMap: params.envMap ?? null,
      useDustFx: params.goldenHall.useDustFx,
      useLightShafts: params.goldenHall.useLightShafts,
    });

  const layout = computeGoldenHallLayout(
    params.dimensions,
    params.board,
    params.goldenHall,
    params.hallLayout
  );
  const parts = createGoldenHallParts(layout);

  addLowerBaseDisk(parts, materials.baseOuter);
  buildBaseSteps(parts, () => materials.baseOuter);
  addCenterInsert(parts, materials.baseCenter);
  buildBaseDetails(parts, quality, () => materials.baseOuter);

  buildHallGroup(parts);
  addHallMainWall(parts, quality, materials.wallMain);
  addHallLightRim(parts, quality, materials.wallEmissiveRim);
  addHallFloorSeam(parts, quality, materials.baseOuter);
  addHallPillars(parts, quality, () => materials.pillar);
  addHallPanels(parts, quality, materials.panel);

  const yOffset = params.towerBounds.minY ?? 0;
  parts.baseGroup.position.y += yOffset;
  parts.hallGroup.position.y += yOffset;

  const fxGroup = new THREE.Group();
  fxGroup.name = 'hall-fx';
  fxGroup.position.y = yOffset;

  const dust = createGoldenHallDust({
    layout,
    quality,
    material: materials.dustParticle,
    useDustFx: params.goldenHall.useDustFx,
  });
  const shafts = createGoldenHallLightShafts({
    layout,
    quality,
    material: materials.lightShaft,
    useLightShafts: params.goldenHall.useLightShafts,
  });
  if (dust) {
    fxGroup.add(dust.group);
  }
  if (shafts) {
    fxGroup.add(shafts.group);
  }

  const updateFx =
    dust || shafts
      ? (dtMs: number) => {
          dust?.update(dtMs);
          shafts?.update(dtMs);
        }
      : null;

  tagHallDebugObjects(parts);

  const dispose = () => {
    disposeGroup(parts.baseGroup);
    disposeGroup(parts.hallGroup);
    disposeGroup(fxGroup);
    disposeMaterialSet(materials);
  };

  return {
    layout,
    materials,
    baseGroup: parts.baseGroup,
    hallGroup: parts.hallGroup,
    fxGroup,
    updateFx,
    dispose,
  };
}

function tagHallDebugObjects(parts: GoldenHallParts): void {
  const tag = (obj: THREE.Object3D, kind: DebugTag['kind'], sourceFunction?: string) => {
    obj.userData.debugTag = {
      kind,
      sourceFile: 'src/render/goldenHallScene.ts',
      sourceFunction,
    } satisfies DebugTag;
  };

  parts.baseGroup.children.forEach((child) => {
    if (child.name.includes('step') || child.name.includes('center')) {
      tag(child, 'hallFloor', 'createGoldenHall');
    }
  });

  parts.hallGroup.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) {
      return;
    }
    const name = obj.name;
    if (name.includes('pillar')) {
      tag(obj, 'hallColumn', 'createGoldenHall');
    } else if (name.includes('panel')) {
      tag(obj, 'hallInnerShell', 'createGoldenHall');
    } else if (name.includes('wall') || name.includes('rim') || name.includes('seam')) {
      tag(obj, 'hallInnerShell', 'createGoldenHall');
    } else {
      tag(obj, 'hallInnerShell', 'createGoldenHall');
    }
  });
}

export function updateGoldenHallFx(instance: GoldenHallInstance | null | undefined, deltaMs: number): void {
  if (!instance?.updateFx) {
    return;
  }
  instance.updateFx(deltaMs);
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    mesh.geometry?.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => m.dispose());
    } else {
      mat?.dispose();
    }
  });
}

function disposeMaterialSet(materials: GoldenHallMaterialSet): void {
  const textures = new Set<THREE.Texture>();
  const collectTextures = (mat: THREE.Material) => {
    const maybe = mat as THREE.MeshStandardMaterial & THREE.PointsMaterial & { alphaMap?: THREE.Texture };
    [
      maybe.map,
      maybe.roughnessMap,
      maybe.metalnessMap,
      (maybe as any).aoMap,
      (maybe as any).emissiveMap,
      maybe.alphaMap,
    ].forEach((tex) => {
      if (tex) {
        textures.add(tex);
      }
    });
  };

  collectTextures(materials.baseOuter);
  collectTextures(materials.baseInner);
  collectTextures(materials.baseCenter);
  collectTextures(materials.wallMain);
  collectTextures(materials.wallEmissiveRim);
  collectTextures(materials.pillar);
  collectTextures(materials.panel);
  collectTextures(materials.dustParticle);
  collectTextures(materials.lightShaft);

  Object.values(materials).forEach((mat) => {
    if ((mat as THREE.Material).dispose) {
      (mat as THREE.Material).dispose();
    }
  });

  textures.forEach((tex) => tex.dispose());
}
