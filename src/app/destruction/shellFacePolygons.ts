import { Vector2 } from 'three';
import { CubeFace, CUBE_LOCAL_MAX, CUBE_LOCAL_MIN, CUBE_LOCAL_SIZE } from './cubeSpace';
import { FacePolygon2D } from './shardTemplate';
import { FaceSeed, generateFaceSeeds, seedToLocalFacePos } from './shellFaceSeeds';

export interface FacePolygonOptions {
  seeds?: FaceSeed[];
  seedCount?: number;
  random?: () => number;
  inset?: number;
}

function clipPolygonByLine(
  vertices: Vector2[],
  normal: Vector2,
  distance: number,
  keepPositive: boolean
): Vector2[] {
  const result: Vector2[] = [];
  const signed = (v: Vector2) => normal.dot(v) - distance;

  for (let i = 0; i < vertices.length; i += 1) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    const d0 = signed(current);
    const d1 = signed(next);
    const currentInside = keepPositive ? d0 >= 0 : d0 <= 0;
    const nextInside = keepPositive ? d1 >= 0 : d1 <= 0;

    if (currentInside && nextInside) {
      result.push(next.clone());
      continue;
    }

    if (currentInside !== nextInside) {
      const t = d0 / (d0 - d1);
      const intersection = current.clone().lerp(next, t);
      result.push(intersection);
      if (nextInside) {
        result.push(next.clone());
      }
    }
  }
  return result;
}

function computePolygonArea(vertices: Vector2[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) * 0.5;
}

function squarePolygon(): Vector2[] {
  return [
    new Vector2(CUBE_LOCAL_MIN, CUBE_LOCAL_MIN),
    new Vector2(CUBE_LOCAL_MAX, CUBE_LOCAL_MIN),
    new Vector2(CUBE_LOCAL_MAX, CUBE_LOCAL_MAX),
    new Vector2(CUBE_LOCAL_MIN, CUBE_LOCAL_MAX),
  ];
}

function buildVoronoiForSeeds(seeds: Vector2[]): Vector2[][] {
  const polygons: Vector2[][] = seeds.map(() => squarePolygon());

  for (let i = 0; i < seeds.length; i += 1) {
    const si = seeds[i];
    for (let j = 0; j < seeds.length; j += 1) {
      if (i === j) continue;
      const sj = seeds[j];
      const dir = sj.clone().sub(si);
      const len = dir.length();
      if (len < 1e-6) continue;
      const normal = dir.clone().normalize(); // points from si to sj
      const mid = si.clone().add(sj).multiplyScalar(0.5);
      const distance = normal.dot(mid);
      const clipped = clipPolygonByLine(polygons[i], normal, distance, false); // keep seed side (negative)
      polygons[i] = clipped;
    }
  }

  return polygons.map((poly) => {
    // Remove degenerate duplicates
    const cleaned: Vector2[] = [];
    poly.forEach((p) => {
      const last = cleaned[cleaned.length - 1];
      if (!last || last.distanceToSquared(p) > 1e-10) {
        cleaned.push(p);
      }
    });
    return cleaned;
  });
}

export function generateFacePolygons(face: CubeFace, options: FacePolygonOptions = {}): FacePolygon2D[] {
  const seeds =
    options.seeds ??
    generateFaceSeeds(face, {
      count: options.seedCount,
      inset: options.inset,
      random: options.random,
    });
  const localSeeds = seeds.map((s) => seedToLocalFacePos(s));
  const polygons2D = buildVoronoiForSeeds(localSeeds);

  return polygons2D
    .map((poly) => ({
      face,
      vertices: poly,
    }))
    .filter((p) => p.vertices.length >= 3 && computePolygonArea(p.vertices) > 1e-6);
}

export function estimateFaceCoverage(polygons: FacePolygon2D[], samplesPerAxis = 6): number {
  if (samplesPerAxis <= 0) {
    return 0;
  }
  let covered = 0;
  let total = 0;
  for (let ix = 0; ix < samplesPerAxis; ix += 1) {
    for (let iy = 0; iy < samplesPerAxis; iy += 1) {
      total += 1;
      const x = CUBE_LOCAL_MIN + (ix + 0.5) * (CUBE_LOCAL_SIZE / samplesPerAxis);
      const y = CUBE_LOCAL_MIN + (iy + 0.5) * (CUBE_LOCAL_SIZE / samplesPerAxis);
      const inside = polygons.some((p) => pointInPolygon(new Vector2(x, y), p.vertices));
      if (inside) covered += 1;
    }
  }
  return total === 0 ? 0 : covered / total;
}

function pointInPolygon(point: Vector2, polygon: Vector2[]): boolean {
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
