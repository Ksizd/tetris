import { Vector2, Vector3 } from 'three';
import { CubeFace } from './cubeSpace';
import { FacePolygon2D } from './shardTemplate';
import { ShellShardTemplate } from './shellShardTemplate';
import { DEFAULT_FACE_UV_RECTS, FaceUvRect } from './faceUvRect';
import { getFaceBasis } from './shardGeometryBuilder';

export interface ShellShardGeometry {
  templateId: number;
  face: CubeFace;
  positions: Vector3[];
  indices: number[];
  uvs: Vector2[];
  normals: Vector3[];
  depthInner: number;
}

export interface ShellShardGeometryOptions {
  faceUvRects?: Record<CubeFace, FaceUvRect>;
  uvRectOverride?: FaceUvRect;
}

function buildUVs(face: CubeFace, polygon: Vector2[], rects: Record<CubeFace, FaceUvRect>): Vector2[] {
  const rect = rects[face];
  return polygon.map((v) => {
    const sx = (v.x + 0.5) / 1.0;
    const sy = (v.y + 0.5) / 1.0;
    const u = rect.u0 + sx * (rect.u1 - rect.u0);
    const vv = rect.v0 + (1 - sy) * (rect.v1 - rect.v0);
    return new Vector2(u, vv);
  });
}

function ensureCCW(vertices: Vector2[]): Vector2[] {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area < 0 ? [...vertices].reverse() : vertices;
}

export function buildShellShardGeometry(
  template: ShellShardTemplate,
  options: ShellShardGeometryOptions = {}
): ShellShardGeometry {
  const baseRects = options.faceUvRects ?? DEFAULT_FACE_UV_RECTS;
  const faceUvRects = options.uvRectOverride
    ? { ...baseRects, [template.face]: options.uvRectOverride }
    : baseRects;
  const basis = getFaceBasis(template.face);

  const ccw = ensureCCW(template.poly.vertices);
  const positionsFront = ccw.map((p) =>
    basis.origin.clone().addScaledVector(basis.u, p.x).addScaledVector(basis.v, p.y)
  );
  const positionsBack = ccw.map((p) =>
    basis.origin
      .clone()
      .addScaledVector(basis.u, p.x)
      .addScaledVector(basis.v, p.y)
      .addScaledVector(basis.normal, -template.depthInner)
  );

  const positions = [...positionsFront, ...positionsBack];
  const n = positionsFront.length;
  const backOffset = n;
  const indices: number[] = [];

  for (let i = 1; i < n - 1; i += 1) {
    indices.push(0, i, i + 1); // front
    indices.push(backOffset, backOffset + i + 1, backOffset + i); // back (consistent winding outward)
  }

  for (let i = 0; i < n; i += 1) {
    const next = (i + 1) % n;
    const a = i;
    const b = next;
    const c = backOffset + next;
    const d = backOffset + i;
    // Keep outward winding for side quads to avoid backface culling.
    indices.push(a, c, b);
    indices.push(a, d, c);
  }

  const uvs = [...buildUVs(template.face, ccw, faceUvRects), ...buildUVs(template.face, ccw, faceUvRects)];
  const normals = positions.map(() => new Vector3());

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i];
    const ib = indices[i + 1];
    const ic = indices[i + 2];
    const a = positions[ia];
    const b = positions[ib];
    const c = positions[ic];
    const nrm = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    normals[ia].add(nrm);
    normals[ib].add(nrm);
    normals[ic].add(nrm);
  }
  normals.forEach((nrm) => nrm.normalize());

  // lock front/back normals to face directions for stable lighting
  for (let i = 0; i < n; i += 1) {
    normals[i].copy(basis.normal);
  }
  for (let i = backOffset; i < backOffset + n; i += 1) {
    normals[i].copy(basis.normal).multiplyScalar(-1);
  }

  return {
    templateId: template.id,
    face: template.face,
    positions,
    indices,
    uvs,
    normals,
    depthInner: template.depthInner,
  };
}
