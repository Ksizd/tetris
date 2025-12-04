import { Vector2, Vector3 } from 'three';
import { CubeFace, FACE_NORMALS } from './cubeSpace';
import { ShardTemplate } from './shardTemplate';
import { DEFAULT_FACE_UV_RECTS, FaceUvRect } from './faceUvRect';

export interface ShardGeometry {
  templateId: number;
  face: CubeFace;
  positions: Vector3[];
  indices: number[];
  normals: Vector3[]; // optional: precomputed per-vertex normals; if empty, caller can compute
  uvs: Vector2[];
  frontVertexCount: number;
  backVertexOffset: number;
  depthFront: number;
  depthBack: number;
  depthBacks: number[];
  layerDepths: number[];
  layerOffsets: number[];
  layerCount: number;
}

export interface ShardGeometryBuildOptions {
  random?: () => number;
  faceUvRects?: Record<CubeFace, FaceUvRect>;
  sideNoiseRadius?: number; // perturbation magnitude for back vertices to break perfect prisms
}

interface FaceBasis {
  origin: Vector3;
  u: Vector3;
  v: Vector3;
  normal: Vector3;
}

const FACE_BASIS: Record<CubeFace, FaceBasis> = {
  [CubeFace.Front]: {
    origin: new Vector3(0, 0, 0.5),
    u: new Vector3(1, 0, 0),
    v: new Vector3(0, 1, 0),
    normal: FACE_NORMALS[CubeFace.Front].clone(),
  },
  [CubeFace.Back]: {
    origin: new Vector3(0, 0, -0.5),
    u: new Vector3(-1, 0, 0),
    v: new Vector3(0, 1, 0),
    normal: FACE_NORMALS[CubeFace.Back].clone(),
  },
  [CubeFace.Right]: {
    origin: new Vector3(0.5, 0, 0),
    u: new Vector3(0, 0, -1),
    v: new Vector3(0, 1, 0),
    normal: FACE_NORMALS[CubeFace.Right].clone(),
  },
  [CubeFace.Left]: {
    origin: new Vector3(-0.5, 0, 0),
    u: new Vector3(0, 0, 1),
    v: new Vector3(0, 1, 0),
    normal: FACE_NORMALS[CubeFace.Left].clone(),
  },
  [CubeFace.Top]: {
    origin: new Vector3(0, 0.5, 0),
    u: new Vector3(1, 0, 0),
    v: new Vector3(0, 0, -1),
    normal: FACE_NORMALS[CubeFace.Top].clone(),
  },
  [CubeFace.Bottom]: {
    origin: new Vector3(0, -0.5, 0),
    u: new Vector3(1, 0, 0),
    v: new Vector3(0, 0, 1),
    normal: FACE_NORMALS[CubeFace.Bottom].clone(),
  },
};

export function getFaceBasis(face: CubeFace): FaceBasis {
  const b = FACE_BASIS[face];
  return {
    origin: b.origin.clone(),
    u: b.u.clone(),
    v: b.v.clone(),
    normal: b.normal.clone(),
  };
}

function randomDepth(min: number, max: number, rnd: () => number): number {
  if (max < min) {
    return min;
  }
  return min + (max - min) * rnd();
}

