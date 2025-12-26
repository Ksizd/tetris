import * as THREE from 'three';
import type { DebugTag } from './debug/objectInspectorTypes';
import type { FootprintLavaSmokeFxInternal } from './footprintLavaSmokeFx';

export interface FootprintLavaSmokeRender {
  group: THREE.Group;
  discMaterials: THREE.ShaderMaterial[];
  smoke: {
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    geometry: THREE.InstancedBufferGeometry;
    attributes: {
      iPosSize: THREE.InstancedBufferAttribute;
      iVelRot: THREE.InstancedBufferAttribute;
      iMisc0: THREE.InstancedBufferAttribute;
      iMisc1: THREE.InstancedBufferAttribute;
    };
    arrays: {
      posSize: Float32Array;
      velRot: Float32Array;
      misc0: Float32Array;
      misc1: Float32Array;
    };
    sort: SmokeSortState;
  };
  tuning: {
    smokeBodyIntensity: number;
    smokeGlowIntensity: number;
    disc0Alpha: number;
    disc1Alpha: number;
    smokeColorHotScale: number;
  };
  dispose: () => void;
}

type SmokeSortState = {
  bins: Uint32Array;
  offsets: Uint32Array;
  keys: Float32Array;
  indices: Int32Array;
  range: Float32Array;
};

export type SmokeRenderPerf = {
  sortMs: number;
  fillMs: number;
  uploadMs: number;
};

const SORT_BIN_COUNT = 64;

