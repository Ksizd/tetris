import * as THREE from 'three';
import { computeFootprintAngleOffsetRad } from './footprintAngles';

export interface FootprintCarveParams {
  towerRadius: number;
  blockDepth: number;
  blockSize: number;
  columns: number;
  angleOffsetRad?: number;
}

export interface FootprintCarvedRingTopParams {
  ringInner: number;
  ringOuter: number;
  yTop: number;
  angularSegments: number;
  radii: number[];
  carve: FootprintCarveParams;
}

export interface FootprintCarvedRingTopGeometry {
  positions: number[];
  normals: number[];
  uvs: number[];
  indicesTop: number[];
  indicesCarve: number[];
  indicesLava: number[];
}

const EPS = 1e-6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const smoothstep01 = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function getFootprintCarveRingAExtraRadii(params: FootprintCarveParams): number[] {
  const R0 = params.towerRadius - params.blockDepth * 0.5;
  const R1 = params.towerRadius + params.blockDepth * 0.5;

  const grooveW = clamp(params.blockDepth * 0.08, params.blockDepth * 0.06, params.blockDepth * 0.1);
  const grooveHalfW = grooveW * 0.5;
  const bevelW = Math.max(1e-4, grooveW * 0.25);
  const microBevelW = Math.max(1e-4, grooveW * 0.18);

  return [
    R0 - grooveHalfW - bevelW,
    R0 - grooveHalfW,
    R0 - grooveHalfW + microBevelW,
    R0 + grooveHalfW - microBevelW,
    R0 + grooveHalfW,
    R0 + grooveHalfW + bevelW,
    R1 - grooveHalfW - bevelW,
    R1 - grooveHalfW,
    R1 - grooveHalfW + microBevelW,
    R1 + grooveHalfW - microBevelW,
    R1 + grooveHalfW,
    R1 + grooveHalfW + bevelW,
  ];
}

