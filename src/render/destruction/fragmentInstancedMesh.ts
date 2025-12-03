import * as THREE from 'three';
import { BoardDimensions } from '../../core/types';
import { BoardRenderConfig } from '../boardConfig';
import { FragmentMaterialId } from '../../app/destruction/cubeDestructionSim';
import { createMahjongMaterialMaps, createMahjongTileTexture } from '../textures';
import { getDefaultShardTemplateSet } from '../../app/destruction/shardTemplateSet';
import {
  buildShardGeometryLibrary,
  ShardGeometryLibrary,
  ShardGeometryResource,
} from '../../app/destruction/shardFragmentFactory';
import { DEFAULT_FACE_UV_RECTS } from '../../app/destruction/faceUvRect';

export interface FragmentInstancedResources {
  meshesByTemplate: Map<number, THREE.InstancedMesh>;
  templateMaterial: Map<number, FragmentMaterialId>;
  materials: Record<FragmentMaterialId, THREE.MeshStandardMaterial>;
  geometryLibrary: ShardGeometryLibrary;
  capacityPerTemplate: number;
  supportsUvRect: boolean;
}

const GOLD_BASE_COLOR = 0xf2c14b;
const GOLD_INNER_COLOR = 0xb88934;
const GOLD_DUST_COLOR = 0xf7d98c;

function createFaceFragmentMaterial(
  tileTexture: THREE.Texture,
  maps: ReturnType<typeof createMahjongMaterialMaps>
): THREE.MeshStandardMaterial {
  const { roughnessMap, metalnessMap, aoMap } = maps;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tileTexture,
    roughness: 0.22,
    metalness: 0.04,
    roughnessMap,
    metalnessMap,
    aoMap,
    envMapIntensity: 0.95,
    transparent: true,
    opacity: 1,
    vertexColors: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute vec4 instanceUvRect;\n' +
      'attribute vec4 instanceTint;\n' +
      'varying vec4 vInstanceTint;\n' +
      shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
#ifdef USE_UV
  vUv = vec2(
    uv.x * instanceUvRect.z + instanceUvRect.x,
    uv.y * instanceUvRect.w + instanceUvRect.y
  );
#endif
  vInstanceTint = instanceTint;
`
      );
    shader.fragmentShader =
      'varying vec4 vInstanceTint;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  diffuseColor.rgb *= vInstanceTint.rgb;
  diffuseColor.a *= vInstanceTint.a;
`
      );
  };
  return mat;
}

function createGoldFragmentMaterialOuter(
  maps: ReturnType<typeof createMahjongMaterialMaps>
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: GOLD_BASE_COLOR,
    metalness: 1.0,
    roughness: 0.28,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    envMapIntensity: 1.8,
    transparent: true,
    opacity: 1,
    vertexColors: false,
    onBeforeCompile: (shader) => {
      shader.vertexShader =
        'attribute vec4 instanceTint;\n' +
        'varying vec4 vInstanceTint;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vInstanceTint = instanceTint;
`
        );
      shader.fragmentShader =
        'varying vec4 vInstanceTint;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  diffuseColor.rgb *= vInstanceTint.rgb;
  diffuseColor.a *= vInstanceTint.a;
`
        );
    },
  });
}

function createGoldFragmentMaterialInner(
  maps: ReturnType<typeof createMahjongMaterialMaps>
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: GOLD_INNER_COLOR,
    metalness: 0.85,
    roughness: 0.36,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    envMapIntensity: 1.25,
    transparent: true,
    opacity: 1,
    vertexColors: false,
    onBeforeCompile: (shader) => {
      shader.vertexShader =
        'attribute vec4 instanceTint;\n' +
        'varying vec4 vInstanceTint;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vInstanceTint = instanceTint;
`
        );
      shader.fragmentShader =
        'varying vec4 vInstanceTint;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  diffuseColor.rgb *= vInstanceTint.rgb;
  diffuseColor.a *= vInstanceTint.a;
`
        );
    },
  });
}

function createDustMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: GOLD_DUST_COLOR,
    metalness: 0.7,
    roughness: 0.45,
    envMapIntensity: 0.8,
    transparent: true,
    opacity: 1,
    vertexColors: false,
    onBeforeCompile: (shader) => {
      shader.vertexShader =
        'attribute vec4 instanceTint;\n' +
        'varying vec4 vInstanceTint;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vInstanceTint = instanceTint;
`
        );
      shader.fragmentShader =
        'varying vec4 vInstanceTint;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  diffuseColor.rgb *= vInstanceTint.rgb;
  diffuseColor.a *= vInstanceTint.a;
`
        );
    },
  });
}

function createInstancedMeshForTemplate(
  tpl: ShardGeometryResource,
  material: THREE.Material,
  capacity: number
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(tpl.geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const tintArray = new Float32Array(capacity * 4);
  for (let i = 0; i < capacity; i += 1) {
    tintArray[i * 4] = 1;
    tintArray[i * 4 + 1] = 1;
    tintArray[i * 4 + 2] = 1;
    tintArray[i * 4 + 3] = 1;
  }
  const tintAttr = new THREE.InstancedBufferAttribute(tintArray, 4);
  tintAttr.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute('instanceTint', tintAttr);

  if (tpl.materialHint === 'face') {
    const uvArray = new Float32Array(capacity * 4);
    for (let i = 0; i < capacity; i += 1) {
      uvArray[i * 4] = 0;
      uvArray[i * 4 + 1] = 0;
      uvArray[i * 4 + 2] = 1;
      uvArray[i * 4 + 3] = 1;
    }
    const uvAttr = new THREE.InstancedBufferAttribute(uvArray, 4);
    uvAttr.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute('instanceUvRect', uvAttr);
  }

  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `fragment-template-${tpl.templateId}`;
  return mesh;
}

export function createFragmentInstancedMeshes(
  dimensions: BoardDimensions,
  board: BoardRenderConfig,
  maxFragmentsPerCube = 32
): FragmentInstancedResources {
  const templateSet = getDefaultShardTemplateSet();
  const geometryLibrary = buildShardGeometryLibrary(templateSet, { faceUvRects: DEFAULT_FACE_UV_RECTS });
  const totalCapacity = dimensions.width * dimensions.height * maxFragmentsPerCube;
  const capacityPerTemplate = Math.max(8, Math.ceil(totalCapacity / Math.max(1, geometryLibrary.size)));
  const tileTexture = createMahjongTileTexture();
  const atlasSize =
    typeof tileTexture.image === 'object' && tileTexture.image && 'width' in tileTexture.image
      ? (tileTexture.image as { width?: number }).width ?? 1024
      : 1024;
  const materialMaps = createMahjongMaterialMaps(atlasSize);

  const materials: Record<FragmentMaterialId, THREE.MeshStandardMaterial> = {
    gold: createGoldFragmentMaterialOuter(materialMaps),
    face: createFaceFragmentMaterial(tileTexture, materialMaps),
    inner: createGoldFragmentMaterialInner(materialMaps),
    dust: createDustMaterial(),
  };

  const meshesByTemplate: Map<number, THREE.InstancedMesh> = new Map();
  const templateMaterial: Map<number, FragmentMaterialId> = new Map();

  geometryLibrary.forEach((tpl) => {
    const materialId: FragmentMaterialId = tpl.materialHint ?? 'gold';
    const material = materials[materialId];
    const mesh = createInstancedMeshForTemplate(tpl, material, capacityPerTemplate);
    mesh.name = `fragment-template-${tpl.templateId}-${materialId}`;
    meshesByTemplate.set(tpl.templateId, mesh);
    templateMaterial.set(tpl.templateId, materialId);
  });

  return {
    meshesByTemplate,
    templateMaterial,
    materials,
    geometryLibrary,
    capacityPerTemplate,
    supportsUvRect: true,
  };
}
