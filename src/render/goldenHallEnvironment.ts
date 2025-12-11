import * as THREE from 'three';
import { GoldenHallLayout } from './goldenHallLayout';
import { QualityLevel } from './renderConfig';

export const GOLDEN_HALL_NODE_NAMES = {
  root: 'goldenHall',
  baseGroup: 'hall-base',
  baseStepsGroup: 'hall-base-steps',
  baseCenterGroup: 'hall-base-center',
  baseDetailsGroup: 'hall-base-details',
  hallGroup: 'hall-group',
  hallWall: 'hall-wall-main',
  hallRim: 'hall-rim',
  hallPillarPrefix: 'hall-pillar-',
  hallPanelPrefix: 'hall-panel-',
  hallSeam: 'hall-wall-seam',
} as const;

export function getBaseStepName(index: number): string {
  return `${GOLDEN_HALL_NODE_NAMES.baseGroup}-step-${index}`;
}

export function getBaseDetailName(index: number): string {
  return `${GOLDEN_HALL_NODE_NAMES.baseGroup}-detail-${index}`;
}

export interface GoldenHallParts {
  root: THREE.Group;
  baseGroup: THREE.Group;
  baseStepsGroup: THREE.Group;
  baseCenterGroup: THREE.Group;
  baseDetailsGroup: THREE.Group;
  hallGroup: THREE.Group;
  layout: GoldenHallLayout;
}

export interface GoldenHallBaseMeshes {
  lowerDisk: THREE.Mesh;
}

/**
 * Creates grouped placeholders for Golden Hall geometry (no lights/FX here).
 * Top of the pedestal is aligned to y=0; geometry is expected to extend below.
 */
export function createGoldenHallParts(layout: GoldenHallLayout): GoldenHallParts {
  const root = new THREE.Group();
  root.name = GOLDEN_HALL_NODE_NAMES.root;
  root.userData.layout = layout;

  const baseGroup = new THREE.Group();
  baseGroup.name = GOLDEN_HALL_NODE_NAMES.baseGroup;
  baseGroup.position.set(0, layout.base.topY, 0);

  const baseStepsGroup = new THREE.Group();
  baseStepsGroup.name = GOLDEN_HALL_NODE_NAMES.baseStepsGroup;

  const baseCenterGroup = new THREE.Group();
  baseCenterGroup.name = GOLDEN_HALL_NODE_NAMES.baseCenterGroup;

  const baseDetailsGroup = new THREE.Group();
  baseDetailsGroup.name = GOLDEN_HALL_NODE_NAMES.baseDetailsGroup;

  const hallGroup = new THREE.Group();
  hallGroup.name = GOLDEN_HALL_NODE_NAMES.hallGroup;

  baseGroup.add(baseStepsGroup);
  baseGroup.add(baseCenterGroup);
  baseGroup.add(baseDetailsGroup);

  root.add(baseGroup);
  root.add(hallGroup);

  return {
    root,
    baseGroup,
    baseStepsGroup,
    baseCenterGroup,
    baseDetailsGroup,
    hallGroup,
    layout,
  };
}

/**
 * Builds the lower foundation disk that defines the pedestal silhouette.
 * Top aligns to y=0, thickness clamped to 20-40% of tower height.
 */
