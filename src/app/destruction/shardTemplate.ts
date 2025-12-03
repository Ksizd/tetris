import { Vector2 } from 'three';
import { CubeFace, CUBE_LOCAL_MIN, CUBE_LOCAL_MAX } from './cubeSpace';

export interface FacePolygon2D {
  face: CubeFace;
  vertices: Vector2[]; // polygon in local face space within [-0.5, 0.5]^2
}

// Template describing a shard extruded from a face polygon with depth along the face normal.
export interface ShardTemplate {
  id: number;
  face: CubeFace;
  polygon2D: FacePolygon2D;
  depthMin: number; // [0..1] relative depth from the face into the cube
  depthMax: number; // [0..1], >= depthMin
}

function isVertexInCubeRange(v: Vector2): boolean {
  return (
    v.x >= CUBE_LOCAL_MIN &&
    v.x <= CUBE_LOCAL_MAX &&
    v.y >= CUBE_LOCAL_MIN &&
    v.y <= CUBE_LOCAL_MAX
  );
}

export interface ShardValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateShardTemplate(template: ShardTemplate): ShardValidationResult {
  if (!Number.isFinite(template.id)) {
    return { valid: false, reason: 'id must be finite number' };
  }
  if (template.depthMin < 0 || template.depthMax > 1) {
    return { valid: false, reason: 'depth must be within [0,1]' };
  }
  if (template.depthMin > template.depthMax) {
    return { valid: false, reason: 'depthMin must be <= depthMax' };
  }
  const verts = template.polygon2D.vertices;
  if (!verts || verts.length < 3) {
    return { valid: false, reason: 'polygon must have at least 3 vertices' };
  }
  const outside = verts.find((v) => !isVertexInCubeRange(v));
  if (outside) {
    return { valid: false, reason: 'polygon vertices must lie within cube local square [-0.5,0.5]' };
  }
  return { valid: true };
}
