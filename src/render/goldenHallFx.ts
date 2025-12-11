import * as THREE from 'three';
import { GoldenHallLayout } from './goldenHallLayout';
import { QualityLevel } from './renderConfig';
import { createGoldenHallMaterials } from './goldenHallMaterials';

export interface GoldenHallDustSystem {
  group: THREE.Group;
  update: (dtMs: number) => void;
}

interface DustParticleState {
  base: THREE.Vector3;
  phase: number;
  speed: number;
  amplitude: number;
}

export interface GoldenHallDustParams {
  layout: GoldenHallLayout;
  quality?: QualityLevel;
  enabled?: boolean;
  material?: THREE.PointsMaterial;
  seed?: number;
  useDustFx?: boolean;
}

const GOLDEN_HALL_DUST_NAME = 'hall-dust';

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function chooseCount(quality: QualityLevel): number {
  if (quality === 'low') return 0;
  if (quality === 'medium') return 140;
  return 220; // ultra / ultra2
}

function createDustMaterial(params: GoldenHallDustParams, quality: QualityLevel): THREE.PointsMaterial {
  if (params.material) {
    return params.material;
  }
  const set = createGoldenHallMaterials({
    quality,
    useDustFx: params.useDustFx,
    useLightShafts: params.useLightShafts,
  });
  return set.dustParticle;
}

export function createGoldenHallDust(params: GoldenHallDustParams): GoldenHallDustSystem | null {
  const quality = params.quality ?? 'ultra';
  if (params.enabled === false || params.useDustFx === false || quality === 'low') {
    return null;
  }

  const count = chooseCount(quality);
  if (count === 0) {
    return null;
  }

  const rand = makeRandom(params.seed ?? 20241212);
  const mat = createDustMaterial(params, quality);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  const { layout } = params;
  const radius = layout.hallRadius * 0.92;
  const minY = Math.max(layout.footprint.height * 0.85, layout.wallHeight * 0.25);
  const maxY = Math.max(minY + layout.footprint.blockSize * 2, layout.wallHeight * 0.55);

  const states: DustParticleState[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = THREE.MathUtils.lerp(minY, maxY, rand());
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    states.push({
      base: new THREE.Vector3(x, y, z),
      phase: rand() * Math.PI * 2,
      speed: THREE.MathUtils.lerp(0.25, 0.75, rand()),
      amplitude: THREE.MathUtils.lerp(0.08, 0.22, rand()) * layout.footprint.blockSize,
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();

  const points = new THREE.Points(geometry, mat);
  points.frustumCulled = true;
  points.renderOrder = 1;

  const group = new THREE.Group();
  group.name = GOLDEN_HALL_DUST_NAME;
  group.add(points);

  let time = 0;
  const update = (dtMs: number): void => {
    time += dtMs / 1000;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < count; i += 1) {
      const s = states[i];
      const wobble = Math.sin(time * s.speed + s.phase) * s.amplitude;
      posAttr.setXYZ(i, s.base.x + wobble * 0.15, s.base.y + wobble, s.base.z - wobble * 0.12);
    }
    posAttr.needsUpdate = true;
  };

  return { group, update };
}

export interface GoldenHallLightShafts {
  group: THREE.Group;
  update: (dtMs: number) => void;
}

export interface GoldenHallLightShaftParams {
  layout: GoldenHallLayout;
  quality?: QualityLevel;
  material?: THREE.Material;
  count?: number;
  seed?: number;
  useLightShafts?: boolean;
}

export function createGoldenHallLightShafts(params: GoldenHallLightShaftParams): GoldenHallLightShafts | null {
  const quality = params.quality ?? 'ultra';
  const allowLightShafts = params.useLightShafts ?? quality !== 'medium';
  if (quality === 'low' || allowLightShafts === false) {
    return null;
  }
  const count = params.count ?? (quality === 'medium' ? 2 : 3);
  const rand = makeRandom(params.seed ?? 20241213);

  const mat =
    params.material ??
    new THREE.MeshBasicMaterial({
      color: 0xfff5e0,
      transparent: true,
      opacity: quality === 'medium' ? 0.32 : 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

  const { hallRadius, wallHeight, footprint } = params.layout;
  const shafts: THREE.Mesh[] = [];
  const group = new THREE.Group();
  group.name = 'hall-light-shafts';

  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = hallRadius * 0.38 + rand() * hallRadius * 0.18;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const baseY = wallHeight * 0.65;

    const height = wallHeight * THREE.MathUtils.lerp(0.5, 0.72, rand());
    const radiusTop = THREE.MathUtils.lerp(0.2, 0.4, rand()) * footprint.blockSize;
    const radiusBottom = radiusTop * THREE.MathUtils.lerp(4, 6, rand());
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16, 1, true);
    geometry.translate(0, height * 0.5, 0);

    const shaft = new THREE.Mesh(geometry, mat);
    shaft.position.set(x, baseY, z);
    shaft.lookAt(0, baseY + wallHeight * 0.1, 0);
    shaft.renderOrder = -1;
    shaft.userData.goldenHall = { kind: 'hall-shaft', index: i };

    shafts.push(shaft);
    group.add(shaft);
  }

  const baseAngles = shafts.map((mesh) => Math.atan2(mesh.position.z, mesh.position.x));
  const radius = shafts[0]?.position.length() ?? hallRadius * 0.5;
  let time = 0;
  const angularSpeed = quality === 'medium' ? 0.06 : 0.04; // slow rotation around Y
  const update = (dtMs: number) => {
    time += dtMs / 1000;
    shafts.forEach((mesh, idx) => {
      const angle = baseAngles[idx] + time * angularSpeed;
      const y = mesh.position.y;
      mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      mesh.lookAt(0, y + wallHeight * 0.1, 0);
    });
  };

  return { group, update };
}