export function buildFootprintCarvedRingTopGeometry(
  params: FootprintCarvedRingTopParams
): FootprintCarvedRingTopGeometry {
  const columns = Math.max(3, Math.floor(params.carve.columns));
  const angularSegments = Math.max(3, Math.floor(params.angularSegments));
  const ringInner = params.ringInner;
  const ringOuter = params.ringOuter;
  const yTop = params.yTop;
  const radii = params.radii.length >= 2 ? params.radii : [ringInner, ringOuter];
  const radialSteps = Math.max(1, radii.length - 1);

  const blockDepth = params.carve.blockDepth;
  const blockSize = params.carve.blockSize;
  const towerRadius = params.carve.towerRadius;
  const footprintAngleOffsetRad =
    params.carve.angleOffsetRad ?? computeFootprintAngleOffsetRad(columns);

  const R0 = towerRadius - blockDepth * 0.5;
  const R1 = towerRadius + blockDepth * 0.5;

  const grooveW = clamp(blockDepth * 0.08, blockDepth * 0.06, blockDepth * 0.1);
  const grooveHalfW = grooveW * 0.5;
  const grooveD = clamp(blockSize * 0.08, blockSize * 0.04, blockSize * 0.08);

  const bevelHeight = grooveD * 0.4;
  const bevelWidth = Math.max(1e-4, grooveW * 0.25);
  const microBevelHeight = grooveD * 0.12;
  const microBevelWidth = Math.max(1e-4, grooveW * 0.18);

  const dTheta = (Math.PI * 2) / columns;
  const microStep = (Math.PI * 2) / angularSegments;
  const baseThetaW = dTheta * 0.08;
  let thetaSteps = Math.max(2, Math.round(baseThetaW / microStep));
  if (thetaSteps % 2 === 1) {
    thetaSteps += 1;
  }
  const thetaHalfW = (thetaSteps * microStep) * 0.5;

  const radialGrooveMinR = R0 - grooveHalfW;
  const radialGrooveMaxR = R1 + grooveHalfW;

  const yWallTop = yTop - bevelHeight;
  const yBottom = yTop - grooveD;
  const yWallBottom = yBottom + microBevelHeight;

  const signedDistanceToFootprint = (radius: number, theta: number) => {
    const thetaAligned = theta - footprintAngleOffsetRad;
    const sRing0 = Math.abs(radius - R0) - grooveHalfW;
    const sRing1 = Math.abs(radius - R1) - grooveHalfW;

    const columnPosition = thetaAligned / dTheta;
    const frac = columnPosition - Math.floor(columnPosition);
    const distToBoundary = Math.min(frac, 1 - frac) * dTheta;
    const sTheta = distToBoundary - thetaHalfW;
    const sRadial = radius >= radialGrooveMinR && radius <= radialGrooveMaxR ? radius * sTheta : 1e9;

    return Math.min(sRing0, sRing1, sRadial);
  };

  const outerHeightForSignedDistance = (s: number) => {
    const t = smoothstep01(s / bevelWidth);
    return yWallTop + (yTop - yWallTop) * t;
  };

  const innerHeightForSignedDistance = (s: number) => {
    const depth = Math.max(0, -s);
    const t = smoothstep01(1 - clamp01(depth / microBevelWidth));
    return yBottom + microBevelHeight * t;
  };

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const addVertex = (pos: THREE.Vector3, uv: { u: number; v: number }) => {
    positions.push(pos.x, pos.y, pos.z);
    normals.push(0, 0, 0);
    uvs.push(uv.u, uv.v);
    return (positions.length / 3) - 1;
  };

  const span = Math.max(EPS, ringOuter - ringInner);
  const outerGrid: number[][] = Array.from({ length: radialSteps + 1 }, () =>
    new Array(angularSegments + 1).fill(0)
  );
  const innerGrid: number[][] = Array.from({ length: radialSteps + 1 }, () =>
    new Array(angularSegments + 1).fill(0)
  );

  for (let r = 0; r <= radialSteps; r += 1) {
    const radius = clamp(radii[r], ringInner, ringOuter);
    const v = clamp01((radius - ringInner) / span);
    for (let i = 0; i <= angularSegments; i += 1) {
      const theta = (i / angularSegments) * Math.PI * 2;
      const u = i / angularSegments;
      const c = Math.cos(theta);
      const sn = Math.sin(theta);
      const s = signedDistanceToFootprint(radius, theta);
      const yOuter = outerHeightForSignedDistance(Math.max(0, s));
      const yInner = innerHeightForSignedDistance(Math.min(0, s));
      outerGrid[r][i] = addVertex(new THREE.Vector3(radius * c, yOuter, radius * sn), { u, v });
      innerGrid[r][i] = addVertex(new THREE.Vector3(radius * c, yInner, radius * sn), { u, v });
    }
  }

  const cellInside: boolean[][] = Array.from({ length: radialSteps }, () =>
    new Array(angularSegments).fill(false)
  );
  const cellSignedDistance: number[][] = Array.from({ length: radialSteps }, () =>
    new Array(angularSegments).fill(0)
  );

  for (let r = 0; r < radialSteps; r += 1) {
    const rMid = (radii[r] + radii[r + 1]) * 0.5;
    for (let i = 0; i < angularSegments; i += 1) {
      const thetaMid = ((i + 0.5) / angularSegments) * Math.PI * 2;
      const sMid = signedDistanceToFootprint(rMid, thetaMid);
      cellSignedDistance[r][i] = sMid;
      cellInside[r][i] = sMid < 0;
    }
  }

  const indicesTop: number[] = [];
  const indicesCarve: number[] = [];
  const indicesLava: number[] = [];

  const addQuadTo = (target: number[], a: number, b: number, c: number, d: number) => {
    target.push(a, b, c, c, b, d);
  };

  for (let r = 0; r < radialSteps; r += 1) {
    for (let i = 0; i < angularSegments; i += 1) {
      const inside = cellInside[r][i];
      const sMid = cellSignedDistance[r][i];
      if (!inside) {
        const target = sMid >= bevelWidth ? indicesTop : indicesCarve;
        addQuadTo(target, outerGrid[r][i], outerGrid[r][i + 1], outerGrid[r + 1][i], outerGrid[r + 1][i + 1]);
        continue;
      }

      const target = -sMid >= microBevelWidth ? indicesLava : indicesCarve;
      addQuadTo(target, innerGrid[r][i], innerGrid[r][i + 1], innerGrid[r + 1][i], innerGrid[r + 1][i + 1]);
    }
  }

  const addWallQuad = (p0: THREE.Vector3, p1: THREE.Vector3, outwardHint: THREE.Vector3) => {
    const v0 = addVertex(new THREE.Vector3(p0.x, yWallTop, p0.z), { u: 0, v: 0 });
    const v1 = addVertex(new THREE.Vector3(p1.x, yWallTop, p1.z), { u: 0, v: 0 });
    const v2 = addVertex(new THREE.Vector3(p0.x, yWallBottom, p0.z), { u: 0, v: 1 });
    const v3 = addVertex(new THREE.Vector3(p1.x, yWallBottom, p1.z), { u: 0, v: 1 });

    const ax = positions[v0 * 3 + 0];
    const ay = positions[v0 * 3 + 1];
    const az = positions[v0 * 3 + 2];
    const bx = positions[v2 * 3 + 0];
    const by = positions[v2 * 3 + 1];
    const bz = positions[v2 * 3 + 2];
    const cx = positions[v1 * 3 + 0];
    const cy = positions[v1 * 3 + 1];
    const cz = positions[v1 * 3 + 2];
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const dot = nx * outwardHint.x + ny * outwardHint.y + nz * outwardHint.z;
    if (dot < 0) {
      addQuadTo(indicesCarve, v1, v3, v0, v2);
      return;
    }
    addQuadTo(indicesCarve, v0, v2, v1, v3);
  };

  for (let rEdge = 1; rEdge < radialSteps; rEdge += 1) {
    const radius = radii[rEdge];
    for (let i = 0; i < angularSegments; i += 1) {
      const aInside = cellInside[rEdge - 1][i];
      const bInside = cellInside[rEdge][i];
      if (aInside === bInside) {
        continue;
      }

      const theta0 = (i / angularSegments) * Math.PI * 2;
      const theta1 = ((i + 1) / angularSegments) * Math.PI * 2;
      const p0 = new THREE.Vector3(radius * Math.cos(theta0), 0, radius * Math.sin(theta0));
      const p1 = new THREE.Vector3(radius * Math.cos(theta1), 0, radius * Math.sin(theta1));

      const thetaMid = ((i + 0.5) / angularSegments) * Math.PI * 2;
      const sign = aInside ? 1 : -1;
      const outwardHint = new THREE.Vector3(sign * Math.cos(thetaMid), 0, sign * Math.sin(thetaMid));
      addWallQuad(p0, p1, outwardHint);
    }
  }

  for (let r = 0; r < radialSteps; r += 1) {
    for (let aEdge = 0; aEdge < angularSegments; aEdge += 1) {
      const aPrev = (aEdge - 1 + angularSegments) % angularSegments;
      const aInside = cellInside[r][aPrev];
      const bInside = cellInside[r][aEdge];
      if (aInside === bInside) {
        continue;
      }

      const theta = (aEdge / angularSegments) * Math.PI * 2;
      const p0 = new THREE.Vector3(radii[r] * Math.cos(theta), 0, radii[r] * Math.sin(theta));
      const p1 = new THREE.Vector3(radii[r + 1] * Math.cos(theta), 0, radii[r + 1] * Math.sin(theta));

      const sign = aInside ? 1 : -1;
      const outwardHint = new THREE.Vector3(sign * -Math.sin(theta), 0, sign * Math.cos(theta));
      addWallQuad(p0, p1, outwardHint);
    }
  }

  for (let i = 0; i < normals.length; i += 1) {
    normals[i] = 0;
  }

  const accumulateTriangleNormals = (indices: number[]) => {
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      const ax = positions[a * 3 + 0];
      const ay = positions[a * 3 + 1];
      const az = positions[a * 3 + 2];
      const bx = positions[b * 3 + 0];
      const by = positions[b * 3 + 1];
      const bz = positions[b * 3 + 2];
      const cx = positions[c * 3 + 0];
      const cy = positions[c * 3 + 1];
      const cz = positions[c * 3 + 2];
      const abx = bx - ax;
      const aby = by - ay;
      const abz = bz - az;
      const acx = cx - ax;
      const acy = cy - ay;
      const acz = cz - az;
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      normals[a * 3 + 0] += nx;
      normals[a * 3 + 1] += ny;
      normals[a * 3 + 2] += nz;
      normals[b * 3 + 0] += nx;
      normals[b * 3 + 1] += ny;
      normals[b * 3 + 2] += nz;
      normals[c * 3 + 0] += nx;
      normals[c * 3 + 1] += ny;
      normals[c * 3 + 2] += nz;
    }
  };

  accumulateTriangleNormals(indicesTop);
  accumulateTriangleNormals(indicesCarve);
  accumulateTriangleNormals(indicesLava);

  for (let i = 0; i < positions.length / 3; i += 1) {
    const nx = normals[i * 3 + 0];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const len = Math.hypot(nx, ny, nz);
    if (len <= EPS) {
      normals[i * 3 + 0] = 0;
      normals[i * 3 + 1] = 1;
      normals[i * 3 + 2] = 0;
      continue;
    }
    normals[i * 3 + 0] = nx / len;
    normals[i * 3 + 1] = ny / len;
    normals[i * 3 + 2] = nz / len;
  }

  return { positions, normals, uvs, indicesTop, indicesCarve, indicesLava };
}