export function addLowerBaseDisk(
  parts: GoldenHallParts,
  material?: THREE.Material
): GoldenHallBaseMeshes {
  const { layout } = parts;
  const { outerRadius, height: baseHeight } = layout.base;
  const towerHeight = layout.footprint.height;
  const minHeight = towerHeight * 0.2;
  const maxHeight = towerHeight * 0.4;
  // Respect configured baseHeight but keep it within reasonable bounds vs tower height.
  const clampedHeight = THREE.MathUtils.clamp(baseHeight, minHeight, maxHeight);
  const height = Math.min(baseHeight, clampedHeight);
  const radiusBottom = outerRadius;
  const radiusTop = outerRadius * 0.985; // slight chamfer to avoid flat-on-flat contact
  const radialSegments = layout.wallCurvatureSegments;
  const heightSegments = 2;

  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
    heightSegments,
    false
  );
  geometry.computeVertexNormals();

  const meshMaterial =
    material ??
    new THREE.MeshStandardMaterial({
      color: 0x8c6b2b,
      metalness: 0.68,
      roughness: 0.24,
      emissive: 0x0f0904,
      emissiveIntensity: 0.02,
    });

  const lowerDisk = new THREE.Mesh(geometry, meshMaterial);
  lowerDisk.name = getBaseStepName(0);
  lowerDisk.castShadow = true;
  lowerDisk.receiveShadow = true;
  // Place so that the top sits at y=0 and bottom extends downward.
  lowerDisk.position.set(0, -height * 0.5, 0);

  // Ensure a tiny offset to avoid z-fighting with future upper tiers.
  lowerDisk.userData.goldenHall = { kind: 'base-lower-disk' };

  parts.baseStepsGroup.add(lowerDisk);

  return { lowerDisk };
}

export interface GoldenHallBaseStep {
  mesh: THREE.Mesh;
  topY: number;
  bottomY: number;
}

export interface GoldenHallBaseBuildResult {
  steps: GoldenHallBaseStep[];
  topGap: number;
  totalHeight: number;
}

export interface GoldenHallCenterPiece {
  disk: THREE.Mesh;
  radius: number;
}

export interface GoldenHallDetailMeshes {
  sectors: THREE.Mesh[];
  pedestals: THREE.Mesh[];
  rim?: THREE.Mesh;
}

export interface GoldenHallHallGroup {
  group: THREE.Group;
  mainWall?: THREE.Mesh;
  rim?: THREE.Mesh;
  seam?: THREE.Mesh;
  pillars: THREE.Mesh[];
  panels: THREE.Mesh[];
}

interface HallDimensions {
  radius: number;
  wallHeight: number;
  segments: number;
}

export interface GoldenHallPillarBuild {
  mesh: THREE.Mesh;
}

export interface GoldenHallPanelBuild {
  mesh: THREE.Mesh;
}

export interface HallCameraConstraints {
  minRadius: number;
  maxRadius: number;
  near: number;
  far: number;
}

/**
 * Builds stacked pedestal tiers with varying profiles and insets.
 * Top surface ends slightly below y=0 to leave a gap to the board.
 */
export function buildBaseSteps(
  parts: GoldenHallParts,
  materialFactory?: (index: number) => THREE.Material
): GoldenHallBaseBuildResult {
  const { layout } = parts;
  const { outerRadius, height: baseHeight, stepCount, stepInsetRatio } = layout.base;
  const towerHeight = layout.footprint.height;
  const blockSize = layout.footprint.blockSize;

  const minHeight = towerHeight * 0.12;
  const maxHeight = towerHeight * 0.42;
  const totalHeight = THREE.MathUtils.clamp(baseHeight, minHeight, maxHeight);
  const topGap = Math.max(blockSize * 0.02, 0.01);
  const usableHeight = Math.max(totalHeight - topGap, totalHeight * 0.9);

  // Distribute heights per tier count.
  const weights =
    stepCount === 1
      ? [1]
      : stepCount === 2
        ? [0.6, 0.4]
        : [0.5, 0.3, 0.2, ...Array(Math.max(0, stepCount - 3)).fill(0)];
  // Normalize weights to avoid zero in extra slots.
  const normalizedWeights = weights.slice(0, stepCount);
  while (normalizedWeights.length < stepCount) {
    normalizedWeights.push(1 / stepCount);
  }
  const weightSum = normalizedWeights.reduce((sum, w) => sum + w, 0);
  const heights = normalizedWeights.map((w) => (usableHeight * w) / weightSum);

  const radialSegments = layout.wallCurvatureSegments;
  const steps: GoldenHallBaseStep[] = [];
  // Start below so the final top is at -topGap.
  let cursorY = -(usableHeight + topGap);

  for (let i = 0; i < stepCount; i += 1) {
    const height = Math.max(0.05, heights[i]);
    const radiusMultiplier = 1 - i * stepInsetRatio;
    const minRadius = Math.max(layout.footprint.innerRadius * 0.8, layout.footprint.outerRadius * 0.6);
    const baseRadius = Math.max(minRadius, outerRadius * radiusMultiplier);

    // Profile variations per tier.
    const radiusBottom =
      i === 0 ? baseRadius : i === stepCount - 1 ? baseRadius * 0.98 : baseRadius * 0.96;
    const baseTopProfile =
      i === 0
        ? baseRadius * 0.985
        : i === stepCount - 1
          ? Math.max(minRadius * 0.9, baseRadius * 0.9)
          : baseRadius * 0.93;

    const frameRadius = layout.footprint.towerRadius * 0.98;
    const profiledTop = i === stepCount - 1 ? Math.min(baseTopProfile, frameRadius) : baseTopProfile;
    const radiusTop = Math.max(minRadius * 0.75, profiledTop);

    const geometry = new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      radialSegments,
      2,
      false
    );
    geometry.computeVertexNormals();

    const material =
      materialFactory?.(i) ??
      new THREE.MeshStandardMaterial({
        color: 0x8c6b2b,
        metalness: 0.68,
        roughness: 0.24,
        emissive: 0x0f0904,
        emissiveIntensity: 0.02,
      });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = getBaseStepName(i);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const centerY = cursorY + height * 0.5;
    mesh.position.set(0, centerY, 0);
    cursorY += height;

    mesh.userData.goldenHall = { kind: 'base-step', index: i };
    steps.push({
      mesh,
      topY: mesh.position.y + height * 0.5,
      bottomY: mesh.position.y - height * 0.5,
    });
    parts.baseStepsGroup.add(mesh);
  }

  return { steps, topGap, totalHeight };
}

