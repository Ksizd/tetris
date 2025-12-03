import { Vector2 } from 'three';
import { CubeFace } from './cubeSpace';
import { ShardTemplate, validateShardTemplate } from './shardTemplate';

type Axis = 'x' | 'y';

interface FaceCountRange {
  min: number;
  max: number;
}

export interface DepthRange {
  min: number;
  max: number;
}

export interface ShardGenerationOptions {
  faceCounts?: Partial<Record<CubeFace, FaceCountRange>>;
  minArea?: number; // in square units of the local face (full face area = 1)
  random?: () => number;
}

const DEFAULT_FACE_COUNTS: Record<CubeFace, FaceCountRange> = {
  [CubeFace.Front]: { min: 6, max: 12 },
  [CubeFace.Right]: { min: 4, max: 8 },
  [CubeFace.Left]: { min: 4, max: 8 },
  [CubeFace.Top]: { min: 4, max: 8 },
  [CubeFace.Bottom]: { min: 4, max: 8 },
  [CubeFace.Back]: { min: 3, max: 5 },
};

const DEFAULT_MIN_AREA = 0.02; // ~2% of face area to avoid Ð¼Ð¸ÐºÑ€Ð¾Ð¿Ð¾Ð»Ð¸Ð³Ð¾Ð½Ð¾Ð²

const DEPTH_RANGES: Record<CubeFace, DepthRange> = {
  [CubeFace.Front]: { min: 0.05, max: 0.35 },
  [CubeFace.Right]: { min: 0.15, max: 0.55 },
  [CubeFace.Left]: { min: 0.15, max: 0.55 },
  [CubeFace.Top]: { min: 0.18, max: 0.58 },
  [CubeFace.Bottom]: { min: 0.18, max: 0.58 },
  [CubeFace.Back]: { min: 0.25, max: 0.65 },
};

