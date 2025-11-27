import * as THREE from 'three';
import { BoardDimensions } from '../core/types';
import { BoardRenderConfig, createBoardRenderConfig } from './boardConfig';
import { BoardToWorldMapper } from './boardToWorldMapper';

export interface BoardPlaceholder {
  group: THREE.Group;
  rails: THREE.Mesh[];
  baseRing: THREE.Mesh;
  innerLiner?: THREE.Mesh;
}

/**
 * Creates a static placeholder for the cylindrical board: thin vertical rails and a base ring.
 * Does not render actual board data — used as a visual scaffold before instancing is wired in.
 */
export function createBoardPlaceholder(
  dimensions: BoardDimensions,
  config?: Partial<BoardRenderConfig>
): BoardPlaceholder {
  const resolvedConfig = createBoardRenderConfig(dimensions, config);
  const mapper = new BoardToWorldMapper(dimensions, resolvedConfig);
  const group = new THREE.Group();

  const height =
    (dimensions.height - 1) * resolvedConfig.verticalSpacing + resolvedConfig.blockSize;
  const railRadius = resolvedConfig.blockSize * 0.15;
  const railGeometry = new THREE.CylinderGeometry(railRadius, railRadius, height, 8, 1, true);
  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f8bff,
    opacity: 0.25,
    transparent: true,
    metalness: 0,
    roughness: 0.6,
  });

  const rails: THREE.Mesh[] = [];
  for (let x = 0; x < dimensions.width; x += 1) {
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    const bottomPos = mapper.cellToWorldPosition(x, 0);
    rail.position.set(bottomPos.x, height / 2, bottomPos.z);
    rail.rotation.y = (2 * Math.PI * x) / dimensions.width;
    rail.castShadow = false;
    rail.receiveShadow = false;
    group.add(rail);
    rails.push(rail);
  }

  const ringTubeRadius = railRadius * 1.2;
  const ringGeometry = new THREE.TorusGeometry(
    resolvedConfig.towerRadius,
    ringTubeRadius,
    6,
    Math.max(12, dimensions.width * 2)
  );
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x5fb7ff,
    opacity: 0.35,
    transparent: true,
    metalness: 0,
    roughness: 0.5,
  });
  const baseRing = new THREE.Mesh(ringGeometry, ringMaterial);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = resolvedConfig.blockSize * 0.25;
  baseRing.castShadow = false;
  baseRing.receiveShadow = false;
  group.add(baseRing);

  const linerHeight = height + resolvedConfig.blockSize * 2;
  const linerGeometry = new THREE.CylinderGeometry(
    resolvedConfig.towerRadius - resolvedConfig.blockSize * 0.05,
    resolvedConfig.towerRadius - resolvedConfig.blockSize * 0.05,
    linerHeight,
    Math.max(24, dimensions.width * 2),
    1,
    true
  );
  // Remove golden fill between rails per visual polish feedback: keep liner optional for future use.
  linerGeometry.dispose();

  return { group, rails, baseRing };
}