/**
 * Creates the central dark inlay disk under the tower footprint.
 * Radius stays within the inner footprint; top is at y=0 for seamless merge with the board plane.
 */
export function addCenterInsert(
  parts: GoldenHallParts,
  material?: THREE.Material
): GoldenHallCenterPiece {
  const { layout } = parts;
  const { innerRadius, blockSize } = layout.footprint;
  const maxRadius = innerRadius * 0.98;
  const minRadius = innerRadius * 0.75;
  const radius = Math.max(minRadius, Math.min(maxRadius, innerRadius - blockSize * 0.08));

  const thickness = Math.max(blockSize * 0.1, blockSize * 0.04);
  const segments = Math.max(24, Math.round(layout.wallCurvatureSegments * 0.5));

  const geometry = new THREE.CylinderGeometry(radius, radius, thickness, segments, 1, false);
  geometry.computeVertexNormals();

  const meshMaterial =
    material ??
    new THREE.MeshStandardMaterial({
      color: 0x0f0b0a,
      metalness: 0.22,
      roughness: 0.18,
      emissive: 0x050505,
      emissiveIntensity: 0.04,
    });

  const disk = new THREE.Mesh(geometry, meshMaterial);
  disk.name = `${GOLDEN_HALL_NODE_NAMES.baseCenterGroup}-disk`;
  disk.castShadow = true;
  disk.receiveShadow = true;
  disk.position.set(0, -thickness * 0.5, 0); // top at y=0
  disk.userData.goldenHall = { kind: 'center-insert' };

  parts.baseCenterGroup.add(disk);

  return { disk, radius };
}

function createRingSectionGeometry(
  innerRadius: number,
  outerRadius: number,
  height: number,
  segments: number,
  thetaStart: number,
  thetaLength: number
): THREE.BufferGeometry {
  const radialSegments = Math.max(6, Math.floor((segments * thetaLength) / (Math.PI * 2)));
  const positions: number[] = [];
  const indices: number[] = [];
  const halfHeight = height * 0.5;
  for (let i = 0; i <= radialSegments; i += 1) {
    const t = thetaStart + (thetaLength * i) / radialSegments;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const ix = cos * innerRadius;
    const iz = sin * innerRadius;
    const ox = cos * outerRadius;
    const oz = sin * outerRadius;
    // lower outer, upper outer, lower inner, upper inner
    positions.push(ox, -halfHeight, oz, ox, halfHeight, oz, ix, -halfHeight, iz, ix, halfHeight, iz);
    const base = i * 4;
    if (i > 0) {
      const prev = base - 4;
      // quad outer
      indices.push(prev, prev + 1, base + 1, prev, base + 1, base);
      // quad inner (reverse winding to face inward)
      indices.push(prev + 2, base + 2, base + 3, prev + 2, base + 3, prev + 3);
      // top cap
      indices.push(prev + 1, prev + 3, base + 3, prev + 1, base + 3, base + 1);
      // bottom cap
      indices.push(prev, base, base + 2, prev, base + 2, prev + 2);
    }
  }
  const buf = new THREE.BufferGeometry();
  buf.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  buf.setIndex(indices);
  buf.computeVertexNormals();
  return buf;
}

