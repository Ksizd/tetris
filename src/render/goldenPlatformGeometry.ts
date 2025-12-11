import * as THREE from 'three';
import { PlatformLayout } from './platformLayout';

export interface GoldenPlatformGeometryOptions {
  segments: number;
}

interface GroupAccumulator {
  start: number;
  count: number;
  materialIndex: number;
}

interface BufferBuilder {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  groups: GroupAccumulator[];
  addGroup: (materialIndex: number) => GroupAccumulator;
}

const MATERIAL_RING_A_TOP = 0;
const MATERIAL_RING_B_TOP = 1;
const MATERIAL_RING_C_TOP = 2;
const MATERIAL_BEVEL = 3;
const MATERIAL_SIDE = 4;

export function createGoldenPlatformGeometry(
  layout: PlatformLayout,
  options: GoldenPlatformGeometryOptions
): THREE.BufferGeometry {
  const segments = Math.max(3, Math.floor(options.segments));
  const builder: BufferBuilder = {
    positions: [],
    normals: [],
    uvs: [],
    indices: [],
    groups: [],
    addGroup(materialIndex) {
      const acc: GroupAccumulator = { start: 0, count: 0, materialIndex };
      this.groups.push(acc);
      return acc;
    },
  };

  const addVertex = (pos: THREE.Vector3, normal: THREE.Vector3, uv: { u: number; v: number }) => {
    builder.positions.push(pos.x, pos.y, pos.z);
    builder.normals.push(normal.x, normal.y, normal.z);
    builder.uvs.push(uv.u, uv.v);
    return (builder.positions.length / 3) - 1;
  };

  const addQuad = (
    a: number,
    b: number,
    c: number,
    d: number,
    group: GroupAccumulator
  ) => {
    const start = builder.indices.length;
    builder.indices.push(a, b, c, c, b, d);
    group.start = group.start === 0 && group.count === 0 ? start : group.start;
    group.count += 6;
  };

  const ringTop = (
    inner: number,
    outer: number,
    y: number,
    materialIndex: number
  ) => {
    const group = builder.addGroup(materialIndex);
    for (let i = 0; i < segments; i += 1) {
      const t0 = (i / segments) * Math.PI * 2;
      const t1 = ((i + 1) / segments) * Math.PI * 2;
      const c0 = Math.cos(t0);
      const s0 = Math.sin(t0);
      const c1 = Math.cos(t1);
      const s1 = Math.sin(t1);
      const n = new THREE.Vector3(0, 1, 0);
      const v0 = addVertex(new THREE.Vector3(inner * c0, y, inner * s0), n, {
        u: i / segments,
        v: 0,
      });
      const v1 = addVertex(new THREE.Vector3(outer * c0, y, outer * s0), n, {
        u: i / segments,
        v: 1,
      });
      const v2 = addVertex(new THREE.Vector3(inner * c1, y, inner * s1), n, {
        u: (i + 1) / segments,
        v: 0,
      });
      const v3 = addVertex(new THREE.Vector3(outer * c1, y, outer * s1), n, {
        u: (i + 1) / segments,
        v: 1,
      });
      addQuad(v0, v1, v2, v3, group);
    }
  };

  const bevelSurface = (
    innerRadius: number,
    innerHeight: number,
    outerRadius: number,
    outerHeight: number,
    materialIndex: number
  ) => {
    const group = builder.addGroup(materialIndex);
    const deltaR = outerRadius - innerRadius;
    const deltaY = outerHeight - innerHeight;
    const slopeLen = Math.hypot(deltaR, deltaY);
    const radialFactor = slopeLen > 0 ? deltaR / slopeLen : 0;
    const verticalFactor = slopeLen > 0 ? deltaY / slopeLen : 0;

    for (let i = 0; i < segments; i += 1) {
      const t0 = (i / segments) * Math.PI * 2;
      const t1 = ((i + 1) / segments) * Math.PI * 2;
      const c0 = Math.cos(t0);
      const s0 = Math.sin(t0);
      const c1 = Math.cos(t1);
      const s1 = Math.sin(t1);
      const normal0 = new THREE.Vector3(
        c0 * radialFactor,
        verticalFactor,
        s0 * radialFactor
      ).normalize();
      const normal1 = new THREE.Vector3(
        c1 * radialFactor,
        verticalFactor,
        s1 * radialFactor
      ).normalize();

      const v0 = addVertex(
        new THREE.Vector3(innerRadius * c0, innerHeight, innerRadius * s0),
        normal0,
        { u: i / segments, v: 0 }
      );
      const v1 = addVertex(
        new THREE.Vector3(outerRadius * c0, outerHeight, outerRadius * s0),
        normal0,
        { u: i / segments, v: 1 }
      );
      const v2 = addVertex(
        new THREE.Vector3(innerRadius * c1, innerHeight, innerRadius * s1),
        normal1,
        { u: (i + 1) / segments, v: 0 }
      );
      const v3 = addVertex(
        new THREE.Vector3(outerRadius * c1, outerHeight, outerRadius * s1),
        normal1,
        { u: (i + 1) / segments, v: 1 }
      );
      addQuad(v0, v1, v2, v3, group);
    }
  };

  const outerWall = (
    radius: number,
    yBottom: number,
    yTop: number,
    materialIndex: number
  ) => {
    const group = builder.addGroup(materialIndex);
    for (let i = 0; i < segments; i += 1) {
      const t0 = (i / segments) * Math.PI * 2;
      const t1 = ((i + 1) / segments) * Math.PI * 2;
      const c0 = Math.cos(t0);
      const s0 = Math.sin(t0);
      const c1 = Math.cos(t1);
      const s1 = Math.sin(t1);
      const n0 = new THREE.Vector3(c0, 0, s0);
      const n1 = new THREE.Vector3(c1, 0, s1);
      const v0 = addVertex(new THREE.Vector3(radius * c0, yBottom, radius * s0), n0, {
        u: i / segments,
        v: 0,
      });
      const v1 = addVertex(new THREE.Vector3(radius * c0, yTop, radius * s0), n0, {
        u: i / segments,
        v: 1,
      });
      const v2 = addVertex(new THREE.Vector3(radius * c1, yBottom, radius * s1), n1, {
        u: (i + 1) / segments,
        v: 0,
      });
      const v3 = addVertex(new THREE.Vector3(radius * c1, yTop, radius * s1), n1, {
        u: (i + 1) / segments,
        v: 1,
      });
      addQuad(v0, v1, v2, v3, group);
    }
  };

  const yA = layout.baseY + layout.ringA.height;
  const yB = layout.baseY + layout.ringB.height;
  const yC = layout.baseY + layout.ringC.height;

  ringTop(layout.ringA.inner, layout.ringA.outer, yA, MATERIAL_RING_A_TOP);
  ringTop(layout.ringB.inner, layout.ringB.outer, yB, MATERIAL_RING_B_TOP);
  ringTop(layout.ringC.inner, layout.ringC.outer, yC, MATERIAL_RING_C_TOP);

  bevelSurface(layout.ringA.outer, yA, layout.ringB.outer, yB, MATERIAL_BEVEL);
  bevelSurface(layout.ringB.outer, yB, layout.ringC.outer, yC, MATERIAL_BEVEL);

  outerWall(layout.ringC.outer, layout.baseY, yC, MATERIAL_SIDE);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(builder.positions, 3)
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(builder.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(builder.uvs, 2));
  geometry.setIndex(builder.indices);
  builder.groups.forEach((g) => {
    geometry.addGroup(g.start, g.count, g.materialIndex);
  });
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
