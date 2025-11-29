import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig } from './boardConfig';

export interface TowerFootprint {
  group: THREE.Group;
}

interface TowerFootprintParams {
  dimensions: BoardDimensions;
  board: BoardRenderConfig;
  radialSegments?: number;
  color?: THREE.ColorRepresentation;
  lineWidth?: number;
  opacity?: number;
}

/**
 * Creates a flat segmented footprint on the floor to guide placement when debug rings are hidden.
 */
export function createTowerFootprint({
  dimensions,
  board,
  radialSegments = Math.max(12, dimensions.width * 2),
  color = 0xe4e8f0,
  lineWidth = 0.022,
  opacity = 0.35,
}: TowerFootprintParams): TowerFootprint {
  const group = new THREE.Group();
  // Align footprint with actual cube footprint: centers at towerRadius, faces at +/- blockDepth/2.
  const outerRadius = board.towerRadius + board.blockDepth * 0.5;
  const innerRadius = Math.max(board.towerRadius - board.blockDepth * 0.5, outerRadius * 0.55);
  // Sit just above the floor to avoid z-fighting; blocks cover it via depth test.
  const footprintY = board.blockSize * 0.0005;

  // Base ring fill
  const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, radialSegments, 1);
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
  ringMesh.name = 'towerFootprintBase';
  ringMesh.receiveShadow = false;
  ringMesh.castShadow = false;
  group.add(ringMesh);

  // Radial segment lines for column guidance
  const lineVertices: number[] = [];
  const step = (2 * Math.PI) / dimensions.width;
  for (let i = 0; i < dimensions.width; i += 1) {
    // place lines on cube boundaries: center angles +/- half step, so boundary i at (i + 0.5) * step
    const angle = step * (i + 0.5);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const outerX = cos * outerRadius;
    const outerZ = sin * outerRadius;
    const innerX = cos * (innerRadius);
    const innerZ = sin * (innerRadius);
    lineVertices.push(outerX, 0, outerZ, innerX, 0, innerZ);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(lineVertices), 3)
  );
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xe9ecf5,
    linewidth: 2,
    transparent: true,
    opacity: 0.8,
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 1.5,
    polygonOffsetUnits: 1.5,
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.rotation.x = 0; // already in XZ plane; keep flat on the floor
  lines.position.y = footprintY + 0.0005;
  lines.renderOrder = 0;
  lines.name = 'towerFootprintSegments';
  group.add(lines);

  group.name = 'towerFootprint';
  group.position.y = 0;

  return { group };
}