export function buildBaseDetails(
  parts: GoldenHallParts,
  quality: QualityLevel = 'ultra',
  materialFactory?: (kind: 'sector' | 'pedestal' | 'rim', index: number) => THREE.Material
): GoldenHallDetailMeshes {
  const details: GoldenHallDetailMeshes = { sectors: [], pedestals: [] };
  const { layout } = parts;
  const blockSize = layout.footprint.blockSize;
  const columnCount = Math.max(4, layout.footprint.columnCount);
  const outerRadius = layout.base.outerRadius;
  const innerSafe = layout.footprint.outerRadius + blockSize * 0.4;
  const detailBandRadius = (outerRadius + innerSafe) * 0.5;

  if (quality === 'low') {
    parts.baseDetailsGroup.visible = false;
    return details;
  }
  parts.baseDetailsGroup.visible = true;

  if (detailBandRadius <= innerSafe) {
    return details;
  }

  const densityStep =
    quality === 'ultra' || quality === 'ultra2'
      ? 4
      : quality === 'medium'
        ? 6
        : 8;
  const sectorCount = Math.max(3, Math.floor(columnCount / densityStep));
  const thetaStep = (Math.PI * 2) / sectorCount;
  const sectorHeight = Math.max(blockSize * 0.08, blockSize * 0.14);
  const radialGap = Math.max(blockSize * 0.3, outerRadius - innerSafe);
  const sectorThickness = Math.min(
    Math.max(blockSize * 0.35, radialGap * 0.45),
    detailBandRadius - innerSafe * 0.9
  );
  if (sectorThickness <= 0) {
    return details;
  }
  const sectorSegments = Math.max(16, Math.round(layout.wallCurvatureSegments * 0.25));

  for (let i = 0; i < sectorCount; i += 1) {
    const thetaStart = i * thetaStep + thetaStep * 0.1;
    const thetaLength = thetaStep * 0.45;
    const geometry = createRingSectionGeometry(
      detailBandRadius - sectorThickness,
      detailBandRadius,
      sectorHeight,
      sectorSegments,
      thetaStart,
      thetaLength
    );
    const mat =
      materialFactory?.('sector', i) ??
      new THREE.MeshStandardMaterial({
        color: 0x9f7a34,
        metalness: 0.72,
        roughness: 0.26,
        emissive: 0x1f1205,
        emissiveIntensity: 0.03,
      });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = `${GOLDEN_HALL_NODE_NAMES.baseDetailsGroup}-sector-${i}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = -sectorHeight * 0.5 - blockSize * 0.015;
    mesh.userData.goldenHall = { kind: 'detail-sector', index: i };
    parts.baseDetailsGroup.add(mesh);
    details.sectors.push(mesh);
  }

  if (quality === 'ultra' || quality === 'ultra2') {
    const pedestalCount = Math.max(2, Math.floor(sectorCount * 0.75));
    const pedestalRadius = Math.max(detailBandRadius * 0.95, innerSafe + blockSize * 0.2);
    const pedestalHeight = blockSize * 0.36;
    const pedestalSegments = 14;
    for (let i = 0; i < pedestalCount; i += 1) {
      const angle = i * ((Math.PI * 2) / pedestalCount);
      const x = Math.cos(angle) * pedestalRadius;
      const z = Math.sin(angle) * pedestalRadius;
      const geometry = new THREE.CylinderGeometry(
        blockSize * 0.45,
        blockSize * 0.5,
        pedestalHeight,
        pedestalSegments,
        1,
        false
      );
      geometry.computeVertexNormals();
      const mat =
        materialFactory?.('pedestal', i) ??
        new THREE.MeshStandardMaterial({
          color: 0xa8843f,
          metalness: 0.74,
          roughness: 0.3,
          emissive: 0x1b1206,
          emissiveIntensity: 0.025,
        });
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.name = `${GOLDEN_HALL_NODE_NAMES.baseDetailsGroup}-pedestal-${i}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(x, -pedestalHeight * 0.5 - blockSize * 0.02, z);
      mesh.userData.goldenHall = { kind: 'detail-pedestal', index: i };
      parts.baseDetailsGroup.add(mesh);
      details.pedestals.push(mesh);
    }
  }

  if (quality === 'ultra' || quality === 'ultra2' || quality === 'medium') {
    const rimHeight = Math.max(blockSize * 0.1, blockSize * 0.16);
    const rimThickness = Math.max(blockSize * 0.3, (outerRadius - detailBandRadius) * 0.35);
    const innerRim = outerRadius - rimThickness;
    if (innerRim > innerSafe) {
      const geometry = new THREE.CylinderGeometry(
        outerRadius,
        outerRadius,
        rimHeight,
        Math.max(24, Math.round(layout.wallCurvatureSegments * 0.28)),
        1,
        true
      );
      geometry.computeVertexNormals();
      const mat =
        materialFactory?.('rim', 0) ??
        new THREE.MeshStandardMaterial({
          color: 0xb59145,
          metalness: 0.78,
          roughness: 0.22,
          emissive: 0x2a1a08,
          emissiveIntensity: 0.06,
          side: THREE.DoubleSide,
        });
      const rim = new THREE.Mesh(geometry, mat);
      rim.name = `${GOLDEN_HALL_NODE_NAMES.baseDetailsGroup}-rim`;
      rim.castShadow = true;
      rim.receiveShadow = true;
      rim.position.y = -rimHeight * 0.5 - blockSize * 0.015;
      rim.userData.goldenHall = { kind: 'detail-rim' };
      parts.baseDetailsGroup.add(rim);
      details.rim = rim;
    }
  }

  return details;
}