function signedArea2D(vertices: Vector2[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

function ensureCCW(vertices: Vector2[]): Vector2[] {
  if (vertices.length < 3) {
    return vertices;
  }
  return signedArea2D(vertices) < 0 ? [...vertices].reverse() : vertices;
}

function projectToFace(face: CubeFace, vertex: Vector2, depth: number): Vector3 {
  const basis = FACE_BASIS[face];
  const pos = basis.origin.clone();
  pos.addScaledVector(basis.u, vertex.x);
  pos.addScaledVector(basis.v, vertex.y);
  pos.addScaledVector(basis.normal, -depth);
  return pos;
}

function computeFaceNormal(a: Vector3, b: Vector3, c: Vector3): Vector3 {
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  return ab.cross(ac).normalize();
}

function applySideNoiseToBack(vertices: Vector3[], face: CubeFace, radius: number, rnd: () => number) {
  if (radius <= 0) {
    return;
  }
  const basis = FACE_BASIS[face];
  const minInset = 0.01;
  vertices.forEach((p) => {
    const du = (rnd() * 2 - 1) * radius;
    const dv = (rnd() * 2 - 1) * radius;
    const dn = (rnd() * 2 - 1) * radius;

    p.addScaledVector(basis.u, du);
    p.addScaledVector(basis.v, dv);
    p.addScaledVector(basis.normal, dn);

    const relNormal = p.clone().sub(basis.origin);
    const depth = -relNormal.dot(basis.normal);
    if (depth < minInset) {
      p.addScaledVector(basis.normal, -(minInset - depth));
    }
    const rel = p.clone().sub(basis.origin);
    const uCoord = rel.dot(basis.u);
    const vCoord = rel.dot(basis.v);
    const clampToFace = (value: number) => Math.max(-0.5 + minInset, Math.min(0.5 - minInset, value));
    const clampedU = clampToFace(uCoord);
    const clampedV = clampToFace(vCoord);
    if (clampedU !== uCoord) {
      p.addScaledVector(basis.u, clampedU - uCoord);
    }
    if (clampedV !== vCoord) {
      p.addScaledVector(basis.v, clampedV - vCoord);
    }
  });
}

function buildNormals(
  positions: Vector3[],
  indices: number[],
  face: CubeFace,
  backOffset: number,
  frontVertexCount: number
): Vector3[] {
  const normals = positions.map(() => new Vector3());

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i];
    const ib = indices[i + 1];
    const ic = indices[i + 2];
    const a = positions[ia];
    const b = positions[ib];
    const c = positions[ic];
    const n = computeFaceNormal(a, b, c);
    normals[ia].add(n);
    normals[ib].add(n);
    normals[ic].add(n);
  }

  normals.forEach((n) => n.normalize());

  // Ensure front normals align strictly with face normal (for consistent lighting on "visible" side).
  const faceNormal = FACE_NORMALS[face];
  for (let i = 0; i < frontVertexCount; i += 1) {
    normals[i].copy(faceNormal);
  }
  // Back normals point inward (opposite face normal) to reduce lighting; they will be smoothened by normalization above.
  for (let i = backOffset; i < backOffset + frontVertexCount; i += 1) {
    normals[i].copy(faceNormal).multiplyScalar(-1);
  }

  return normals;
}

function toUnitSquare(v: Vector2): { sx: number; sy: number } {
  return { sx: (v.x + 0.5) / 1.0, sy: (v.y + 0.5) / 1.0 };
}

function buildUVs(face: CubeFace, polygon: Vector2[], rects: Record<CubeFace, FaceUvRect>): Vector2[] {
  const rect = rects[face];
  const uvs: Vector2[] = [];
  polygon.forEach((v) => {
    const { sx, sy } = toUnitSquare(v);
    const u = rect.u0 + sx * (rect.u1 - rect.u0);
    const vCoord = rect.v0 + (1 - sy) * (rect.v1 - rect.v0);
    uvs.push(new Vector2(u, vCoord));
  });
  return uvs;
}

function clonePolygon(poly: Vector2[]): Vector2[] {
  return poly.map((v) => v.clone());
}

function alignLayerVertexCounts(layers: { depth: number; polygon: Vector2[] }[]): { depth: number; polygon: Vector2[] }[] {
  if (layers.length === 0) {
    return layers;
  }
  const target = layers.reduce((max, layer) => Math.max(max, layer.polygon.length), 0);
  return layers.map((layer) => {
    let poly = [...layer.polygon];
    while (poly.length < target) {
      const extended: Vector2[] = [];
      for (let i = 0; i < poly.length; i += 1) {
        const v = poly[i];
        const next = poly[(i + 1) % poly.length];
        extended.push(v.clone());
        if (extended.length < target) {
          extended.push(v.clone().add(next).multiplyScalar(0.5));
        }
      }
      poly = extended;
    }
    if (poly.length > target) {
      poly = poly.slice(0, target);
    }
    return { depth: layer.depth, polygon: ensureCCW(poly) };
  });
}

