import { BufferAttribute, BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { FaceUvRect } from './faceUvRect';
import { ShardTemplate } from './shardTemplate';
import { ShardTemplateSet } from './shardTemplateSet';
import { buildShardGeometry, ShardGeometryBuildOptions } from './shardGeometryBuilder';
import { FragmentMaterialId } from './cubeDestructionSim';
import {
  computePolygonArea2D,
  computeShardLocalCenter,
  isShardSurfaceBiased,
} from './shardVolumeMap';

export interface ShardGeometryResource {
  templateId: number;
  geometry: BufferGeometry;
  localCenter: Vector3;
  materialHint: FragmentMaterialId;
  localVolume: number; // unit-cube volume estimate
}

export type ShardGeometryLibrary = Map<number, ShardGeometryResource>;

export interface ShardGeometryBuildParams extends ShardGeometryBuildOptions {
  faceUvRects?: Record<string, FaceUvRect>;
}

export function buildShardGeometryLibrary(
  set: ShardTemplateSet,
  options: ShardGeometryBuildParams = {}
): ShardGeometryLibrary {
  const lib: ShardGeometryLibrary = new Map();
  set.templates.forEach((tpl) => {
    const geomData = buildShardGeometry(tpl, {
      random: options.random,
      faceUvRects: options.faceUvRects as Record<any, FaceUvRect> | undefined,
    });
    const geometry = new BufferGeometry();
    const positions = new Float32Array(geomData.positions.length * 3);
    const normals = new Float32Array(geomData.normals.length * 3);
    const uvs = new Float32Array(geomData.uvs.length * 2);
    geomData.positions.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    });
    geomData.normals.forEach((n, i) => {
      normals[i * 3] = n.x;
      normals[i * 3 + 1] = n.y;
      normals[i * 3 + 2] = n.z;
    });
    geomData.uvs.forEach((uv, i) => {
      uvs[i * 2] = uv.x;
      uvs[i * 2 + 1] = uv.y;
    });
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    geometry.setIndex(geomData.indices);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    const localCenter = computeShardLocalCenter(tpl);
    const materialHint: FragmentMaterialId = isShardSurfaceBiased(tpl) ? 'face' : 'gold';
    const area = computePolygonArea2D(tpl.polygon2D.vertices);
    const thickness = Math.max(0, tpl.depthMax - tpl.depthMin);
    const localVolume = area * thickness;

    lib.set(tpl.id, { templateId: tpl.id, geometry, localCenter, materialHint, localVolume });
  });
  return lib;
}

export interface MakeShardFragmentParams {
  templateId: number;
  cubeWorldPos: Vector3;
  cubeSize: { sx: number; sy: number; sz: number };
  geometryLib: ShardGeometryLibrary;
}

export interface ShardFragmentInstance {
  templateId: number;
  geometry: BufferGeometry;
  materialId: FragmentMaterialId;
  matrix: Matrix4;
  worldCenter: Vector3;
  velocityScale: number;
  lifetimeScale: number;
  volumeEstimate: number;
}

/**
 * Собирает инстанс осколка из подготовленной геометрии и позиции куба.
 * Геометрия единичного куба масштабируется под реальные размеры и переносится в мир.
 */
export function makeFragmentFromTemplate(params: MakeShardFragmentParams): ShardFragmentInstance {
  const { templateId, cubeWorldPos, cubeSize, geometryLib } = params;
  const res = geometryLib.get(templateId);
  if (!res) {
    throw new Error(`Shard geometry for template ${templateId} not found`);
  }
  const scale = new Vector3(cubeSize.sx, cubeSize.sy, cubeSize.sz);
  const worldCenter = cubeWorldPos.clone().add(res.localCenter.clone().multiply(scale));
  const matrix = new Matrix4().compose(worldCenter, new Quaternion(), scale);
  const worldVolume = res.localVolume * scale.x * scale.y * scale.z;

  return {
    templateId,
    geometry: res.geometry,
    materialId: res.materialHint,
    matrix,
    worldCenter,
    ...computePhysicsScales(res.localCenter, worldVolume),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computePhysicsScales(localCenter: Vector3, volume: number): {
  velocityScale: number;
  lifetimeScale: number;
  volumeEstimate: number;
} {
  // Normalize volume around a rough typical shard volume (~0.3 unit^3)
  const normVolume = clamp(volume / 0.3, 0.2, 2.5);
  const massVelocity = clamp(1 / (0.7 + normVolume * 0.3), 0.55, 1.2);
  const lifetimeScale = clamp(0.9 + normVolume * 0.3, 0.9, 1.6);

  const distNorm = clamp(localCenter.length() / 0.9, 0, 1);
  const radialBoost = 1 + (1 - distNorm) * 0.5; // ближе к центру → сильнее

  const velocityScale = clamp(massVelocity * radialBoost, 0.6, 1.6);
  return { velocityScale, lifetimeScale, volumeEstimate: volume };
}