export function disposeGoldenHallParts(parts: GoldenHallParts): void {
  parts.root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material?.dispose();
      }
    }
  });
}

export function buildHallGroup(parts: GoldenHallParts): GoldenHallHallGroup {
  const hall = parts.hallGroup;
  hall.clear();
  const built: GoldenHallHallGroup = {
    group: hall,
    pillars: [],
    panels: [],
  };

  const mainWallGroup = new THREE.Group();
  mainWallGroup.name = GOLDEN_HALL_NODE_NAMES.hallWall;
  hall.add(mainWallGroup);

  const rimGroup = new THREE.Group();
  rimGroup.name = GOLDEN_HALL_NODE_NAMES.hallRim;
  hall.add(rimGroup);

  const pillarsGroup = new THREE.Group();
  pillarsGroup.name = `${GOLDEN_HALL_NODE_NAMES.hallPillarPrefix}group`;
  hall.add(pillarsGroup);

  const panelsGroup = new THREE.Group();
  panelsGroup.name = `${GOLDEN_HALL_NODE_NAMES.hallPanelPrefix}group`;
  hall.add(panelsGroup);

  // Keep references for downstream builders.
  (built as any).mainWallGroup = mainWallGroup;
  (built as any).rimGroup = rimGroup;
  (built as any).pillarsGroup = pillarsGroup;
  (built as any).panelsGroup = panelsGroup;

  return built;
}

