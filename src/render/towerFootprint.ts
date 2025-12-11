import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';
import type { PlatformLayout } from './platformLayout';

export interface TowerFootprint {
  group: THREE.Group;
}

export interface FootprintGeometry {
  ringGeometry: THREE.RingGeometry;
  lineGeometry: THREE.BufferGeometry;
  footprintY: number;
  innerRadius: number;
  outerRadius: number;
}

export interface FootprintParamsBase {
  dimensions: BoardDimensions;
  board: BoardRenderConfig;
  radialSegments?: number;
}

export interface FootprintDebugParams extends FootprintParamsBase {
  color?: THREE.ColorRepresentation;
  lineWidth?: number;
  opacity?: number;
}

export interface FootprintDecorParams extends FootprintParamsBase {
  color?: THREE.ColorRepresentation;
  lineColor?: THREE.ColorRepresentation;
  opacity?: number;
  lineOpacity?: number;
}

/**
 * Returns the outer radius of the footprint ring (matches tower footprint including bevel).
 */
export function getFootprintRadius(board: BoardRenderConfig): number {
  return board.towerRadius + board.blockDepth * 0.5;
}

function createFootprintGeometries(params: FootprintParamsBase): FootprintGeometry {
  const { dimensions, board } = params;
  const radialSegments = params.radialSegments ?? Math.max(12, dimensions.width * 2);
  const outerRadius = getFootprintRadius(board);
  const innerRadius = Math.max(board.towerRadius - board.blockDepth * 0.5, outerRadius * 0.55);
  // Place footprint at the bottom face of the first layer (just above to avoid z-fighting).
  const footprintY = -board.blockSize * 0.5 + board.blockSize * 0.001;

  const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, radialSegments, 1);

  const lineVertices: number[] = [];
  const step = (2 * Math.PI) / dimensions.width;
  for (let i = 0; i < dimensions.width; i += 1) {
    const angle = step * (i + 0.5);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const outerX = cos * outerRadius;
    const outerZ = sin * outerRadius;
    const innerX = cos * innerRadius;
    const innerZ = sin * innerRadius;
    lineVertices.push(outerX, 0, outerZ, innerX, 0, innerZ);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));

  return { ringGeometry, lineGeometry, footprintY, innerRadius, outerRadius };
}

/**
 * Legacy/debug footprint: wireframe-like ring + radial lines for guidance.
 */
export function createTowerFootprintDebug({
  dimensions,
  board,
  radialSegments,
  color = 0xe4e8f0,
  lineWidth = 0.022,
  opacity = 0.4,
}: FootprintDebugParams): TowerFootprint {
  const { ringGeometry, lineGeometry, footprintY } = createFootprintGeometries({
    dimensions,
    board,
    radialSegments,
  });

  const group = new THREE.Group();

  const ringMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = footprintY;
  ringMesh.renderOrder = -5;
  ringMesh.name = 'towerFootprintDebugBase';
  ringMesh.userData.debugTag = {
    kind: 'footprintCore',
    sourceFile: 'src/render/towerFootprint.ts',
    sourceFunction: 'createTowerFootprintDebug',
  };
  group.add(ringMesh);

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xe9ecf5,
    linewidth: lineWidth,
    transparent: true,
    opacity: Math.min(1, opacity + 0.2),
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 1.5,
    polygonOffsetUnits: 1.5,
    toneMapped: false,
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.rotation.x = 0;
  lines.position.y = footprintY + 0.0005;
  lines.renderOrder = 0;
  lines.name = 'towerFootprintDebugSegments';
  lines.userData.debugTag = {
    kind: 'footprintCore',
    sourceFile: 'src/render/towerFootprint.ts',
    sourceFunction: 'createTowerFootprintDebug',
  };
  group.add(lines);

  group.name = 'towerFootprintDebug';
  group.userData.debugTag = {
    kind: 'footprintCore',
    sourceFile: 'src/render/towerFootprint.ts',
    sourceFunction: 'createTowerFootprintDebug',
  };
  return { group };
}

/**
 * Production/decor footprint placeholder for gameplay. Currently matches legacy visuals,
 * ready to be restyled in later steps (15.3.2+).
 */
export function createTowerFootprintDecor({
  dimensions,
  board,
  radialSegments,
  color = 0xe4e8f0,
  lineColor = 0xe9ecf5,
  opacity = 0.35,
  lineOpacity = 0.8,
}: FootprintDecorParams): TowerFootprint {
  const { ringGeometry, lineGeometry, footprintY } = createFootprintGeometries({
    dimensions,
    board,
    radialSegments,
  });

  const group = new THREE.Group();

  const ringMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = footprintY;
  ringMesh.renderOrder = -4;
  ringMesh.name = 'towerFootprintBase';
  ringMesh.userData.debugTag = {
    kind: 'footprintDecor',
    sourceFile: 'src/render/towerFootprint.ts',
    sourceFunction: 'createTowerFootprintDecor',
  };
  group.add(ringMesh);

  const lineMaterial = new THREE.LineBasicMaterial({
    color: lineColor,
    linewidth: lineWidthForDecor(board),
    transparent: true,
    opacity: lineOpacity,
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 1.5,
    polygonOffsetUnits: 1.5,
    toneMapped: false,
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.rotation.x = 0;
  lines.position.y = footprintY + 0.0005;
  lines.renderOrder = -3;
  lines.name = 'towerFootprintSegments';
  lines.userData.debugTag = {
    kind: 'footprintDecor',
    sourceFile: 'src/render/towerFootprint.ts',
    sourceFunction: 'createTowerFootprintDecor',
  };
  group.add(lines);

  group.name = 'towerFootprint';
  group.userData.debugTag = {
    kind: 'footprintDecor',
    sourceFile: 'src/render/towerFootprint.ts',
    sourceFunction: 'createTowerFootprintDecor',
  };
  group.position.y = 0;
  return { group };
}

function lineWidthForDecor(board: BoardRenderConfig): number {
  return Math.max(0.01, board.blockSize * 0.02);
}
