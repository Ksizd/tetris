import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  addLowerBaseDisk,
  addCenterInsert,
  createGoldenHallParts,
  GOLDEN_HALL_NODE_NAMES,
  getBaseDetailName,
  getBaseStepName,
  buildBaseSteps,
  buildBaseDetails,
  buildHallGroup,
  addHallMainWall,
  addHallLightRim,
  addHallPillars,
  addHallPanels,
  addHallFloorSeam,
  computeHallCameraConstraints,
} from '../goldenHallEnvironment';
import { GoldenHallLayout } from '../goldenHallLayout';
import { createGoldenHallMaterials } from '../goldenHallMaterials';

const SAMPLE_LAYOUT: GoldenHallLayout = {
  footprint: {
    towerRadius: 2,
    outerRadius: 2.4,
    innerRadius: 1.6,
    height: 12,
    blockSize: 1,
    columnCount: 32,
  },
  base: {
    outerRadius: 3.6,
    height: 2,
    stepCount: 3,
    stepInsetRatio: 0.12,
    topY: 0,
    bottomY: -2,
  },
  hallRadius: 6.2,
  wallHeight: 24,
  wallCurvatureSegments: 64,
};

describe('goldenHallEnvironment grouping', () => {
  it('creates base grouping hierarchy with debug-friendly names', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);

    expect(parts.root.name).toBe(GOLDEN_HALL_NODE_NAMES.root);
    expect(parts.baseGroup.name).toBe(GOLDEN_HALL_NODE_NAMES.baseGroup);
    expect(parts.baseStepsGroup.name).toBe(GOLDEN_HALL_NODE_NAMES.baseStepsGroup);
    expect(parts.baseCenterGroup.name).toBe(GOLDEN_HALL_NODE_NAMES.baseCenterGroup);
    expect(parts.baseDetailsGroup.name).toBe(GOLDEN_HALL_NODE_NAMES.baseDetailsGroup);

    expect(parts.root.children).toContain(parts.baseGroup);
    expect(parts.baseGroup.children).toContain(parts.baseStepsGroup);
    expect(parts.baseGroup.children).toContain(parts.baseCenterGroup);
    expect(parts.baseGroup.children).toContain(parts.baseDetailsGroup);

    expect(parts.baseGroup.position.y).toBe(SAMPLE_LAYOUT.base.topY);
    expect(parts.layout).toBe(SAMPLE_LAYOUT);

    expect(getBaseStepName(0)).toBe('hall-base-step-0');
    expect(getBaseDetailName(2)).toBe('hall-base-detail-2');
  });

  it('adds lower base disk with correct placement and segmentation', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);
    const { lowerDisk } = addLowerBaseDisk(parts);

    expect(parts.baseStepsGroup.children).toContain(lowerDisk);
    expect(lowerDisk.name).toBe(getBaseStepName(0));

    const geo = lowerDisk.geometry as THREE.CylinderGeometry;
    expect(geo.parameters.height).toBeGreaterThan(0);
    expect(geo.parameters.heightSegments).toBeGreaterThanOrEqual(1);
    expect(geo.parameters.radialSegments).toBe(SAMPLE_LAYOUT.wallCurvatureSegments);
    expect(lowerDisk.castShadow).toBe(true);
    expect(lowerDisk.receiveShadow).toBe(true);

    // Top should sit at y=0 (baseGroup origin), mesh is centered at -h/2.
    const halfHeight = geo.parameters.height / 2;
    expect(lowerDisk.position.y).toBeCloseTo(-halfHeight, 6);
  });

  it('builds multi-tier base with inset radii and gap to board plane', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);
    const { steps, topGap, totalHeight } = buildBaseSteps(parts);

    expect(steps.length).toBe(SAMPLE_LAYOUT.base.stepCount);
    expect(topGap).toBeGreaterThan(0);
    expect(totalHeight).toBeGreaterThan(0);

    // Radii should decrease or stay reasonable per inset ratio.
    const radii = steps.map((step) => {
      const geo = step.mesh.geometry as THREE.CylinderGeometry;
      return Math.max(geo.parameters.radiusTop, geo.parameters.radiusBottom);
    });
    for (let i = 1; i < radii.length; i += 1) {
      expect(radii[i]).toBeLessThanOrEqual(radii[i - 1]);
    }
    steps.forEach((s) => {
      expect(s.mesh.castShadow).toBe(true);
      expect(s.mesh.receiveShadow).toBe(true);
    });

    // Top surface should sit slightly below y=0.
    const last = steps[steps.length - 1];
    expect(last.topY).toBeLessThan(0);
    expect(Math.abs(last.topY + topGap)).toBeLessThan(1e-6);
  });

  it('adds center insert that fits within inner footprint and aligns to board plane', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);
    const { disk, radius } = addCenterInsert(parts);

    expect(parts.baseCenterGroup.children).toContain(disk);
    expect(radius).toBeLessThanOrEqual(SAMPLE_LAYOUT.footprint.innerRadius * 0.98);
    expect(radius).toBeGreaterThan(SAMPLE_LAYOUT.footprint.innerRadius * 0.7);

    const geo = disk.geometry as THREE.CylinderGeometry;
    const topY = disk.position.y + geo.parameters.height * 0.5;
    expect(Math.abs(topY)).toBeLessThan(1e-6);
    expect(disk.castShadow).toBe(true);
    expect(disk.receiveShadow).toBe(true);
  });

  it('builds decorative details with rhythm and LOD (ultra vs low)', () => {
    const partsUltra = createGoldenHallParts(SAMPLE_LAYOUT);
    const detailsUltra = buildBaseDetails(partsUltra, 'ultra');
    expect(detailsUltra.sectors.length).toBeGreaterThan(0);
    expect(detailsUltra.pedestals.length).toBeGreaterThan(0);
    expect(detailsUltra.rim).toBeDefined();
    expect(partsUltra.baseDetailsGroup.children.length).toBeGreaterThan(0);

    detailsUltra.pedestals.forEach((mesh) => {
      const r = Math.hypot(mesh.position.x, mesh.position.z);
      expect(r).toBeGreaterThan(SAMPLE_LAYOUT.footprint.outerRadius);
    });

    const partsLow = createGoldenHallParts(SAMPLE_LAYOUT);
    const detailsLow = buildBaseDetails(partsLow, 'low');
    expect(detailsLow.sectors.length).toBe(0);
    expect(detailsLow.pedestals.length).toBe(0);
    expect(detailsLow.rim).toBeUndefined();
    expect(partsLow.baseDetailsGroup.visible).toBe(false);
  });

  it('builds hall group scaffold with named children for debug toggles', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);
    const hall = buildHallGroup(parts);

    expect(parts.hallGroup.name).toBe(GOLDEN_HALL_NODE_NAMES.hallGroup);
    const names = parts.hallGroup.children.map((c) => c.name);
    expect(names).toContain(GOLDEN_HALL_NODE_NAMES.hallWall);
    expect(names).toContain(GOLDEN_HALL_NODE_NAMES.hallRim);
    expect(names).toContain(`${GOLDEN_HALL_NODE_NAMES.hallPillarPrefix}group`);
    expect(names).toContain(`${GOLDEN_HALL_NODE_NAMES.hallPanelPrefix}group`);
    expect(hall.pillars).toEqual([]);
    expect(hall.panels).toEqual([]);
  });

  it('adds main hall wall with correct radius, height and open top', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);
    buildHallGroup(parts);
    const wall = addHallMainWall(parts, 'medium');

    expect(wall.name).toBe(`${GOLDEN_HALL_NODE_NAMES.hallWall}-mesh`);
    expect(wall.parent?.name).toBe(GOLDEN_HALL_NODE_NAMES.hallWall);
    const geo = wall.geometry as THREE.CylinderGeometry;
    expect(geo.parameters.openEnded).toBe(true);
    expect(geo.parameters.radiusTop).toBeCloseTo(SAMPLE_LAYOUT.hallRadius, 6);
    expect(geo.parameters.height).toBeGreaterThan(SAMPLE_LAYOUT.footprint.height);
    const seamHeight = (wall.userData?.seamHeight as number) ?? 0;
    expect(Math.abs(wall.position.y - (geo.parameters.height * 0.5 + seamHeight))).toBeLessThan(0.2);
    expect(wall.castShadow).toBe(false);
    expect(wall.receiveShadow).toBe(true);
  });

  it('adds light rim for ultra and hides for low', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);
    buildHallGroup(parts);
    const rim = addHallLightRim(parts, 'ultra');
    expect(rim).toBeTruthy();
    if (rim) {
      expect(rim.name).toBe(`${GOLDEN_HALL_NODE_NAMES.hallRim}-mesh`);
      expect(rim.parent?.name).toBe(GOLDEN_HALL_NODE_NAMES.hallRim);
      expect(rim.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    }

    const partsLow = createGoldenHallParts(SAMPLE_LAYOUT);
    buildHallGroup(partsLow);
    const rimLow = addHallLightRim(partsLow, 'low');
    expect(rimLow).toBeNull();
    const rimGroup = partsLow.hallGroup.children.find(
      (c) => c.name === GOLDEN_HALL_NODE_NAMES.hallRim
    );
    expect(rimGroup?.visible).toBe(false);
  });

  it('adds pillars with inward facing look and LOD count', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);
    buildHallGroup(parts);
    const pillars = addHallPillars(parts, 'ultra');
    expect(pillars.length).toBeGreaterThanOrEqual(8);
    pillars.forEach((p, idx) => {
      expect(p.mesh.name).toBe(`${GOLDEN_HALL_NODE_NAMES.hallPillarPrefix}${idx}`);
      const r = Math.hypot(p.mesh.position.x, p.mesh.position.z);
      expect(r).toBeGreaterThan(SAMPLE_LAYOUT.base.outerRadius);
      expect(p.mesh.castShadow).toBe(true);
      expect(p.mesh.receiveShadow).toBe(true);
    });

    const partsLow = createGoldenHallParts(SAMPLE_LAYOUT);
    buildHallGroup(partsLow);
    const pillarsLow = addHallPillars(partsLow, 'low');
    expect(pillarsLow.length).toBeGreaterThanOrEqual(4);
  });

  it('adds wall panels in ultra/medium and hides on low', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);
    buildHallGroup(parts);
    const panels = addHallPanels(parts, 'ultra');
    expect(panels.length).toBeGreaterThanOrEqual(12);
    panels.forEach((p, idx) => {
      expect(p.mesh.name).toBe(`${GOLDEN_HALL_NODE_NAMES.hallPanelPrefix}${idx}`);
    });

    const partsMedium = createGoldenHallParts(SAMPLE_LAYOUT);
    buildHallGroup(partsMedium);
    const panelsMed = addHallPanels(partsMedium, 'medium');
    expect(panelsMed.length).toBeGreaterThanOrEqual(8);

    const partsLow = createGoldenHallParts(SAMPLE_LAYOUT);
    buildHallGroup(partsLow);
    const panelsLow = addHallPanels(partsLow, 'low');
    expect(panelsLow.length).toBe(0);
    const panelGroup = partsLow.hallGroup.children.find(
      (c) => c.name === `${GOLDEN_HALL_NODE_NAMES.hallPanelPrefix}group`
    );
    expect(panelGroup?.visible).toBe(false);
  });

  it('adds floor-wall seam ring to avoid coplanar contact', () => {
    const parts = createGoldenHallParts(SAMPLE_LAYOUT);
    buildHallGroup(parts);
    const seam = addHallFloorSeam(parts, 'ultra');

    expect(seam.name).toBe(GOLDEN_HALL_NODE_NAMES.hallSeam);
    const geo = seam.geometry as THREE.CylinderGeometry;
    expect(geo.parameters.height).toBeGreaterThan(0);
    expect(seam.position.y).toBeCloseTo(geo.parameters.height * 0.5, 6);
    expect(seam.castShadow).toBe(true);
    expect(seam.receiveShadow).toBe(true);
  });

  it('computes hall camera constraints to avoid clipping walls', () => {
    const constraints = computeHallCameraConstraints(SAMPLE_LAYOUT, 'medium');
    expect(constraints.minRadius).toBeGreaterThan(SAMPLE_LAYOUT.footprint.outerRadius);
    expect(constraints.maxRadius).toBeGreaterThan(constraints.minRadius);
    expect(constraints.near).toBeGreaterThan(0);
    expect(constraints.far).toBeGreaterThan(SAMPLE_LAYOUT.hallRadius * 2);
  });
});

describe('goldenHall materials env map balance', () => {
  it('keeps hall envMapIntensity below hero cubes while allowing shadow flags on solids', () => {
    const mats = createGoldenHallMaterials({ quality: 'ultra', envMap: new THREE.Texture() });
    expect(mats.baseInner.envMapIntensity).toBeLessThan(1.5);
    expect(mats.baseOuter.envMapIntensity).toBeLessThan(1);
    expect(mats.pillar.envMapIntensity).toBeLessThan(1);
    expect(mats.wallMain.envMapIntensity).toBeLessThan(1.1);
  });
});