function computeHallDimensions(layout: GoldenHallLayout, quality: QualityLevel): HallDimensions {
  const blockSize = layout.footprint.blockSize;
  const towerHeight = layout.footprint.height;
  const extraHeight = Math.max(blockSize * 6, towerHeight * 0.2);
  const wallHeight = Math.max(layout.wallHeight, towerHeight + extraHeight);
  const radius = layout.hallRadius;
  const segments =
    quality === 'ultra' || quality === 'ultra2'
      ? layout.wallCurvatureSegments
      : quality === 'medium'
        ? Math.max(48, Math.round(layout.wallCurvatureSegments * 0.5))
        : Math.max(32, Math.round(layout.wallCurvatureSegments * 0.35));
  return { radius, wallHeight, segments };
}

export function computeHallCameraConstraints(
  layout: GoldenHallLayout,
  quality: QualityLevel = 'ultra'
): HallCameraConstraints {
  const dims = computeHallDimensions(layout, quality);
  const margin = layout.footprint.blockSize * 1.5;
  const minRadius = layout.footprint.outerRadius * 1.2;
  const maxRadius = Math.max(minRadius + margin, dims.radius - margin);
  const near = Math.max(0.05, layout.footprint.blockSize * 0.2);
  const far = Math.max(dims.wallHeight * 2.5, dims.radius * 6);
  return {
    minRadius,
    maxRadius,
    near,
    far,
  };
}

export function addHallMainWall(
  parts: GoldenHallParts,
  quality: QualityLevel = 'ultra',
  material?: THREE.Material
): THREE.Mesh {
  // Ensure scaffold exists.
  if (parts.hallGroup.children.length === 0) {
    buildHallGroup(parts);
  }
  const scaffold = parts.hallGroup.children.find((c) =>
    c.name === GOLDEN_HALL_NODE_NAMES.hallWall
  ) as THREE.Group | undefined;
  const targetGroup = scaffold ?? parts.hallGroup;

  const { layout } = parts;
  const dims = computeHallDimensions(layout, quality);
  const seamHeight = Math.max(layout.footprint.blockSize * 0.08, layout.footprint.blockSize * 0.12);

  const geometry = new THREE.CylinderGeometry(
    dims.radius,
    dims.radius,
    dims.wallHeight,
    dims.segments,
    1,
    true
  );
  geometry.computeVertexNormals();

  const mat =
    material ??
    new THREE.MeshStandardMaterial({
      color: 0x20160c,
      metalness: 0.32,
      roughness: 0.62,
      emissive: 0x0c0906,
      emissiveIntensity: 0.08,
      side: THREE.BackSide,
    });

  const wall = new THREE.Mesh(geometry, mat);
  wall.name = `${GOLDEN_HALL_NODE_NAMES.hallWall}-mesh`;
  wall.castShadow = false;
  wall.receiveShadow = true;
  // Bottom lifted by seamHeight to avoid coplanar overlap with floor.
  wall.position.set(0, seamHeight + dims.wallHeight * 0.5, 0);
  wall.userData.goldenHall = {
    kind: 'hall-main-wall',
    quality,
    height: dims.wallHeight,
    seamHeight,
  };

  targetGroup.add(wall);
  return wall;
}

