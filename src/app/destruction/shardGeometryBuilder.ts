import { Vector2, Vector3 } from 'three';
import { FaceId, FACE_NORMALS } from './cubeSpace';
import { ShardTemplate } from './shardTemplate';
import { DEFAULT_FACE_UV_RECTS, FaceUvRect } from './faceUvRect';

export interface ShardGeometry {
  templateId: number;
  face: FaceId;
  positions: Vector3[];
  indices: number[];
  normals: Vector3[]; // optional: precomputed per-vertex normals; if empty, caller can compute
  uvs: Vector2[];
  frontVertexCount: number;
  backVertexOffset: number;
  depthFront: number;
  depthBack: number;
}

export interface ShardGeometryBuildOptions {
  random?: () => number;
  faceUvRects?: Record<FaceId, FaceUvRect>;
  sideNoiseRadius?: number; // perturbation magnitude for back vertices to break perfect prisms
}

interface FaceBasis {
  origin: Vector3;
  u: Vector3;
  v: Vector3;
  normal: Vector3;
}

const FACE_BASIS: Record<FaceId, FaceBasis> = {
  front: {
    origin: new Vector3(0, 0, 0.5),
    u: new Vector3(1, 0, 0),
    v: new Vector3(0, 1, 0),
    normal: FACE_NORMALS.front.clone(),
  },
  back: {
    origin: new Vector3(0, 0, -0.5),
    u: new Vector3(-1, 0, 0),
    v: new Vector3(0, 1, 0),
    normal: FACE_NORMALS.back.clone(),
  },
  right: {
    origin: new Vector3(0.5, 0, 0),
    u: new Vector3(0, 0, -1),
    v: new Vector3(0, 1, 0),
    normal: FACE_NORMALS.right.clone(),
  },
  left: {
    origin: new Vector3(-0.5, 0, 0),
    u: new Vector3(0, 0, 1),
    v: new Vector3(0, 1, 0),
    normal: FACE_NORMALS.left.clone(),
  },
  top: {
    origin: new Vector3(0, 0.5, 0),
    u: new Vector3(1, 0, 0),
    v: new Vector3(0, 0, -1),
    normal: FACE_NORMALS.top.clone(),
  },
  bottom: {
    origin: new Vector3(0, -0.5, 0),
    u: new Vector3(1, 0, 0),
    v: new Vector3(0, 0, 1),
    normal: FACE_NORMALS.bottom.clone(),
  },
};

export function getFaceBasis(face: FaceId): FaceBasis {
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

function projectToFace(face: FaceId, vertex: Vector2, depth: number): Vector3 {
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

function randomVectorInSphere(radius: number, rnd: () => number): Vector3 {
  let v = new Vector3();
  for (let i = 0; i < 6; i += 1) {
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (v.lengthSq() <= 1) {
      return v.multiplyScalar(radius);
    }
  }
  return v.set(0, 0, 0);
}

function applySideNoiseToBack(vertices: Vector3[], face: FaceId, radius: number, rnd: () => number) {
  if (radius <= 0) {
    return;
  }
  const basis = FACE_BASIS[face];
  const minInset = 0.01;
  vertices.forEach((p) => {
    p.add(randomVectorInSphere(radius, rnd));
    const rel = p.clone().sub(basis.origin);
    const depth = -rel.dot(basis.normal);
    if (depth < minInset) {
      p.addScaledVector(basis.normal, -(minInset - depth));
    }
  });
}

function buildNormals(
  positions: Vector3[],
  indices: number[],
  face: FaceId,
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

function buildUVs(face: FaceId, polygon: Vector2[], rects: Record<FaceId, FaceUvRect>): Vector2[] {
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

export function buildShardGeometry(
  template: ShardTemplate,
  options: ShardGeometryBuildOptions = {}
): ShardGeometry {
  const rnd = options.random ?? Math.random;
  const faceUvRects = options.faceUvRects ?? DEFAULT_FACE_UV_RECTS;
  const sideNoiseRadius = options.sideNoiseRadius ?? 0.045;
  const depthFront = 0;
  const depthBack = Math.max(
    randomDepth(template.depthMin, template.depthMax, rnd),
    randomDepth(template.depthMin, template.depthMax, rnd)
  );

  const ccw = ensureCCW(template.polygon2D.vertices);
  const front: Vector3[] = ccw.map((v) => projectToFace(template.face, v, depthFront));
  const back: Vector3[] = ccw.map((v) => projectToFace(template.face, v, depthBack));
  applySideNoiseToBack(back, template.face, sideNoiseRadius, rnd);
  const faceUVs = buildUVs(template.face, ccw, faceUvRects);
  const uvs = [...faceUVs, ...faceUVs.map((uv) => uv.clone())];

  const positions = [...front, ...back];
  const n = front.length;
  const backOffset = n;
  const indices: number[] = [];

  // front face (CCW, outward = face normal)
  for (let i = 1; i < n - 1; i += 1) {
    indices.push(0, i, i + 1);
  }

  // back face (same winding produces outward = face normal because basis satisfies u x v = normal)
  for (let i = 1; i < n - 1; i += 1) {
    indices.push(backOffset, backOffset + i + 1, backOffset + i);
  }

  // sides
  for (let i = 0; i < n; i += 1) {
    const next = (i + 1) % n;
    const a = i;
    const b = next;
    const c = backOffset + next;
    const d = backOffset + i;
    indices.push(a, b, c);
    indices.push(a, c, d);
  }

  return {
    templateId: template.id,
    face: template.face,
    positions,
    indices,
    normals: buildNormals(positions, indices, template.face, backOffset, n),
    uvs,
    frontVertexCount: n,
    backVertexOffset: backOffset,
    depthFront,
    depthBack,
  };
}