function randomInt(min: number, max: number, rnd: () => number): number {
  return Math.floor(min + rnd() * (max - min + 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function polygonArea(vertices: Vector2[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) * 0.5;
}

function boundingBox(vertices: Vector2[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  vertices.forEach((v) => {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  });
  return { minX, maxX, minY, maxY };
}

function clipPolygonAxisAligned(vertices: Vector2[], axis: Axis, value: number, keepGreater: boolean): Vector2[] {
  const result: Vector2[] = [];
  const getCoord = (v: Vector2) => (axis === 'x' ? v.x : v.y);

  for (let i = 0; i < vertices.length; i += 1) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    const currentCoord = getCoord(current);
    const nextCoord = getCoord(next);

    const currentInside = keepGreater ? currentCoord >= value : currentCoord <= value;
    const nextInside = keepGreater ? nextCoord >= value : nextCoord <= value;

    if (currentInside && nextInside) {
      result.push(next.clone());
      continue;
    }

    if (currentInside !== nextInside) {
      const t = (value - currentCoord) / (nextCoord - currentCoord);
      const intersection =
        axis === 'x'
          ? new Vector2(value, current.y + t * (next.y - current.y))
          : new Vector2(current.x + t * (next.x - current.x), value);
      result.push(intersection);
      if (nextInside) {
        result.push(next.clone());
      }
    }
  }
  return result;
}

function splitPolygonAxisAligned(vertices: Vector2[], axis: Axis, value: number, minArea: number): Vector2[][] | null {
  const a = clipPolygonAxisAligned(vertices, axis, value, false);
  const b = clipPolygonAxisAligned(vertices, axis, value, true);
  if (a.length < 3 || b.length < 3) {
    return null;
  }
  if (polygonArea(a) < minArea || polygonArea(b) < minArea) {
    return null;
  }
  return [a, b];
}

function projectRange(vertices: Vector2[], normal: Vector2): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  vertices.forEach((v) => {
    const p = normal.dot(v);
    min = Math.min(min, p);
    max = Math.max(max, p);
  });
  return { min, max };
}

function clipPolygonByLine(vertices: Vector2[], normal: Vector2, distance: number, keepPositive: boolean): Vector2[] {
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

function splitPolygonByLine(
  vertices: Vector2[],
  normal: Vector2,
  distance: number,
  minArea: number
): Vector2[][] | null {
  const a = clipPolygonByLine(vertices, normal, distance, false);
  const b = clipPolygonByLine(vertices, normal, distance, true);
  if (a.length < 3 || b.length < 3) {
    return null;
  }
  if (polygonArea(a) < minArea || polygonArea(b) < minArea) {
    return null;
  }
  return [a, b];
}

function randomNormal(rnd: () => number): Vector2 {
  let angle = rnd() * Math.PI * 2;
  // Ð£Ñ…Ð¾Ð´Ð¸Ð¼ Ð¾Ñ‚ Ð¶Ñ‘ÑÑ‚ÐºÐ¾ Ð¾ÑÐµÐ²Ñ‹Ñ… ÑƒÐ³Ð»Ð¾Ð², Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð¾ÑÐºÐ¾Ð»ÐºÐ¸ Ð½Ðµ Ð±Ñ‹Ð»Ð¸ ÐºÐ¾Ð¾Ñ€Ð´Ð¸Ð½Ð°Ñ‚Ð½Ð¾ Ð²Ñ‹Ñ€Ð¾Ð²Ð½ÐµÐ½Ñ‹
  if (Math.abs(Math.sin(angle)) < 0.15 || Math.abs(Math.cos(angle)) < 0.15) {
    angle += Math.PI * 0.35;
  }
  return new Vector2(Math.cos(angle), Math.sin(angle)).normalize();
}

function randomNormalFromSeeds(seeds: Vector2[], rnd: () => number): Vector2 | null {
  const tries = 6;
  for (let i = 0; i < tries; i += 1) {
    const a = seeds[randomInt(0, seeds.length - 1, rnd)];
    const b = seeds[randomInt(0, seeds.length - 1, rnd)];
    if (a === b) {
      continue;
    }
    const dir = b.clone().sub(a);
    if (dir.length() < 0.05) {
      continue;
    }
    return dir.normalize();
  }
  return null;
}

function splitPolygonIrregular(
  poly: Vector2[],
  minArea: number,
  rnd: () => number,
  seeds: Vector2[]
): Vector2[][] | null {
  const normalSeed = seeds.length >= 2 ? randomNormalFromSeeds(seeds, rnd) : null;
  const normal = (normalSeed ?? randomNormal(rnd)).normalize();
  const { min, max } = projectRange(poly, normal);
  const span = max - min;
  if (span < 0.12) {
    const box = boundingBox(poly);
    const axis: Axis = box.maxX - box.minX > box.maxY - box.minY ? 'x' : 'y';
    const center = axis === 'x' ? (box.minX + box.maxX) * 0.5 : (box.minY + box.maxY) * 0.5;
    return splitPolygonAxisAligned(poly, axis, center, minArea);
  }
  const margin = span * 0.2;
  const distance = min + margin + rnd() * Math.max(0.01, span - margin * 2);
  const split = splitPolygonByLine(poly, normal, distance, minArea);
  if (split) {
    return split;
  }
  // Ñ€ÐµÐ·ÐµÑ€Ð²Ð½Ñ‹Ð¹ Ð¿Ð¾Ð´Ñ…Ð¾Ð´: Ð¾ÑÐµÐ²Ð¾Ð¹ Ñ€Ð°Ð·Ñ€ÐµÐ·, ÐµÑÐ»Ð¸ ÑÑ‹Ñ€Ð¾Ð¹ Ñ€ÐµÐ· Ð½Ðµ ÑƒÐ´Ð°Ð»ÑÑ
  const box = boundingBox(poly);
  const axis: Axis = box.maxX - box.minX > box.maxY - box.minY ? 'x' : 'y';
  const center = axis === 'x' ? (box.minX + box.maxX) * 0.5 : (box.minY + box.maxY) * 0.5;
  return splitPolygonAxisAligned(poly, axis, center, minArea);
}

function splitUntil(
  targetCount: number,
  minArea: number,
  polygons: Vector2[][],
  rnd: () => number,
  minGuaranteed: number,
  seedPoints: Vector2[]
): Vector2[][] {
  let attempts = 0;
  const maxAttempts = targetCount * 20;
  while (polygons.length < targetCount && attempts < maxAttempts) {
    attempts += 1;
    // Ð²Ñ‹Ð±Ð¸Ñ€Ð°ÐµÐ¼ ÑÐ°Ð¼Ñ‹Ð¹ ÐºÑ€ÑƒÐ¿Ð½Ñ‹Ð¹ Ð¿Ð¾Ð»Ð¸Ð³Ð¾Ð½, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð´ÐµÐ»ÐµÐ½Ð¸Ðµ Ð±Ñ‹Ð»Ð¾ ÑƒÑÑ‚Ð¾Ð¹Ñ‡Ð¸Ð²Ñ‹Ð¼
    const areas = polygons.map((p) => polygonArea(p));
    let idx = 0;
    for (let i = 1; i < areas.length; i += 1) {
      if (areas[i] > areas[idx]) {
        idx = i;
      }
    }
    const poly = polygons[idx];
    const split = splitPolygonIrregular(poly, minArea, rnd, seedPoints);
    if (split) {
      polygons.splice(idx, 1, split[0], split[1]);
    }
  }

  // Ð“Ð°Ñ€Ð°Ð½Ñ‚Ð¸Ñ Ð¼Ð¸Ð½Ð¸Ð¼Ð°Ð»ÑŒÐ½Ð¾Ð³Ð¾ Ñ‡Ð¸ÑÐ»Ð° ÑˆÐ°Ñ€Ð´Ð¾Ð²: ÐµÑÐ»Ð¸ Ð½Ðµ Ð´Ð¾Ð±Ð¸Ð»Ð¸ÑÑŒ minGuaranteed, Ñ€ÐµÐ¶ÐµÐ¼ Ð³Ñ€ÑƒÐ±Ð¾ Ð¿Ð¾ Ñ†ÐµÐ½Ñ‚Ñ€Ñƒ ÐºÑ€ÑƒÐ¿Ð½ÐµÐ¹ÑˆÐ¸Ðµ
  while (polygons.length < minGuaranteed) {
    const areas = polygons.map((p) => polygonArea(p));
    let idx = 0;
    for (let i = 1; i < areas.length; i += 1) {
      if (areas[i] > areas[idx]) {
        idx = i;
      }
    }
    const poly = polygons[idx];
    const fallback = splitPolygonIrregular(poly, minArea * 0.5, rnd, seedPoints);
    if (fallback) {
      polygons.splice(idx, 1, fallback[0], fallback[1]);
      continue;
    }
    const box = boundingBox(poly);
    const axis: Axis = box.maxX - box.minX > box.maxY - box.minY ? 'x' : 'y';
    const center = axis === 'x' ? (box.minX + box.maxX) * 0.5 : (box.minY + box.maxY) * 0.5;
    const axisFallback = splitPolygonAxisAligned(poly, axis, center, minArea * 0.5);
    if (!axisFallback) {
      break;
    }
    polygons.splice(idx, 1, axisFallback[0], axisFallback[1]);
  }

  return polygons;
}

function generateSeedPoints(rnd: () => number): Vector2[] {
  const points: Vector2[] = [];
  const grid = 4;
  const step = 1 / (grid - 1);
  const jitter = step * 0.4;
  for (let ix = 0; ix < grid; ix += 1) {
    for (let iy = 0; iy < grid; iy += 1) {
      const baseX = -0.5 + ix * step;
      const baseY = -0.5 + iy * step;
      const jx = (rnd() * 2 - 1) * jitter;
      const jy = (rnd() * 2 - 1) * jitter;
      points.push(new Vector2(clamp(baseX + jx, -0.5, 0.5), clamp(baseY + jy, -0.5, 0.5)));
    }
  }
  // Ð¿Ð°Ñ€Ð° Ð»ÑŽÐ±Ñ‹Ñ… Ð²Ð½ÑƒÑ‚Ñ€ÐµÐ½Ð½Ð¸Ñ… Ñ‚Ð¾Ñ‡ÐµÐº Ð´Ð»Ñ Ð±Ð¾Ð»ÐµÐµ Ñ…Ð°Ð¾Ñ‚Ð¸Ñ‡Ð½Ñ‹Ñ… Ð¾ÑÐµÐ¹
  const extras = 3;
  for (let i = 0; i < extras; i += 1) {
    points.push(new Vector2(-0.45 + rnd() * 0.9, -0.45 + rnd() * 0.9));
  }
  return points;
}

function polygonCentroid(vertices: Vector2[]): Vector2 {
  let areaAcc = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const cross = a.x * b.y - b.x * a.y;
    areaAcc += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(areaAcc) < 1e-6) {
    return new Vector2(0, 0);
  }
  const area = areaAcc * 0.5;
  const factor = 1 / (6 * area);
  return new Vector2(cx * factor, cy * factor);
}

export function computeDepthRange(
  face: CubeFace,
  vertices: Vector2[],
  baseRange: DepthRange
): DepthRange {
  const centroid = polygonCentroid(vertices);
  const maxRadius = Math.SQRT2 * 0.5;
  const distance = clamp(centroid.length() / maxRadius, 0, 1);
  const closeness = 1 - distance; // 1 = Ñ†ÐµÐ½Ñ‚Ñ€, 0 = ÐºÑ€Ð°Ð¹
  const span = baseRange.max - baseRange.min;
  const spanFactor = 0.8 + 0.2 * closeness; // Ñ†ÐµÐ½Ñ‚Ñ€ Ð¿Ð¾Ð»ÑƒÑ‡Ð°ÐµÑ‚ Ð¿Ð¾Ð»Ð½Ñ‹Ð¹ span, ÐºÑ€Ð°Ð¹ ~80%
  const maxDepth = baseRange.min + span * spanFactor;
  const minDepth = baseRange.min + span * spanFactor * 0.5; // Ð¿Ð¾Ð»Ð¾Ð²Ð¸Ð½Ð° Ð¾Ñ‚ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ð¾Ð³Ð¾ span, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð±Ð»Ð¸Ð¶Ðµ Ðº Ñ†ÐµÐ½Ñ‚Ñ€Ñƒ Ð±Ñ‹Ð»Ð¾ Ñ‚Ð¾Ð»Ñ‰Ðµ
  return {
    min: clamp(minDepth, baseRange.min, baseRange.max),
    max: clamp(maxDepth, baseRange.min, baseRange.max),
  };
}

function buildFacePolygons(
  face: CubeFace,
  targetRange: FaceCountRange,
  minArea: number,
  rnd: () => number
): Vector2[][] {
  const target = randomInt(targetRange.min, targetRange.max, rnd);
  const minGuaranteed = targetRange.min;
  const baseSquare = [new Vector2(-0.5, -0.5), new Vector2(0.5, -0.5), new Vector2(0.5, 0.5), new Vector2(-0.5, 0.5)];
  const seeds = generateSeedPoints(rnd);
  const result = splitUntil(target, minArea, [baseSquare], rnd, minGuaranteed, seeds);
  return result;
}

function toTemplates(face: CubeFace, polygons: Vector2[][], nextId: () => number): ShardTemplate[] {
  const depthRange = DEPTH_RANGES[face];
  return polygons.map((poly) => ({
    id: nextId(),
    face,
    polygon2D: { face, vertices: poly.map((v) => v.clone()) },
    ...(() => {
      const dr = computeDepthRange(face, poly, depthRange);
      return { depthMin: dr.min, depthMax: dr.max };
    })(),
  }));
}

/**
 * Ð¡Ñ‚Ñ€Ð¾Ð¸Ñ‚ Ð½Ð°Ð±Ð¾Ñ€ ShardTemplate Ð´Ð»Ñ Ð²ÑÐµÑ… Ð³Ñ€Ð°Ð½ÐµÐ¹ ÐºÑƒÐ±Ð°. Ð¢ÐµÐ¿ÐµÑ€ÑŒ Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÐ¼ Ñ…Ð°Ð¾Ñ‚Ð¸Ñ‡Ð½Ñ‹Ðµ Ñ€Ð°Ð·Ñ€ÐµÐ·Ñ‹
 * (Ð¶Ð¸Ñ‚Ñ‚ÐµÑ€Ð½Ð°Ñ ÑÐµÑ‚ÐºÐ° + Ð¿ÑÐµÐ²Ð´Ð¾-Voronoi-Ð¿Ð»Ð¾ÑÐºÐ¾ÑÑ‚Ð¸), Ñ‡Ñ‚Ð¾Ð±Ñ‹ ÑƒÐ¹Ñ‚Ð¸ Ð¾Ñ‚ Ð¿Ñ€ÑÐ¼Ð¾ÑƒÐ³Ð¾Ð»ÑŒÐ½Ñ‹Ñ… ÐºÐ¸Ñ€Ð¿Ð¸Ñ‡ÐµÐ¹.
 */
export function generateShardTemplates(options: ShardGenerationOptions = {}): ShardTemplate[] {
  const counts: Record<CubeFace, FaceCountRange> = {
    ...DEFAULT_FACE_COUNTS,
    ...(options.faceCounts ?? {}),
  };
  const minArea = options.minArea ?? DEFAULT_MIN_AREA;
  const rnd = options.random ?? Math.random;
  let idCounter = 0;
  const nextId = () => {
    idCounter += 1;
    return idCounter;
  };

  const faces: CubeFace[] = [
    CubeFace.Front,
    CubeFace.Right,
    CubeFace.Left,
    CubeFace.Top,
    CubeFace.Bottom,
    CubeFace.Back,
  ];
  const all: ShardTemplate[] = [];
  faces.forEach((face) => {
    const polys = buildFacePolygons(face, counts[face], minArea, rnd);
    const templates = toTemplates(face, polys, nextId);
    templates.forEach((tpl) => {
      const v = validateShardTemplate(tpl);
      if (v.valid) {
        all.push(tpl);
      }
    });
  });
  return all;
}