export function addHallLightRim(
  parts: GoldenHallParts,
  quality: QualityLevel = 'ultra',
  material?: THREE.Material
): THREE.Mesh | null {
  if (parts.hallGroup.children.length === 0) {
    buildHallGroup(parts);
  }
  const rimGroup = parts.hallGroup.children.find((c) => c.name === GOLDEN_HALL_NODE_NAMES.hallRim) as
    | THREE.Group
    | undefined;
  const targetGroup = rimGroup ?? parts.hallGroup;

  const dims = computeHallDimensions(parts.layout, quality);
  const blockSize = parts.layout.footprint.blockSize;

  if (quality === 'low') {
    targetGroup.visible = false;
    return null;
  }
  targetGroup.visible = true;

  const rimHeight =
    quality === 'ultra' || quality === 'ultra2'
      ? Math.max(blockSize * 0.25, blockSize * 0.32)
      : Math.max(blockSize * 0.14, blockSize * 0.2);
  const rimRadiusOuter = dims.radius * 0.995;
  const rimRadiusInner = rimRadiusOuter - Math.max(blockSize * 0.28, dims.radius * 0.04);

  const segments =
    quality === 'ultra' || quality === 'ultra2'
      ? Math.max(64, Math.round(dims.segments * 0.7))
      : Math.max(32, Math.round(dims.segments * 0.5));

  const geometry = new THREE.CylinderGeometry(
    rimRadiusOuter,
    rimRadiusOuter,
    rimHeight,
    segments,
    1,
    true
  );
  geometry.computeVertexNormals();

  const mat =
    material ??
    new THREE.MeshStandardMaterial({
      color: 0xc9a14f,
      metalness: 0.85,
      roughness: 0.18,
      emissive: 0xf4d68a,
      emissiveIntensity: quality === 'medium' ? 0.9 : 1.35,
      side: THREE.DoubleSide,
    });

  const rim = new THREE.Mesh(geometry, mat);
  rim.name = `${GOLDEN_HALL_NODE_NAMES.hallRim}-mesh`;
  rim.castShadow = false;
  rim.receiveShadow = true;
  rim.position.set(0, dims.wallHeight - rimHeight * 0.5, 0);
  rim.userData.goldenHall = { kind: 'hall-rim', quality };

  // Add slight inward tilt using a scale on X/Z to hug interior.
  const inwardScale = rimRadiusInner / rimRadiusOuter;
  rim.scale.set(inwardScale, 1, inwardScale);

  targetGroup.add(rim);
  return rim;
}

export function addHallFloorSeam(
  parts: GoldenHallParts,
  quality: QualityLevel = 'ultra',
  material?: THREE.Material
): THREE.Mesh {
  if (parts.hallGroup.children.length === 0) {
    buildHallGroup(parts);
  }
  const seamGroup = parts.hallGroup;

  const dims = computeHallDimensions(parts.layout, quality);
  const blockSize = parts.layout.footprint.blockSize;
  const seamHeight = Math.max(blockSize * 0.08, blockSize * 0.12);
  const outerRadius = dims.radius;
  const innerRadius = Math.max(blockSize * 0.6, outerRadius - Math.max(blockSize * 0.35, outerRadius * 0.012));

  const geometry = new THREE.CylinderGeometry(
    outerRadius,
    innerRadius,
    seamHeight,
    Math.max(32, Math.round(dims.segments * 0.5)),
    1,
    true
  );
  geometry.computeVertexNormals();

  const mat =
    material ??
    new THREE.MeshStandardMaterial({
      color: 0x8f6c2f,
      metalness: 0.65,
      roughness: 0.3,
      emissive: 0x120a04,
      emissiveIntensity: 0.02,
      side: THREE.DoubleSide,
    });

  const seam = new THREE.Mesh(geometry, mat);
  seam.name = GOLDEN_HALL_NODE_NAMES.hallSeam;
  seam.castShadow = true;
  seam.receiveShadow = true;
  seam.position.set(0, seamHeight * 0.5, 0);
  seam.userData.goldenHall = { kind: 'hall-floor-seam', quality, seamHeight };

  seamGroup.add(seam);
  return seam;
}

