import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';
import { PlatformLayout } from './platformLayout';

export interface FootprintDecorParams {
  dimensions: BoardDimensions;
  board: BoardRenderConfig;
  platformLayout: PlatformLayout;
  debugLiftBlocks?: number;
}

const EPS = 1e-4;
const FOOTPRINT_RING_CLEARANCE_RATIO = 0.02;
const FOOTPRINT_RING_CLEARANCE_MIN = 0.002;

export function createFootprintDecor(params: FootprintDecorParams): THREE.Group {
  const { dimensions, board, platformLayout } = params;
  const group = new THREE.Group();
  group.name = 'footprintDecor';
  group.userData.debugTag = {
    kind: 'footprintDecor',
    sourceFile: 'src/render/footprintDecor.ts',
  };

  const towerRadius = board.towerRadius;
  const halfDepth = board.blockDepth * 0.5;
  const footprintInner = Math.max(0, towerRadius - halfDepth);
  const floorY = -board.blockSize * 0.5;
  const liftY = (params.debugLiftBlocks ?? 0) * board.blockSize;
  const yBase = floorY + board.blockSize * 0.02 + liftY; // higher above cube floor for visibility
  const ringClearance = Math.max(
    board.blockSize * FOOTPRINT_RING_CLEARANCE_RATIO,
    FOOTPRINT_RING_CLEARANCE_MIN
  );
  const maxFootprintOuter = Math.min(
    platformLayout.ringA.outer - ringClearance,
    platformLayout.ringB.outer - ringClearance,
    platformLayout.ringC.inner - ringClearance
  );
  const footprintOuter = Math.min(towerRadius + halfDepth, maxFootprintOuter);

  // Layer 1: thin ring engraving
  const ringInner = footprintInner;
  const ringOuter = Math.max(ringInner + EPS, footprintOuter);
  const ringSegments = Math.max(24, dimensions.width * 2);
  const ringGeometry = new THREE.RingGeometry(ringInner, ringOuter, ringSegments, 1);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x9c7a3a,
    metalness: 0.46,
    roughness: 0.52,
    emissive: 0x0d0a06,
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = yBase;
  ringMesh.name = 'footprintRingEngraving';
  ringMesh.renderOrder = 1;
  group.add(ringMesh);

  // Layer 2: cell sectors
  const sectorInner = ringInner;
  const sectorOuter = ringOuter;
  const sectorGeometry = buildCellSectorGeometry(dimensions.width, sectorInner, sectorOuter);
  const sectorMaterial = new THREE.MeshStandardMaterial({
    color: 0xf3d8a2,
    metalness: 0.52,
    roughness: 0.42,
    emissive: 0xf6d8a2,
    emissiveIntensity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -1.5,
  });
  const sectorMesh = new THREE.Mesh(sectorGeometry, sectorMaterial);
  sectorMesh.rotation.x = 0; // geometry already in XZ plane; keep flat on platform
  sectorMesh.position.y = yBase + 0.002;
  sectorMesh.name = 'footprintCellSectors';
  sectorMesh.renderOrder = 2;
  group.add(sectorMesh);

  // Layer 3: radial guide lines to preserve per-cell placement cues.
  const guideGeometry = buildRadialGuideLinesGeometry(
    dimensions.width,
    sectorInner,
    sectorOuter
  );
  const guideMaterial = new THREE.LineBasicMaterial({
    color: 0xe9ecf5,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const guides = new THREE.LineSegments(guideGeometry, guideMaterial);
  guides.position.y = yBase + board.blockSize * 0.004;
  guides.name = 'footprintRadialGuides';
  guides.renderOrder = 3;
  group.add(guides);

  return group;
}

function buildCellSectorGeometry(
  columnCount: number,
  innerRadius: number,
  outerRadius: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const step = (Math.PI * 2) / columnCount;

  const pushVertex = (x: number, y: number, z: number, u: number, v: number) => {
    positions.push(x, y, z);
    normals.push(0, 1, 0);
    uvs.push(u, v);
    return positions.length / 3 - 1;
  };

  for (let col = 0; col < columnCount; col += 1) {
    const t0 = (col - 0.5) * step;
    const t1 = (col + 0.5) * step;
    const c0 = Math.cos(t0);
    const s0 = Math.sin(t0);
    const c1 = Math.cos(t1);
    const s1 = Math.sin(t1);

    const v0 = pushVertex(innerRadius * c0, 0, innerRadius * s0, col / columnCount, 0);
    const v1 = pushVertex(outerRadius * c0, 0, outerRadius * s0, col / columnCount, 1);
    const v2 = pushVertex(innerRadius * c1, 0, innerRadius * s1, (col + 1) / columnCount, 0);
    const v3 = pushVertex(outerRadius * c1, 0, outerRadius * s1, (col + 1) / columnCount, 1);

    indices.push(v0, v1, v2, v2, v1, v3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildRadialGuideLinesGeometry(
  columnCount: number,
  innerRadius: number,
  outerRadius: number
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const step = (Math.PI * 2) / columnCount;
  for (let col = 0; col < columnCount; col += 1) {
    const angle = step * (col + 0.5);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    vertices.push(
      cos * outerRadius,
      0,
      sin * outerRadius,
      cos * innerRadius,
      0,
      sin * innerRadius
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
