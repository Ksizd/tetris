import * as THREE from 'three';
import type { DebugTag } from './debug/objectInspectorTypes';

export interface FootprintLavaSparksEmitterDebugParams {
  columns: number;
  emitterTheta: Float32Array;
  emitterRadius: Float32Array;
  emitterKind: Uint8Array;
  anchorY: number;
  blockSize: number;
}

const EMITTER_RING0 = 0;
const EMITTER_RING1 = 1;
const EMITTER_RADIAL = 2;

export function createFootprintLavaSparksEmitterDebugPoints(
  params: FootprintLavaSparksEmitterDebugParams
): THREE.Points {
  const count = Math.max(0, Math.floor(params.columns) * 3);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const theta = params.emitterTheta[i];
    const radius = params.emitterRadius[i];
    const kind = params.emitterKind[i];
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = params.anchorY;
    positions[i * 3 + 2] = z;

    if (kind === EMITTER_RADIAL) {
      colors[i * 3 + 0] = 1.0;
      colors[i * 3 + 1] = 0.92;
      colors[i * 3 + 2] = 0.25;
    } else if (kind === EMITTER_RING1) {
      colors[i * 3 + 0] = 1.0;
      colors[i * 3 + 1] = 0.25;
      colors[i * 3 + 2] = 0.85;
    } else {
      colors[i * 3 + 0] = 0.2;
      colors[i * 3 + 1] = 0.95;
      colors[i * 3 + 2] = 1.0;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: params.blockSize * 0.06,
    sizeAttenuation: true,
    vertexColors: true,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.95,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'footprintSparksEmitters';
  points.visible = false;
  points.userData.debugSelectable = false;
  points.userData.debugTag = {
    kind: 'hallFootprint',
    sourceFile: 'src/render/footprintLavaSparksEmitters.ts',
    sourceFunction: 'createFootprintLavaSparksEmitterDebugPoints',
  } satisfies DebugTag;
  return points;
}