export function addHallPillars(
  parts: GoldenHallParts,
  quality: QualityLevel = 'ultra',
  materialFactory?: (index: number) => THREE.Material
): GoldenHallPillarBuild[] {
  if (parts.hallGroup.children.length === 0) {
    buildHallGroup(parts);
  }
  const pillarsGroup = parts.hallGroup.children.find((c) =>
    c.name.startsWith(GOLDEN_HALL_NODE_NAMES.hallPillarPrefix)
  ) as THREE.Group | undefined;
  const targetGroup = pillarsGroup ?? parts.hallGroup;
  targetGroup.clear();

  const dims = computeHallDimensions(parts.layout, quality);
  const blockSize = parts.layout.footprint.blockSize;
  const columnCount = Math.max(4, parts.layout.footprint.columnCount);

  const pillarCount =
    quality === 'ultra' || quality === 'ultra2'
      ? Math.max(8, Math.round(columnCount / 2))
      : quality === 'medium'
        ? Math.max(6, Math.round(columnCount / 3))
        : Math.max(4, Math.round(columnCount / 4));

  const thetaStep = (Math.PI * 2) / pillarCount;
  const innerRadius = Math.max(dims.radius * 0.92, parts.layout.base.outerRadius + blockSize * 1.5);
  const pillarWidth = Math.max(blockSize * 0.32, dims.radius * 0.02);
  const pillarDepth = Math.max(blockSize * 0.48, dims.radius * 0.03);
  const pillarHeight = Math.max(dims.wallHeight * 0.9, parts.layout.footprint.height + blockSize * 8);

  const builds: GoldenHallPillarBuild[] = [];

  for (let i = 0; i < pillarCount; i += 1) {
    const angle = i * thetaStep;
    const x = Math.cos(angle) * innerRadius;
    const z = Math.sin(angle) * innerRadius;

    const geometry = new THREE.BoxGeometry(pillarWidth, pillarHeight, pillarDepth, 1, 8, 1);
    geometry.computeVertexNormals();

    const mat =
      materialFactory?.(i) ??
      new THREE.MeshStandardMaterial({
        color: 0x2d1c12,
        metalness: 0.44,
        roughness: 0.55,
        emissive: 0x0d0906,
        emissiveIntensity: 0.05,
      });

    const pillar = new THREE.Mesh(geometry, mat);
    pillar.name = `${GOLDEN_HALL_NODE_NAMES.hallPillarPrefix}${i}`;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    pillar.position.set(x, pillarHeight * 0.5, z);
    pillar.lookAt(0, pillar.position.y, 0);
    pillar.userData.goldenHall = { kind: 'hall-pillar', index: i };

    targetGroup.add(pillar);
    builds.push({ mesh: pillar });
  }

  return builds;
}

export function addHallPanels(
  parts: GoldenHallParts,
  quality: QualityLevel = 'ultra',
  material?: THREE.Material
): GoldenHallPanelBuild[] {
  if (parts.hallGroup.children.length === 0) {
    buildHallGroup(parts);
  }
  const panelsGroup = parts.hallGroup.children.find((c) =>
    c.name.startsWith(GOLDEN_HALL_NODE_NAMES.hallPanelPrefix)
  ) as THREE.Group | undefined;
  const targetGroup = panelsGroup ?? parts.hallGroup;
  targetGroup.clear();

  if (quality === 'low') {
    targetGroup.visible = false;
    return [];
  }
  targetGroup.visible = true;

  const dims = computeHallDimensions(parts.layout, quality);
  const blockSize = parts.layout.footprint.blockSize;
  const columnCount = Math.max(4, parts.layout.footprint.columnCount);

  const panelCount =
    quality === 'ultra' || quality === 'ultra2'
      ? Math.max(12, columnCount)
      : Math.max(8, Math.round(columnCount * 0.6));

  const thetaStep = (Math.PI * 2) / panelCount;
  const radius = dims.radius * 0.985;
  const panelWidth = Math.max(blockSize * 0.4, (2 * Math.PI * radius * 0.04));
  const panelHeight = Math.max(blockSize * 3, dims.wallHeight * 0.4);
  const panelThickness = Math.max(blockSize * 0.15, radius * 0.01);

  const builds: GoldenHallPanelBuild[] = [];

  for (let i = 0; i < panelCount; i += 1) {
    const angle = i * thetaStep;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const geometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelThickness, 1, 2, 1);
    geometry.computeVertexNormals();

    const mat =
      material ??
      new THREE.MeshStandardMaterial({
        color: 0x1c1310,
        metalness: 0.28,
        roughness: 0.58,
        emissive: 0x0a0806,
        emissiveIntensity: 0.06,
      });

    const panel = new THREE.Mesh(geometry, mat);
    panel.name = `${GOLDEN_HALL_NODE_NAMES.hallPanelPrefix}${i}`;
    panel.castShadow = false;
    panel.receiveShadow = true;
    panel.position.set(x, panelHeight * 0.5 + blockSize * 0.5, z);
    panel.lookAt(0, panel.position.y, 0);
    panel.userData.goldenHall = { kind: 'hall-panel', index: i };

    targetGroup.add(panel);
    builds.push({ mesh: panel });
  }

  return builds;
}
