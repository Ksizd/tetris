import { BufferAttribute, BufferGeometry, Vector3, Matrix4, Quaternion } from 'three';
import { ShellShardGeometry } from './shellShardGeometryBuilder';
import { ShellShardTemplate } from './shellShardTemplate';

export interface ShellShardBuffer {
  template: ShellShardTemplate;
  geometry: BufferGeometry;
  localCenter: Vector3;
}

function computeLocalCenter(positions: Vector3[]): Vector3 {
  const center = new Vector3();
  positions.forEach((p) => center.add(p));
  return positions.length > 0 ? center.multiplyScalar(1 / positions.length) : center;
}

export function buildShellShardBuffer(geom: ShellShardGeometry, template: ShellShardTemplate): ShellShardBuffer {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(geom.positions.length * 3);
  const normals = new Float32Array(geom.normals.length * 3);
  const uvs = new Float32Array(geom.uvs.length * 2);

  geom.positions.forEach((p, i) => {
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  });
  geom.normals.forEach((n, i) => {
    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;
  });
  geom.uvs.forEach((uv, i) => {
    uvs[i * 2] = uv.x;
    uvs[i * 2 + 1] = uv.y;
  });

  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(geom.indices);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  const localCenter = computeLocalCenter(geom.positions);

  return { template, geometry, localCenter };
}

export interface ShellShardInstance {
  templateId: number;
  geometry: BufferGeometry;
  materialId: 'face' | 'gold';
  matrix: Matrix4;
  uvRect?: { u0: number; u1: number; v0: number; v1: number };
}

export function makeShellShardInstance(
  buffer: ShellShardBuffer,
  cubeWorldPos: Vector3,
  cubeSize: { sx: number; sy: number; sz: number },
  materialId: ShellShardInstance['materialId'] = 'face'
): ShellShardInstance {
  const scale = new Vector3(cubeSize.sx, cubeSize.sy, cubeSize.sz);
  const worldCenter = cubeWorldPos.clone().add(buffer.localCenter.clone().multiply(scale));
  const matrix = new Matrix4().compose(worldCenter, new Quaternion(), scale);
  return {
    templateId: buffer.template.id,
    geometry: buffer.geometry,
    materialId,
    matrix,
  };
}
