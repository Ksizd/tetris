import * as THREE from 'three';
import { BoardDimensions } from '../../core/types';
import { BoardRenderConfig } from '../boardConfig';
import { createBeveledBoxGeometry } from '../beveledBoxGeometry';
import { FragmentMaterialId } from '../../app/destruction/cubeDestructionSim';
import { createMahjongMaterialMaps, createMahjongTileTexture } from '../textures';

export interface FragmentInstancedResources {
  meshes: Record<FragmentMaterialId, THREE.InstancedMesh>;
  geometries: {
    shard: THREE.BufferGeometry;
    face: THREE.BufferGeometry;
    edge: THREE.BufferGeometry;
    core: THREE.BufferGeometry;
    dust: THREE.BufferGeometry;
  };
  materials: Record<FragmentMaterialId, THREE.MeshStandardMaterial>;
  capacity: number;
  supportsUvRect: boolean;
}

const GOLD_BASE_COLOR = 0xf2c14b;
const GOLD_INNER_COLOR = 0xb88934;
const GOLD_DUST_COLOR = 0xf7d98c;
const DEFAULT_FACE_UV_SIZE = 1;

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

function createFaceShardGeometry(params: {
  width: number;
  height: number;
  depth: number;
  uvScale?: { u: number; v: number };
}): THREE.BufferGeometry {
  const { width, height, depth, uvScale } = params;
  const box = new THREE.BoxGeometry(width, height, depth);
  // Ensure front face uses full [0,1] UV so later we can slice subrects via attributes/patterns.
  const uScale = uvScale?.u ?? DEFAULT_FACE_UV_SIZE;
  const vScale = uvScale?.v ?? DEFAULT_FACE_UV_SIZE;
  const uv = box.getAttribute('uv');
  if (uv) {
    for (let i = 0; i < uv.count; i += 1) {
      const u = uv.getX(i) * uScale;
      const v = uv.getY(i) * vScale;
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }
  return box;
}

export function createFragmentInstancedMeshes(
  dimensions: BoardDimensions,
  board: BoardRenderConfig,
  maxFragmentsPerCube = 32
): FragmentInstancedResources {
  const capacity = dimensions.width * dimensions.height * maxFragmentsPerCube;
  const baseSize = Math.max(0.18, board.blockSize * 0.35);
  const shardGeometry = createBeveledBoxGeometry({
    width: baseSize * 1.1,
    height: baseSize * 0.75,
    depth: Math.max(baseSize * 0.9, board.blockDepth * 0.45),
    radius: baseSize * 0.12,
    smoothness: 2,
  });
  const faceGeometry = createFaceShardGeometry({
    width: baseSize * 1.05,
    height: baseSize * 1.05,
    depth: Math.max(baseSize * 0.18, board.blockDepth * 0.12),
  });
  const edgeGeometry = createBeveledBoxGeometry({
    width: baseSize * 1.3,
    height: baseSize * 0.4,
    depth: Math.max(baseSize * 0.28, board.blockDepth * 0.18),
    radius: baseSize * 0.1,
    smoothness: 2,
  });
  const coreGeometry = createBeveledBoxGeometry({
    width: baseSize * 1.45,
    height: baseSize * 1.2,
    depth: Math.max(baseSize * 1.35, board.blockDepth * 0.85),
    radius: baseSize * 0.16,
    smoothness: 2,
  });
  const dustGeometry = createBeveledBoxGeometry({
    width: baseSize * 0.32,
    height: baseSize * 0.32,
    depth: Math.max(baseSize * 0.22, board.blockDepth * 0.14),
    radius: baseSize * 0.06,
    smoothness: 1,
  });

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

  const meshes = Object.entries(materials).reduce(
    (acc, [key, material]) => {
      const useGeometry =
        key === 'face'
          ? faceGeometry
          : key === 'gold'
            ? edgeGeometry
            : key === 'inner'
              ? coreGeometry
              : dustGeometry;
      const mesh = new THREE.InstancedMesh(useGeometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const tintArray = new Float32Array(capacity * 4);
      tintArray.fill(1);
      const tintAttr = new THREE.InstancedBufferAttribute(tintArray, 4);
      tintAttr.setUsage(THREE.DynamicDrawUsage);
      mesh.geometry.setAttribute('instanceTint', tintAttr);
      if (key === 'face') {
        const uvRect = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        uvRect.setUsage(THREE.DynamicDrawUsage);
        mesh.geometry.setAttribute('instanceUvRect', uvRect);
      }
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `fragments-${key}`;
      acc[key as FragmentMaterialId] = mesh;
      return acc;
    },
    {} as Record<FragmentMaterialId, THREE.InstancedMesh>
  );

  return {
    meshes,
    geometries: {
      shard: shardGeometry,
      face: faceGeometry,
      edge: edgeGeometry,
      core: coreGeometry,
      dust: dustGeometry,
    },
    materials,
    capacity,
    supportsUvRect: true,
  };
}