const DISC_VERTEX_SHADER = `
  #include <fog_pars_vertex>

  varying vec3 vPos;

  void main() {
    vPos = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const DISC_FRAGMENT_SHADER = `
  #include <common>
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform float uRadius;
  uniform float uIntensity;
    uniform float uEdgeGlow;
    uniform float uAlpha;
    uniform vec3 uColorHot;
    uniform vec3 uColorEdge;
    uniform vec3 uColorMid;
    uniform vec3 uColorCool;

  varying vec3 vPos;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    for (int i = 0; i < 5; i++) {
      v += a * noise21(p);
      p *= 2.17;
      a *= 0.55;
    }
    return v;
  }

  void main() {
    vec2 xz = vPos.xz;
    float r = length(xz);
    float theta = atan(xz.y, xz.x);
    float rNorm = clamp(r / max(1e-6, uRadius), 0.0, 1.0);

    float centerKill = smoothstep(0.18, 0.55, rNorm);
    float edgeKill = 1.0 - smoothstep(0.90, 1.0, rNorm);
    float radialMask = centerKill * edgeKill;
    float edgeGlow = pow(smoothstep(0.65, 0.98, rNorm), 1.4) * uEdgeGlow;

    vec2 flowUv = vec2(theta * 1.6 + uTime * 0.18, rNorm * 3.8 - uTime * 0.07);
    float w1 = fbm(flowUv * 1.2 + vec2(0.0, uTime * 0.03));
    float w2 = fbm(flowUv * 1.2 + vec2(12.7, -uTime * 0.028));
    vec2 warp = vec2(w1, w2) - 0.5;
    flowUv += warp * 0.85;

    float n = fbm(flowUv * 2.4);
    float nDetail = fbm(flowUv * 5.4 + vec2(uTime * 0.11, -uTime * 0.09));
    float density = smoothstep(0.35, 0.86, n * 0.75 + nDetail * 0.35);

    float veins = smoothstep(0.55, 0.95, fbm(flowUv * 7.2));
    density *= (0.78 + 0.22 * veins);

    float alpha = density * radialMask * uAlpha;
    if (alpha < 0.003) discard;

      vec3 col = mix(uColorCool, uColorMid, smoothstep(0.05, 0.75, density));
      vec3 edgeCol = mix(uColorHot, uColorEdge, 0.85);
      col = mix(col, edgeCol, edgeGlow * 0.8);
      col *= (0.85 + 0.35 * density);

      vec3 rgb = col * uIntensity;
      rgb = min(rgb, vec3(1.5));
      gl_FragColor = vec4(rgb, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const SMOKE_VERTEX_SHADER = `
  #include <common>
  #include <fog_pars_vertex>

  attribute vec4 iPosSize;
  attribute vec4 iVelRot;
  attribute vec4 iMisc0;
  attribute vec2 iMisc1;

  uniform float uTime;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vGlow;
  varying float vHeat;
  varying float vKind;
  varying float vRand;

  void main() {
    vec3 iPos = iPosSize.xyz;
    float iSize = iPosSize.w;
    float iRot = iVelRot.w;
    float iStretch = iMisc0.x;
    float iAlpha = iMisc0.y;
    float iGlow = iMisc0.z;
    float iHeat = iMisc0.w;
    float iKind = iMisc1.x;
    float iRand = iMisc1.y;

    vec2 corner = position.xy;
    float cs = cos(iRot);
    float sn = sin(iRot);
    vec2 uvRot = vec2(corner.x * cs - corner.y * sn, corner.x * sn + corner.y * cs);

    vec3 center = (modelMatrix * vec4(iPos, 1.0)).xyz;
    vec3 toCam = cameraPosition - center;
    vec3 toCamXZ = vec3(toCam.x, 0.0, toCam.z);
    float len2 = dot(toCamXZ, toCamXZ);
    if (len2 < 1e-6) {
      toCamXZ = vec3(0.0, 0.0, 1.0);
    } else {
      toCamXZ *= inversesqrt(len2);
    }

    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(up, toCamXZ));
    float stretch = max(1.0, iStretch);
    float widthScale = mix(0.4, 0.75, iKind);
    vec3 offset = right * (uvRot.x * iSize * widthScale) + up * (uvRot.y * iSize * stretch);
    vec3 worldPos = center + offset;

    vUv = uvRot;
    vAlpha = iAlpha;
    vGlow = iGlow;
    vHeat = iHeat;
    vKind = iKind;
    vRand = iRand + uTime * 0.0001;

    vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SMOKE_COMBINED_FRAGMENT_SHADER = `
  #include <common>
  #include <fog_pars_fragment>
  #include <tonemapping_pars_fragment>

  uniform float uTime;
  uniform float uIntensity;
  uniform float uGlowIntensity;
  uniform vec3 uColorHot;
  uniform vec3 uColorMid;
  uniform vec3 uColorCool;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vGlow;
  varying float vHeat;
  varying float vKind;
  varying float vRand;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    for (int i = 0; i < 5; i++) {
      v += a * noise21(p);
      p *= 2.17;
      a *= 0.55;
    }
    return v;
  }

  void main() {
    if (vAlpha < 0.003) discard;

    vec2 uv = vUv;
    float r = length(uv);
    float softCircle = 1.0 - smoothstep(0.95, 1.25, r);

    float core = exp(-r * r * 1.9);
    float halo = exp(-r * r * 0.75);
    float baseShape = (core * 0.75 + halo * 0.55) * softCircle;
    if (baseShape * vAlpha < 0.003) discard;

    vec2 p = uv * (2.1 + vKind * 0.55);
    vec2 w = vec2(
      fbm(p * 1.1 + vec2(vRand * 9.0, uTime * 0.06)),
      fbm(p * 1.1 + vec2(14.2 + vRand * 6.0, -uTime * 0.052))
    );
    p += (w - 0.5) * 0.78;

    float n1 = fbm(p * 2.4 + vec2(uTime * 0.05, uTime * 0.04) + vRand * 3.7);
    float n2 = fbm(p * 5.6 - vec2(uTime * 0.11, uTime * 0.08) + vRand * 9.1);
    float billow = smoothstep(0.18, 0.7, n1 * 0.8 + n2 * 0.35);
    billow = pow(billow, 1.35);

    float edgeEat = smoothstep(0.35, 1.0, billow) * (1.0 - smoothstep(0.62, 1.18, r));
    edgeEat = pow(edgeEat, 1.25);

    float shapeBody = baseShape * (0.45 + 0.85 * billow) * edgeEat;
    float shapeGlow = baseShape * (0.55 + 0.65 * billow) * edgeEat;

    float randBias = 0.75 + 0.5 * fract(sin(vRand * 37.2) * 43758.5453);
    float alphaBody = shapeBody * vAlpha;
    alphaBody *= mix(0.45, 1.05, billow);
    alphaBody *= randBias;
    alphaBody *= mix(0.5, 1.0, vHeat);

    float glow = clamp(vGlow, 0.0, 1.0);
    float alphaGlow = shapeGlow * vAlpha * glow * 0.9;
    alphaGlow *= mix(0.5, 1.25, billow);

    alphaBody = alphaBody >= 0.008 ? alphaBody : 0.0;
    alphaGlow = alphaGlow >= 0.008 ? alphaGlow : 0.0;
    if (alphaBody <= 0.0 && alphaGlow <= 0.0) discard;

    #ifdef USE_FOG
      float fogFactor = 0.0;
      #ifdef FOG_EXP2
        fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      fogFactor = clamp(fogFactor, 0.0, 1.0);
    #endif

    vec3 bodyOut = vec3(0.0);
    if (alphaBody > 0.0) {
      float heat = clamp(vHeat, 0.0, 1.0);
      vec3 col = mix(uColorCool, uColorMid, smoothstep(0.0, 0.5, heat));
      col = mix(col, uColorHot, smoothstep(0.2, 0.8, heat));
      col *= (0.9 + 0.75 * shapeBody);

      float flicker = 0.92 + 0.08 * sin(uTime * (0.55 + vRand * 0.7) + vRand * 9.0);
      float intensity = uIntensity * flicker * (0.95 + 0.6 * vKind);

      vec3 rgbBodyLinear = col * intensity * alphaBody;
      rgbBodyLinear = min(rgbBodyLinear, vec3(1.15));
      bodyOut = rgbBodyLinear;
      #ifdef TONE_MAPPING
        bodyOut = toneMapping(bodyOut);
      #endif
      bodyOut = linearToOutputTexel(vec4(bodyOut, 1.0)).rgb;
      #ifdef USE_FOG
        bodyOut = mix(bodyOut, fogColor, fogFactor);
      #endif
    }

    vec3 glowOut = vec3(0.0);
    if (alphaGlow > 0.0) {
      vec3 rgbGlowLinear = uColorHot * uGlowIntensity * glow;
      rgbGlowLinear *= (1.0 + 0.6 * billow);
      float maxRGB = mix(1.3, 2.8, glow);
      rgbGlowLinear = min(rgbGlowLinear, vec3(maxRGB));
      glowOut = rgbGlowLinear;
      #ifdef TONE_MAPPING
        glowOut = toneMapping(glowOut);
      #endif
      glowOut = linearToOutputTexel(vec4(glowOut, 1.0)).rgb;
      #ifdef USE_FOG
        glowOut = mix(glowOut, fogColor, fogFactor);
      #endif
    }

    vec3 outRgb = bodyOut + glowOut * alphaGlow;
    gl_FragColor = vec4(outRgb, alphaBody);
  }
`;

const COLOR_HOT = new THREE.Vector3(1.9, 1.05, 1.6);
const COLOR_MID = new THREE.Vector3(1.3, 0.85, 1.3);
const COLOR_COOL = new THREE.Vector3(0.85, 0.75, 1.15);
const COLOR_EDGE_GOLD = new THREE.Vector3(2.1, 1.6, 0.75);

  function createFogDiscMaterial(params: {
    radius: number;
    intensity: number;
    alpha: number;
    edgeGlow: number;
    edgeColor: THREE.Vector3;
  }): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
        uRadius: { value: params.radius },
        uIntensity: { value: params.intensity },
        uEdgeGlow: { value: params.edgeGlow },
        uAlpha: { value: params.alpha },
        uColorHot: { value: COLOR_HOT.clone() },
        uColorEdge: { value: params.edgeColor.clone() },
        uColorMid: { value: COLOR_MID.clone() },
        uColorCool: { value: COLOR_COOL.clone() },
    },
  ]);

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: DISC_VERTEX_SHADER,
    fragmentShader: DISC_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    toneMapped: false,
    fog: true,
  });
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = THREE.OneFactor;
    material.blendDst = THREE.OneMinusSrcAlphaFactor;
    material.blendSrcAlpha = THREE.OneFactor;
    material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  return material;
}

function createDiscMesh(params: {
  radius: number;
  innerRadius: number;
  segments: number;
  y: number;
  renderOrder: number;
  material: THREE.ShaderMaterial;
  name: string;
}): THREE.Mesh {
  const geometry = params.innerRadius > 0
    ? new THREE.RingGeometry(params.innerRadius, params.radius, params.segments)
    : new THREE.CircleGeometry(params.radius, params.segments);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, params.material);
  mesh.position.y = params.y;
  mesh.renderOrder = params.renderOrder;
  mesh.name = params.name;
  mesh.frustumCulled = false;
  return mesh;
}

function createDynamicInstancedAttribute(
  array: Float32Array,
  itemSize: number
): THREE.InstancedBufferAttribute {
  const attribute = new THREE.InstancedBufferAttribute(array, itemSize);
  attribute.setUsage(THREE.DynamicDrawUsage);
  return attribute;
}

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function markAttributeUpdate(attribute: THREE.InstancedBufferAttribute, count: number): void {
  if (!attribute.updateRange) {
    attribute.updateRange = { offset: 0, count: 0 };
  }
  attribute.updateRange.offset = 0;
  attribute.updateRange.count = count * attribute.itemSize;
  attribute.needsUpdate = true;
}

function createSmokeParticles(internal: FootprintLavaSmokeFxInternal): FootprintLavaSmokeRender['smoke'] {
  const max = internal.pool.max;
  const base = new THREE.PlaneGeometry(2, 2, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(base.getIndex());
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('uv', base.getAttribute('uv'));
  geometry.instanceCount = 0;

  const arrays = {
    posSize: new Float32Array(max * 4),
    velRot: new Float32Array(max * 4),
    misc0: new Float32Array(max * 4),
    misc1: new Float32Array(max * 2),
  };

  const iPosSize = createDynamicInstancedAttribute(arrays.posSize, 4);
  const iVelRot = createDynamicInstancedAttribute(arrays.velRot, 4);
  const iMisc0 = createDynamicInstancedAttribute(arrays.misc0, 4);
  const iMisc1 = createDynamicInstancedAttribute(arrays.misc1, 2);

  geometry.setAttribute('iPosSize', iPosSize);
  geometry.setAttribute('iVelRot', iVelRot);
  geometry.setAttribute('iMisc0', iMisc0);
  geometry.setAttribute('iMisc1', iMisc1);

  const sort: SmokeSortState = {
    bins: new Uint32Array(SORT_BIN_COUNT),
    offsets: new Uint32Array(SORT_BIN_COUNT + 1),
    keys: new Float32Array(max),
    indices: new Int32Array(max),
    range: new Float32Array(2),
  };

  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uIntensity: { value: 0.42 },
        uColorHot: { value: COLOR_HOT.clone() },
        uColorMid: { value: COLOR_MID.clone() },
        uColorCool: { value: COLOR_COOL.clone() },
        uGlowIntensity: { value: 2.0 },
      },
    ]),
    vertexShader: SMOKE_VERTEX_SHADER,
    fragmentShader: SMOKE_COMBINED_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    toneMapped: false,
    fog: true,
  });
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = THREE.OneFactor;
  material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'footprintLavaSmokeParticles';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;

  base.dispose();

  return {
    mesh,
    material,
    geometry,
    attributes: { iPosSize, iVelRot, iMisc0, iMisc1 },
    arrays,
    sort,
  };
}

export function createFootprintLavaSmokeRender(
  internal: FootprintLavaSmokeFxInternal
): FootprintLavaSmokeRender {
  const group = new THREE.Group();
  group.name = 'footprintLavaSmokeRender';
  group.userData.debugSelectable = false;
  group.userData.debugTag = {
    kind: 'hallFootprint',
    sourceFile: 'src/render/footprintLavaSmokeRender.ts',
    sourceFunction: 'createFootprintLavaSmokeRender',
  } satisfies DebugTag;

  const segments = Math.max(128, Math.floor(internal.columns) * 4);
  const minRadius = internal.blockSize * 0.05;
  const disc0Outer = Math.max(minRadius, internal.radialMinR - internal.blockDepth * 0.05);
  const disc0Inner = Math.max(0, disc0Outer - internal.blockDepth * 0.35);
  const disc1Outer = Math.max(minRadius, disc0Outer - internal.blockDepth * 0.08);
  const disc1Inner = Math.max(0, disc1Outer - internal.blockDepth * 0.3);
  const disc0Y = internal.ringATopY + internal.blockSize * 0.012;
  const disc1Y = internal.ringATopY + internal.blockSize * 0.18;

    const disc0Material = createFogDiscMaterial({
      radius: disc0Outer,
      intensity: 1.0,
      alpha: 0.008,
      edgeGlow: 1.0,
      edgeColor: COLOR_EDGE_GOLD,
    });
    const disc1Material = createFogDiscMaterial({
      radius: disc1Outer,
      intensity: 0.6,
      alpha: 0.003,
      edgeGlow: 1.0,
      edgeColor: COLOR_EDGE_GOLD,
    });

  const disc0 = createDiscMesh({
    radius: disc0Outer,
    innerRadius: disc0Inner,
    segments,
    y: disc0Y,
    renderOrder: 900,
    material: disc0Material,
    name: 'footprintSmokeDiscInner',
  });
  const disc1 = createDiscMesh({
    radius: disc1Outer,
    innerRadius: disc1Inner,
    segments,
    y: disc1Y,
    renderOrder: 910,
    material: disc1Material,
    name: 'footprintSmokeDiscOuter',
  });

  const smoke = createSmokeParticles(internal);
  group.userData.smokeRadial = {
    minR: 0,
    maxR: 0,
    targetR: internal.R0,
    minAllowed: internal.R0 - internal.grooveHalfW,
    maxAllowed: internal.R0 + internal.grooveHalfW,
  };

  group.add(disc0, disc1, smoke.mesh);

  const tuning = {
    smokeBodyIntensity: 0.5,
    smokeGlowIntensity: 2.2,
    disc0Alpha: 0.003,
    disc1Alpha: 0.001,
    smokeColorHotScale: 1.95,
  };

  const dispose = () => {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else {
        mat?.dispose();
      }
    });
  };

  return {
    group,
    discMaterials: [disc0Material, disc1Material],
    smoke,
    tuning,
    dispose,
  };
}

function copyActiveIndices(
  pool: FootprintLavaSmokeFxInternal['pool'],
  indices: Int32Array,
  count: number
): Int32Array {
  for (let i = 0; i < count; i += 1) {
    indices[i] = pool.activeIndices[i];
  }
  return indices;
}

function computeViewZRange(
  pool: FootprintLavaSmokeFxInternal['pool'],
  camera: THREE.Camera,
  keys: Float32Array,
  range: Float32Array,
  count: number
): void {
  const m = camera.matrixWorldInverse.elements;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const idx = pool.activeIndices[i];
    const z = m[2] * pool.posX[idx] + m[6] * pool.posY[idx] + m[10] * pool.posZ[idx] + m[14];
    keys[i] = z;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  range[0] = zMin;
  range[1] = zMax;
}

function sortIndicesByBins(
  pool: FootprintLavaSmokeFxInternal['pool'],
  sort: SmokeSortState,
  count: number
): Int32Array {
  const indices = sort.indices;
  const zMin = sort.range[0];
  const zMax = sort.range[1];
  const range = zMax - zMin;
  if (range < 1e-5) {
    return copyActiveIndices(pool, indices, count);
  }

  const bins = sort.bins;
  bins.fill(0);
  const keys = sort.keys;
  const scale = (SORT_BIN_COUNT - 1) / range;
  for (let i = 0; i < count; i += 1) {
    const bin = Math.min(SORT_BIN_COUNT - 1, Math.max(0, Math.floor((keys[i] - zMin) * scale)));
    keys[i] = bin;
    bins[bin] += 1;
  }

  const offsets = sort.offsets;
  offsets[0] = 0;
  for (let b = 0; b < SORT_BIN_COUNT; b += 1) {
    offsets[b + 1] = offsets[b] + bins[b];
    bins[b] = offsets[b];
  }

  for (let i = 0; i < count; i += 1) {
    const bin = keys[i] | 0;
    const pos = bins[bin]++;
    indices[pos] = pool.activeIndices[i];
  }
  return indices;
}

function sortPoolIndicesByViewZ(
  pool: FootprintLavaSmokeFxInternal['pool'],
  camera: THREE.Camera,
  sort: SmokeSortState
): Int32Array {
  const count = pool.activeCount;
  if (count <= 1) {
    return copyActiveIndices(pool, sort.indices, count);
  }
  computeViewZRange(pool, camera, sort.keys, sort.range, count);
  return sortIndicesByBins(pool, sort, count);
}

export function updateFootprintLavaSmokeRender(
  render: FootprintLavaSmokeRender,
  internal: FootprintLavaSmokeFxInternal,
  timeSec: number,
  camera: THREE.Camera,
  perf?: SmokeRenderPerf
): void {
  for (let i = 0; i < render.discMaterials.length; i += 1) {
    render.discMaterials[i].uniforms.uTime.value = timeSec;
  }
  const smokeUniforms = render.smoke.material.uniforms;
  smokeUniforms.uTime.value = timeSec;
  smokeUniforms.uIntensity.value = render.tuning.smokeBodyIntensity;
  smokeUniforms.uGlowIntensity.value = render.tuning.smokeGlowIntensity;
  render.discMaterials[0].uniforms.uAlpha.value = render.tuning.disc0Alpha;
  render.discMaterials[1].uniforms.uAlpha.value = render.tuning.disc1Alpha;
  const hotScale = render.tuning.smokeColorHotScale;
  smokeUniforms.uColorHot.value.set(
    COLOR_HOT.x * hotScale,
    COLOR_HOT.y * hotScale,
    COLOR_HOT.z * hotScale
  );

  const pool = internal.pool;
  const count = pool.activeCount;
  render.smoke.geometry.instanceCount = count;

  const attributes = render.smoke.attributes;
  if (count <= 0) {
    markAttributeUpdate(attributes.iPosSize, 0);
    markAttributeUpdate(attributes.iVelRot, 0);
    markAttributeUpdate(attributes.iMisc0, 0);
    markAttributeUpdate(attributes.iMisc1, 0);
    if (perf) {
      perf.sortMs = 0;
      perf.fillMs = 0;
      perf.uploadMs = 0;
    }
    return;
  }

  let t0 = 0;
  if (perf) t0 = nowMs();
  const sortedIndices = sortPoolIndicesByViewZ(pool, camera, render.smoke.sort);
  if (perf) perf.sortMs = nowMs() - t0;

  if (perf) t0 = nowMs();
  const posSize = render.smoke.arrays.posSize;
  const velRot = render.smoke.arrays.velRot;
  const misc0 = render.smoke.arrays.misc0;
  const misc1 = render.smoke.arrays.misc1;

  let minR = Number.POSITIVE_INFINITY;
  let maxR = 0;
  for (let i = 0; i < count; i += 1) {
    const idx = sortedIndices[i];
    const x = pool.posX[idx];
    const z = pool.posZ[idx];
    const r = Math.sqrt(x * x + z * z);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    const posBase = i * 4;
    posSize[posBase + 0] = x;
    posSize[posBase + 1] = pool.posY[idx];
    posSize[posBase + 2] = z;
    posSize[posBase + 3] = pool.size[idx];
    const velBase = i * 4;
    velRot[velBase + 0] = pool.velX[idx];
    velRot[velBase + 1] = pool.velY[idx];
    velRot[velBase + 2] = pool.velZ[idx];
    velRot[velBase + 3] = pool.rot[idx];
    const miscBase = i * 4;
    misc0[miscBase + 0] = pool.stretch[idx];
    misc0[miscBase + 1] = pool.alpha[idx];
    misc0[miscBase + 2] = pool.glow[idx];
    misc0[miscBase + 3] = pool.heat[idx];
    const misc1Base = i * 2;
    misc1[misc1Base + 0] = pool.kind[idx];
    misc1[misc1Base + 1] = pool.rand[idx];
  }
  if (perf) perf.fillMs = nowMs() - t0;

  const smokeRadial = render.group.userData.smokeRadial as
    | {
        minR: number;
        maxR: number;
        targetR: number;
        minAllowed: number;
        maxAllowed: number;
      }
    | undefined;
  if (smokeRadial) {
    smokeRadial.minR = minR;
    smokeRadial.maxR = maxR;
  } else {
    render.group.userData.smokeRadial = {
      minR,
      maxR,
      targetR: internal.R0,
      minAllowed: internal.R0 - internal.grooveHalfW,
      maxAllowed: internal.R0 + internal.grooveHalfW,
    };
  }

  if (perf) t0 = nowMs();
  markAttributeUpdate(attributes.iPosSize, count);
  markAttributeUpdate(attributes.iVelRot, count);
  markAttributeUpdate(attributes.iMisc0, count);
  markAttributeUpdate(attributes.iMisc1, count);
  if (perf) perf.uploadMs = nowMs() - t0;
}
