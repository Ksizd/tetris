import * as THREE from 'three';
import { PlatformLayout } from './platformLayout';
import {
  buildFootprintCarvedRingTopGeometry,
  getFootprintCarveRingAExtraRadii,
} from './footprintInlayGeometry';

export interface GoldenPlatformGeometryOptions {
  segments: number;
  ringADetailBand?: { inner: number; outer: number };
  footprintCarve?: {
    towerRadius: number;
    blockDepth: number;
    blockSize: number;
    columns: number;
    angleOffsetRad?: number;
  };
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
const MATERIAL_RING_A_CARVE = 1;
const MATERIAL_RING_A_LAVA_BOTTOM = 2;
const MATERIAL_RING_B_TOP = 3;
const MATERIAL_RING_C_TOP = 4;
const MATERIAL_BEVEL = 5;
const MATERIAL_SIDE = 6;

const RING_A_ANGULAR_MULTIPLIER = 12;
const MIN_RING_A_ANGULAR_SEGMENTS = 96;
const MIN_RING_A_RADIAL_SEGMENTS = 12;
const RING_A_DETAIL_BAND_SEGMENTS = 64;
const RING_A_INNER_COARSE_SEGMENTS = 8;
const RING_A_OUTER_COARSE_SEGMENTS = 2;

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
    if (group.count === 0) {
      group.start = start;
    }
    group.count += 6;
  };

  const ringTopBand = (
    inner: number,
    outer: number,
    y: number,
    group: GroupAccumulator,
    angularSegments: number,
    vInner: number,
    vOuter: number
  ) => {
    for (let i = 0; i < angularSegments; i += 1) {
      const t0 = (i / angularSegments) * Math.PI * 2;
      const t1 = ((i + 1) / angularSegments) * Math.PI * 2;
      const c0 = Math.cos(t0);
      const s0 = Math.sin(t0);
      const c1 = Math.cos(t1);
      const s1 = Math.sin(t1);
      const n = new THREE.Vector3(0, 1, 0);
      const v0 = addVertex(new THREE.Vector3(inner * c0, y, inner * s0), n, {
        u: i / angularSegments,
        v: vInner,
      });
      const v1 = addVertex(new THREE.Vector3(outer * c0, y, outer * s0), n, {
        u: i / angularSegments,
        v: vOuter,
      });
      const v2 = addVertex(new THREE.Vector3(inner * c1, y, inner * s1), n, {
        u: (i + 1) / angularSegments,
        v: vInner,
      });
      const v3 = addVertex(new THREE.Vector3(outer * c1, y, outer * s1), n, {
        u: (i + 1) / angularSegments,
        v: vOuter,
      });
      addQuad(v0, v1, v2, v3, group);
    }
  };

  const ringTop = (inner: number, outer: number, y: number, materialIndex: number) => {
    const group = builder.addGroup(materialIndex);
    ringTopBand(inner, outer, y, group, segments, 0, 1);
  };

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const clamp01 = (value: number) => clamp(value, 0, 1);

  const appendIndices = (target: number[], source: number[]) => {
    for (let i = 0; i < source.length; i += 1) {
      target.push(source[i]);
    }
  };
  const appendOffsetIndices = (target: number[], source: number[], offset: number) => {
    for (let i = 0; i < source.length; i += 1) {
      target.push(source[i] + offset);
    }
  };

  const appendUniformRadii = (radii: number[], start: number, end: number, steps: number) => {
    const clampedSteps = Math.max(0, Math.floor(steps));
    if (clampedSteps <= 0 || Math.abs(end - start) <= 1e-6) {
      if (Math.abs(radii[radii.length - 1] - end) > 1e-6) {
        radii.push(end);
      }
      return;
    }
    for (let i = 1; i <= clampedSteps; i += 1) {
      radii.push(start + ((end - start) * i) / clampedSteps);
    }
  };

  const buildRingARadialProfile = (
    inner: number,
    outer: number,
    detailBand: GoldenPlatformGeometryOptions['ringADetailBand'],
    extraRadii?: number[]
  ): number[] => {
    const span = outer - inner;
    if (span <= 1e-6) {
      return [inner, outer];
    }

    if (!detailBand) {
      const steps = Math.max(MIN_RING_A_RADIAL_SEGMENTS, Math.round(span * 2));
      const radii = [inner];
      appendUniformRadii(radii, inner, outer, steps);
      if (!extraRadii || extraRadii.length === 0) {
        return radii;
      }
      const merged = radii.concat(extraRadii.filter((r) => r > inner + 1e-6 && r < outer - 1e-6));
      merged.sort((a, b) => a - b);
      const unique = [merged[0]];
      for (let i = 1; i < merged.length; i += 1) {
        if (Math.abs(merged[i] - unique[unique.length - 1]) > 1e-6) {
          unique.push(merged[i]);
        }
      }
      if (unique[0] !== inner) {
        unique[0] = inner;
      }
      if (unique[unique.length - 1] !== outer) {
        unique[unique.length - 1] = outer;
      }
      return unique;
    }

    const bandInner = clamp(detailBand.inner, inner, outer);
    const bandOuter = clamp(detailBand.outer, inner, outer);
    if (bandOuter - bandInner <= 1e-6) {
      const steps = Math.max(MIN_RING_A_RADIAL_SEGMENTS, Math.round(span * 2));
      const radii = [inner];
      appendUniformRadii(radii, inner, outer, steps);
      if (!extraRadii || extraRadii.length === 0) {
        return radii;
      }
      const merged = radii.concat(extraRadii.filter((r) => r > inner + 1e-6 && r < outer - 1e-6));
      merged.sort((a, b) => a - b);
      const unique = [merged[0]];
      for (let i = 1; i < merged.length; i += 1) {
        if (Math.abs(merged[i] - unique[unique.length - 1]) > 1e-6) {
          unique.push(merged[i]);
        }
      }
      if (unique[0] !== inner) {
        unique[0] = inner;
      }
      if (unique[unique.length - 1] !== outer) {
        unique[unique.length - 1] = outer;
      }
      return unique;
    }

    const radii = [inner];
    if (bandInner - inner > 1e-6) {
      appendUniformRadii(radii, inner, bandInner, RING_A_INNER_COARSE_SEGMENTS);
    }
    appendUniformRadii(radii, bandInner, bandOuter, RING_A_DETAIL_BAND_SEGMENTS);
    if (outer - bandOuter > 1e-6) {
      appendUniformRadii(radii, bandOuter, outer, RING_A_OUTER_COARSE_SEGMENTS);
    }
    if (!extraRadii || extraRadii.length === 0) {
      return radii;
    }
    const merged = radii.concat(extraRadii.filter((r) => r > inner + 1e-6 && r < outer - 1e-6));
    merged.sort((a, b) => a - b);
    const unique = [merged[0]];
    for (let i = 1; i < merged.length; i += 1) {
      if (Math.abs(merged[i] - unique[unique.length - 1]) > 1e-6) {
        unique.push(merged[i]);
      }
    }
    if (unique[0] !== inner) {
      unique[0] = inner;
    }
    if (unique[unique.length - 1] !== outer) {
      unique[unique.length - 1] = outer;
    }
    return unique;
  };

  const ringTopWithRadialProfile = (
    inner: number,
    outer: number,
    y: number,
    materialIndex: number,
    angularSegments: number,
    radii: number[]
  ) => {
    const group = builder.addGroup(materialIndex);
    const span = Math.max(1e-6, outer - inner);
    const radialSteps = Math.max(1, radii.length - 1);
    const indexGrid: number[][] = Array.from({ length: radialSteps + 1 }, () =>
      new Array(angularSegments + 1).fill(0)
    );

    const normal = new THREE.Vector3(0, 1, 0);
    for (let r = 0; r <= radialSteps; r += 1) {
      const radius = clamp(radii[r], inner, outer);
      const v = clamp((radius - inner) / span, 0, 1);
      for (let i = 0; i <= angularSegments; i += 1) {
        const t = (i / angularSegments) * Math.PI * 2;
        indexGrid[r][i] = addVertex(
          new THREE.Vector3(radius * Math.cos(t), y, radius * Math.sin(t)),
          normal,
          { u: i / angularSegments, v }
        );
      }
    }

    for (let r = 0; r < radialSteps; r += 1) {
      for (let i = 0; i < angularSegments; i += 1) {
        addQuad(indexGrid[r][i], indexGrid[r + 1][i], indexGrid[r][i + 1], indexGrid[r + 1][i + 1], group);
      }
    }
  };

  const ringTopWithRadialDetail = (
    inner: number,
    outer: number,
    y: number,
    materialIndex: number,
    angularSegments: number,
    radialSegments: number
  ) => {
    const span = Math.max(1e-6, outer - inner);
    const radii = [inner];
    for (let r = 0; r < radialSegments; r += 1) {
      radii.push(inner + (span * (r + 1)) / radialSegments);
    }
    ringTopWithRadialProfile(inner, outer, y, materialIndex, angularSegments, radii);
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

  const ringAAngularSegments = Math.max(MIN_RING_A_ANGULAR_SEGMENTS, segments * RING_A_ANGULAR_MULTIPLIER);
  const ringAExtraRadii = options.footprintCarve
    ? getFootprintCarveRingAExtraRadii(options.footprintCarve)
    : undefined;
  const ringARadii = buildRingARadialProfile(
    layout.ringA.inner,
    layout.ringA.outer,
    options.ringADetailBand,
    ringAExtraRadii
  );

  if (options.footprintCarve) {
    const carved = buildFootprintCarvedRingTopGeometry({
      ringInner: layout.ringA.inner,
      ringOuter: layout.ringA.outer,
      yTop: yA,
      angularSegments: ringAAngularSegments,
      radii: ringARadii,
      carve: options.footprintCarve,
    });

    const vertexOffset = builder.positions.length / 3;
    appendIndices(builder.positions, carved.positions);
    appendIndices(builder.normals, carved.normals);
    appendIndices(builder.uvs, carved.uvs);

    const groupTop: GroupAccumulator = {
      start: builder.indices.length,
      count: carved.indicesTop.length,
      materialIndex: MATERIAL_RING_A_TOP,
    };
    appendOffsetIndices(builder.indices, carved.indicesTop, vertexOffset);

    const groupCarve: GroupAccumulator = {
      start: builder.indices.length,
      count: carved.indicesCarve.length,
      materialIndex: MATERIAL_RING_A_CARVE,
    };
    appendOffsetIndices(builder.indices, carved.indicesCarve, vertexOffset);

    const groupLava: GroupAccumulator = {
      start: builder.indices.length,
      count: carved.indicesLava.length,
      materialIndex: MATERIAL_RING_A_LAVA_BOTTOM,
    };
    appendOffsetIndices(builder.indices, carved.indicesLava, vertexOffset);

    builder.groups.push(groupTop, groupCarve, groupLava);
  } else {
    ringTopWithRadialProfile(
      layout.ringA.inner,
      layout.ringA.outer,
      yA,
      MATERIAL_RING_A_TOP,
      ringAAngularSegments,
      ringARadii
    );
  }
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