export function buildShardGeometry(
  template: ShardTemplate,
  options: ShardGeometryBuildOptions = {}
): ShardGeometry {
  const rnd = options.random ?? Math.random;
  const faceUvRects = options.faceUvRects ?? DEFAULT_FACE_UV_RECTS;
  const sideNoiseRadius = options.sideNoiseRadius ?? 0.045;
  const depthFront = 0;

  const hasDeepLayers = Array.isArray(template.layers) && (template.layers?.length ?? 0) > 1;
  const basePoly = ensureCCW(template.polygon2D.vertices);

  let layerPolys: { depth: number; polygon: Vector2[] }[];
  let depthBacks: number[];

  if (hasDeepLayers) {
    const sortedLayers = [...(template.layers ?? [])].sort((a, b) => a.depth - b.depth);
    const normalized = sortedLayers.map((layer, idx) => ({
      depth: idx === 0 ? 0 : layer.depth, // ensure front depth is exactly 0
      polygon: ensureCCW(clonePolygon(layer.polygon)),
    }));
    layerPolys = alignLayerVertexCounts(normalized);
    const lastDepth = layerPolys[layerPolys.length - 1]?.depth ?? template.depthMax;
    const lastCount = layerPolys[layerPolys.length - 1]?.polygon.length ?? basePoly.length;
    depthBacks = Array.from({ length: lastCount }, () => lastDepth);
  } else {
    const depthsBackPerVertex = basePoly.map(() => randomDepth(template.depthMin, template.depthMax, rnd));
    const depthBack = depthsBackPerVertex.length > 0 ? Math.max(...depthsBackPerVertex) : 0;
    layerPolys = [
      { depth: depthFront, polygon: basePoly },
      { depth: depthBack, polygon: basePoly },
    ];
    depthBacks = depthsBackPerVertex;
  }

  // enforce consistent vertex counts across layers for stable side stitching
  layerPolys = alignLayerVertexCounts(layerPolys);

  const positions: Vector3[] = [];
  const uvs: Vector2[] = [];
  const layerOffsets: number[] = [];
  const layerDepths: number[] = [];

  layerPolys.forEach((layer, idx) => {
    const offset = positions.length;
    layerOffsets.push(offset);
    layerDepths.push(layer.depth);
    const verts3D = layer.polygon.map((v) => projectToFace(template.face, v, layer.depth));
    if (!hasDeepLayers && idx === layerPolys.length - 1 && depthBacks.length === layer.polygon.length) {
      const basis = FACE_BASIS[template.face];
      verts3D.forEach((p, i) => {
        const targetDepth = depthBacks[i];
        const delta = targetDepth - layer.depth;
        if (Math.abs(delta) > 1e-5) {
          p.addScaledVector(basis.normal, -delta);
        }
      });
    }
    // apply noise only on the deepest layer when using simple two-layer prism fallback
    if (idx === layerPolys.length - 1 && sideNoiseRadius > 0 && !hasDeepLayers) {
      applySideNoiseToBack(verts3D, template.face, sideNoiseRadius, rnd);
    }
    positions.push(...verts3D);
    const layerUvs =
      idx === 0 ? buildUVs(template.face, layer.polygon, faceUvRects) : layer.polygon.map(() => new Vector2(0, 0));
    uvs.push(...layerUvs);
  });

  const indices: number[] = [];
  const frontVertexCount = layerPolys[0]?.polygon.length ?? 0;
  const backOffset = layerOffsets[layerOffsets.length - 1] ?? 0;
  const backVertexCount = layerPolys[layerPolys.length - 1]?.polygon.length ?? 0;

  // front face
  for (let i = 1; i < frontVertexCount - 1; i += 1) {
    indices.push(0, i, i + 1);
  }

  // back face (last layer)
  for (let i = 1; i < backVertexCount - 1; i += 1) {
    indices.push(backOffset, backOffset + i + 1, backOffset + i);
  }

  // sides between consecutive layers
  for (let layerIdx = 0; layerIdx < layerPolys.length - 1; layerIdx += 1) {
    const current = layerPolys[layerIdx];
    const next = layerPolys[layerIdx + 1];
    const count = Math.min(current.polygon.length, next.polygon.length);
    const offsetA = layerOffsets[layerIdx];
    const offsetB = layerOffsets[layerIdx + 1];
    for (let i = 0; i < count; i += 1) {
      const nextI = (i + 1) % count;
      const a = offsetA + i;
      const b = offsetA + nextI;
      const c = offsetB + nextI;
      const d = offsetB + i;
      indices.push(a, c, b);
      indices.push(a, d, c);
    }
  }

  const depthBack = layerDepths[layerDepths.length - 1] ?? template.depthMax;

  return {
    templateId: template.id,
    face: template.face,
    positions,
    indices,
    normals: buildNormals(positions, indices, template.face, backOffset, frontVertexCount),
    uvs,
    frontVertexCount,
    backVertexOffset: backOffset,
    depthFront,
    depthBack,
    depthBacks,
    layerDepths,
    layerOffsets,
    layerCount: layerPolys.length,
  };
}
