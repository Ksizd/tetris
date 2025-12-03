import { BufferAttribute, BufferGeometry } from 'three';
import { CanonicalShard } from './canonicalShards';
import { FragmentMaterialId } from './cubeDestructionSim';

export interface CanonicalShardResource {
  shardId: number;
  geometry: BufferGeometry;
  materialId: FragmentMaterialId;
  approximateVolume: number;
}

function materialFromKind(kind: CanonicalShard['materialKind']): FragmentMaterialId {
  return kind === 'faceAndGold' ? 'face' : 'gold';
}

export function buildCanonicalShardBuffer(shard: CanonicalShard): CanonicalShardResource {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(shard.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(shard.normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(shard.uvs, 2));
  geometry.setIndex(new BufferAttribute(shard.indices, 1));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return {
    shardId: shard.id,
    geometry,
    materialId: materialFromKind(shard.materialKind),
    approximateVolume: shard.approximateVolume,
  };
}

export function buildCanonicalShardLibrary(shards: CanonicalShard[]): Map<number, CanonicalShardResource> {
  const lib = new Map<number, CanonicalShardResource>();
  shards.forEach((shard) => {
    lib.set(shard.id, buildCanonicalShardBuffer(shard));
  });
  return lib;
}
