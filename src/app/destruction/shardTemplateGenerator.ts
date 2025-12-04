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
  [CubeFace.Front]: { min: 18, max: 32 },
  [CubeFace.Right]: { min: 12, max: 24 },
  [CubeFace.Left]: { min: 12, max: 24 },
  [CubeFace.Top]: { min: 12, max: 24 },
  [CubeFace.Bottom]: { min: 12, max: 24 },
  [CubeFace.Back]: { min: 9, max: 16 },
};

const DEFAULT_MIN_AREA = 0.0075; // dense shard tessellation with ~0.75% face area minima

const DEPTH_RANGES: Record<CubeFace, DepthRange> = {
  [CubeFace.Front]: { min: 0.05, max: 0.26 },
  [CubeFace.Right]: { min: 0.12, max: 0.42 },
  [CubeFace.Left]: { min: 0.12, max: 0.42 },
  [CubeFace.Top]: { min: 0.145, max: 0.44 },
  [CubeFace.Bottom]: { min: 0.145, max: 0.44 },
  [CubeFace.Back]: { min: 0.19, max: 0.5 },
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

function randomDepth(min: number, max: number, rnd: () => number): number {
  if (max < min) {
    return min;
  }
  return min + (max - min) * rnd();
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
  // Уходим от жёстко осевых углов, чтобы осколки не были координатно выровнены
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
  // резервный подход: осевой разрез, если сырой рез не удался
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
    // выбираем самый крупный полигон, чтобы деление было устойчивым
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

  // Гарантия минимального числа шардов: если не добились minGuaranteed, режем грубо по центру крупнейшие
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
  // пара любых внутренних точек для более хаотичных осей
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

function ensureCCW(vertices: Vector2[]): Vector2[] {
  const signed = vertices.reduce((acc, v, idx) => {
    const next = vertices[(idx + 1) % vertices.length];
    return acc + v.x * next.y - next.x * v.y;
  }, 0);
  return signed < 0 ? [...vertices].reverse() : vertices;
}

function clampToFace(v: Vector2): Vector2 {
  return new Vector2(clamp(v.x, -0.5, 0.5), clamp(v.y, -0.5, 0.5));
}

function subdivideWithMidpoints(vertices: Vector2[]): Vector2[] {
  const out: Vector2[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const v = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    const mid = v.clone().add(next).multiplyScalar(0.5);
    out.push(v.clone());
    out.push(mid);
  }
  return out;
}

function perturbPolygon2D(base: Vector2[], rnd: () => number, intensity: number, scaleRange: [number, number]): Vector2[] {
  const center = polygonCentroid(base);
  const scale = scaleRange[0] + (scaleRange[1] - scaleRange[0]) * rnd();
  return base.map((v) => {
    const dir = v.clone().sub(center);
    const scaled = center.clone().add(dir.multiplyScalar(scale));
    const jitter = new Vector2((rnd() * 2 - 1) * intensity, (rnd() * 2 - 1) * intensity);
    return clampToFace(scaled.add(jitter));
  });
}

export function computeDepthRange(
  face: CubeFace,
  vertices: Vector2[],
  baseRange: DepthRange
): DepthRange {
  const centroid = polygonCentroid(vertices);
  const maxRadius = Math.SQRT2 * 0.5;
  const distance = clamp(centroid.length() / maxRadius, 0, 1);
  const closeness = 1 - distance; // 1 = центр, 0 = край
  const span = baseRange.max - baseRange.min;
  const spanFactor = 0.8 + 0.2 * closeness; // центр получает полный span, край ~80%
  const maxDepth = baseRange.min + span * spanFactor;
  const minDepth = baseRange.min + span * spanFactor * 0.5; // половина от выбранного span, чтобы ближе к центру было толще
  return {
    min: clamp(minDepth, baseRange.min, baseRange.max),
    max: clamp(maxDepth, baseRange.min, baseRange.max),
  };
}

function buildLayeredPolygons(
  base: Vector2[],
  depthRange: DepthRange,
  rnd: () => number
): { layers: { depth: number; polygon: Vector2[] }[]; depthMin: number; depthMax: number } {
  const front = ensureCCW(subdivideWithMidpoints(base));
  const layerCount = 3 + Math.floor(rnd() * 2); // 3..4 layers total (including front)
  const maxDepth = randomDepth(depthRange.min, depthRange.max, rnd);
  const step = maxDepth / Math.max(1, layerCount - 1);
  const depths: number[] = [0];
  for (let i = 1; i < layerCount; i += 1) {
    if (i === layerCount - 1) {
      depths.push(maxDepth);
      break;
    }
    const jitter = 0.65 + rnd() * 0.9;
    const next = Math.min(maxDepth, depths[i - 1] + step * jitter);
    depths.push(next);
  }

  const layers: { depth: number; polygon: Vector2[] }[] = [];
  layers.push({ depth: 0, polygon: front });
  const center = polygonCentroid(front);
  for (let i = 1; i < depths.length; i += 1) {
    const depth = depths[i];
    const depthRatio = maxDepth > 0 ? depth / maxDepth : 0;
    const intensity = 0.02 + depthRatio * 0.055;
    const scaleJitter: [number, number] = [0.78, 1.22];
    const perturbed = ensureCCW(
      perturbPolygon2D(
        front.map((v) => v.clone()),
        rnd,
        intensity,
        scaleJitter
      ).map((p) => {
        // slight radial bias to avoid collapsing
        const dir = p.clone().sub(center);
        const radial = dir.length() > 1e-5 ? dir.normalize().multiplyScalar(intensity * 0.6 * (rnd() * 2 - 1)) : dir;
        return clampToFace(p.add(radial));
      })
    );
    layers.push({ depth, polygon: perturbed });
  }

  const depthMin = 0;
  const depthMax = Math.max(...depths);
  return { layers, depthMin, depthMax };
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

function toTemplates(
  face: CubeFace,
  polygons: Vector2[][],
  nextId: () => number,
  rnd: () => number
): ShardTemplate[] {
  const depthRange = DEPTH_RANGES[face];
  return polygons.map((poly) => {
    const dr = computeDepthRange(face, poly, depthRange);
    const layered = buildLayeredPolygons(poly, dr, rnd);
    return {
      id: nextId(),
      face,
      polygon2D: { face, vertices: ensureCCW(poly).map((v) => v.clone()) },
      depthMin: layered.depthMin,
      depthMax: layered.depthMax,
      layers: layered.layers.map((layer) => ({ depth: layer.depth, polygon: layer.polygon.map((v) => v.clone()) })),
    };
  });
}

/**
 * Строит набор ShardTemplate для всех граней куба. Теперь используем хаотичные разрезы
 * (життерная сетка + псевдо-Voronoi-плоскости), чтобы уйти от прямоугольных кирпичей.
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
    const templates = toTemplates(face, polys, nextId, rnd);
    templates.forEach((tpl) => {
      const v = validateShardTemplate(tpl);
      if (v.valid) {
        all.push(tpl);
      }
    });
  });
  return all;
}
