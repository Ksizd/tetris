import { Vector2, Vector3 } from 'three';
import { FaceId } from './cubeSpace';
import { ShardTemplate } from './shardTemplate';
import { getFaceBasis } from './shardGeometryBuilder';

export interface ShardFillSample {
  position: Vector3;
  hitTemplateIds: number[];
}

export interface ShardCoverage {
  samples: ShardFillSample[];
  coveredFraction: number;
}

export interface ShardCoverageCheckResult {
  ok: boolean;
  coveredFraction: number;
  requiredFraction: number;
}

export function computePolygonCentroid2D(vertices: Vector2[]): Vector2 {
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const p0 = vertices[i];
    const p1 = vertices[(i + 1) % vertices.length];
    const a = p0.x * p1.y - p1.x * p0.y;
    signedArea += a;
    cx += (p0.x + p1.x) * a;
    cy += (p0.y + p1.y) * a;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-8) {
    return new Vector2(0, 0);
  }
  return new Vector2(cx / (6 * signedArea), cy / (6 * signedArea));
}

export function computePolygonArea2D(vertices: Vector2[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const p0 = vertices[i];
    const p1 = vertices[(i + 1) % vertices.length];
    area += p0.x * p1.y - p1.x * p0.y;
  }
  return Math.abs(area) * 0.5;
}

export function computeShardLocalCenter(template: ShardTemplate): Vector3 {
  const basis = getFaceBasis(template.face);
  const polyCenter = computePolygonCentroid2D(template.polygon2D.vertices);
  const depthCenter = (template.depthMin + template.depthMax) * 0.5;
  const pos = basis.origin
    .clone()
    .addScaledVector(basis.u, polyCenter.x)
    .addScaledVector(basis.v, polyCenter.y)
    .addScaledVector(basis.normal, -depthCenter);
  return pos;
}

/**
 * Эвристика: центр ближе к наружной поверхности, чем к центру куба → считаем, что осколок содержит наружную часть.
 */
export function isShardSurfaceBiased(template: ShardTemplate): boolean {
  const center = computeShardLocalCenter(template);
  const basis = getFaceBasis(template.face);
  const outwardDistance = Math.abs(basis.origin.clone().sub(center).dot(basis.normal));
  const centerDistance = center.length();
  return outwardDistance < centerDistance;
}

function pointInPolygon2D(point: Vector2, polygon: Vector2[]): boolean {
  // Ray casting algorithm (odd-even rule)
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function projectPointToFace(face: FaceId, point: Vector3): { u: number; v: number; depth: number } {
  const basis = getFaceBasis(face);
  const delta = point.clone().sub(basis.origin);
  const depth = -delta.dot(basis.normal); // positive = inward
  const u = delta.dot(basis.u);
  const v = delta.dot(basis.v);
  return { u, v, depth };
}

function isPointInsideShard(template: ShardTemplate, point: Vector3): boolean {
  const { u, v, depth } = projectPointToFace(template.face, point);
  if (depth < template.depthMin - 1e-5 || depth > template.depthMax + 1e-5) {
    return false;
  }
  return pointInPolygon2D(new Vector2(u, v), template.polygon2D.vertices);
}

export function estimateShardCoverage(
  templates: readonly ShardTemplate[],
  resolution = 8
): ShardCoverage {
  const samples: ShardFillSample[] = [];
  let covered = 0;
  const total = resolution ** 3;
  for (let ix = 0; ix < resolution; ix += 1) {
    for (let iy = 0; iy < resolution; iy += 1) {
      for (let iz = 0; iz < resolution; iz += 1) {
        const x = -0.5 + (ix + 0.5) / resolution;
        const y = -0.5 + (iy + 0.5) / resolution;
        const z = -0.5 + (iz + 0.5) / resolution;
        const pos = new Vector3(x, y, z);
        const hits: number[] = [];
        templates.forEach((tpl) => {
          if (isPointInsideShard(tpl, pos)) {
            hits.push(tpl.id);
          }
        });
        if (hits.length > 0) {
          covered += 1;
        }
        samples.push({ position: pos, hitTemplateIds: hits });
      }
    }
  }
  return {
    samples,
    coveredFraction: total === 0 ? 0 : covered / total,
  };
}

/**
 * Быстрая проверка: достаточно ли шаблонов перекрывают объём куба.
 * Немного “дырок” допускается, поэтому minCoveredFraction < 1.
 */
export function validateShardCoverage(
  templates: readonly ShardTemplate[],
  options?: { resolution?: number; minCoveredFraction?: number }
): ShardCoverageCheckResult {
  const resolution = options?.resolution ?? 8;
  const minCoveredFraction = options?.minCoveredFraction ?? 0.55;
  const coverage = estimateShardCoverage(templates, resolution);
  const ok = coverage.coveredFraction >= minCoveredFraction;
  return {
    ok,
    coveredFraction: coverage.coveredFraction,
    requiredFraction: minCoveredFraction,
  };
}
