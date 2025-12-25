import * as THREE from 'three';
import type { DebugTag } from './debug/objectInspectorTypes';
import type { FootprintLavaSmokeFxInternal } from './footprintLavaSmokeFx';

export interface FootprintLavaSmokeRender {
  group: THREE.Group;
  discMaterials: THREE.ShaderMaterial[];
  smoke: {
    mesh: THREE.Mesh;
    glowMesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    glowMaterial: THREE.ShaderMaterial;
    geometry: THREE.InstancedBufferGeometry;
    attributes: {
      iPos: THREE.InstancedBufferAttribute;
      iVel: THREE.InstancedBufferAttribute;
      iSize: THREE.InstancedBufferAttribute;
      iRot: THREE.InstancedBufferAttribute;
      iStretch: THREE.InstancedBufferAttribute;
      iAlpha: THREE.InstancedBufferAttribute;
      iGlow: THREE.InstancedBufferAttribute;
      iHeat: THREE.InstancedBufferAttribute;
      iKind: THREE.InstancedBufferAttribute;
      iRand: THREE.InstancedBufferAttribute;
    };
    arrays: {
      pos: Float32Array;
      vel: Float32Array;
      size: Float32Array;
      rot: Float32Array;
      stretch: Float32Array;
      alpha: Float32Array;
      glow: Float32Array;
      heat: Float32Array;
      kind: Float32Array;
      rand: Float32Array;
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

  attribute vec3 iPos;
  attribute vec3 iVel;
  attribute float iSize;
  attribute float iRot;
  attribute float iStretch;
  attribute float iAlpha;
  attribute float iGlow;
  attribute float iHeat;
  attribute float iKind;
  attribute float iRand;

  uniform float uTime;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vGlow;
  varying float vHeat;
  varying float vKind;
  varying float vRand;

  void main() {
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

const SMOKE_FRAGMENT_SHADER = `
  #include <common>
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform float uIntensity;
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
    vec2 uv = vUv;
    float r = length(uv);
    float softCircle = 1.0 - smoothstep(0.95, 1.25, r);

    float core = exp(-r * r * 1.9);
    float halo = exp(-r * r * 0.75);
    float shape = core * 0.75 + halo * 0.55;
    shape *= softCircle;

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

    shape *= (0.45 + 0.85 * billow);
    float edgeEat = smoothstep(0.35, 1.0, billow) * (1.0 - smoothstep(0.62, 1.18, r));
    edgeEat = pow(edgeEat, 1.25);
    shape *= edgeEat;

    float randBias = 0.75 + 0.5 * fract(sin(vRand * 37.2) * 43758.5453);
    float alpha = shape * vAlpha;
    alpha *= mix(0.45, 1.05, billow);
    alpha *= randBias;
    alpha *= mix(0.5, 1.0, vHeat);
    if (alpha < 0.008) discard;

    float heat = clamp(vHeat, 0.0, 1.0);
    vec3 col = mix(uColorCool, uColorMid, smoothstep(0.0, 0.5, heat));
    col = mix(col, uColorHot, smoothstep(0.2, 0.8, heat));
    col *= (0.9 + 0.75 * shape);

    float flicker = 0.92 + 0.08 * sin(uTime * (0.55 + vRand * 0.7) + vRand * 9.0);
    float intensity = uIntensity * flicker * (0.95 + 0.6 * vKind);

    vec3 rgb = col * intensity * alpha;
    rgb = min(rgb, vec3(1.15));
    gl_FragColor = vec4(rgb, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const SMOKE_GLOW_FRAGMENT_SHADER = `
  #include <common>
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorHot;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vGlow;
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
    vec2 uv = vUv;
    float r = length(uv);
    float softCircle = 1.0 - smoothstep(0.95, 1.25, r);

    float core = exp(-r * r * 1.9);
    float halo = exp(-r * r * 0.75);
    float shape = core * 0.75 + halo * 0.55;
    shape *= softCircle;

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

    shape *= (0.55 + 0.65 * billow);
    float edgeEat = smoothstep(0.35, 1.0, billow) * (1.0 - smoothstep(0.62, 1.18, r));
    edgeEat = pow(edgeEat, 1.25);
    shape *= edgeEat;

    float glow = clamp(vGlow, 0.0, 1.0);
      float alpha = shape * vAlpha * glow * 0.9;
    alpha *= mix(0.5, 1.25, billow);
    if (alpha < 0.008) discard;

    vec3 rgb = uColorHot * uIntensity * glow;
    rgb *= (1.0 + 0.6 * billow);
    float maxRGB = mix(1.3, 2.8, glow);
    rgb = min(rgb, vec3(maxRGB));
    gl_FragColor = vec4(rgb, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
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

function createSmokeParticles(internal: FootprintLavaSmokeFxInternal): FootprintLavaSmokeRender['smoke'] {
  const max = internal.pool.max;
  const base = new THREE.PlaneGeometry(2, 2, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(base.getIndex());
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('uv', base.getAttribute('uv'));
  geometry.instanceCount = 0;

  const arrays = {
    pos: new Float32Array(max * 3),
    vel: new Float32Array(max * 3),
    size: new Float32Array(max),
    rot: new Float32Array(max),
    stretch: new Float32Array(max),
    alpha: new Float32Array(max),
    glow: new Float32Array(max),
    heat: new Float32Array(max),
    kind: new Float32Array(max),
    rand: new Float32Array(max),
  };

  const iPos = createDynamicInstancedAttribute(arrays.pos, 3);
  const iVel = createDynamicInstancedAttribute(arrays.vel, 3);
  const iSize = createDynamicInstancedAttribute(arrays.size, 1);
  const iRot = createDynamicInstancedAttribute(arrays.rot, 1);
  const iStretch = createDynamicInstancedAttribute(arrays.stretch, 1);
  const iAlpha = createDynamicInstancedAttribute(arrays.alpha, 1);
  const iGlow = createDynamicInstancedAttribute(arrays.glow, 1);
  const iHeat = createDynamicInstancedAttribute(arrays.heat, 1);
  const iKind = createDynamicInstancedAttribute(arrays.kind, 1);
  const iRand = createDynamicInstancedAttribute(arrays.rand, 1);

  geometry.setAttribute('iPos', iPos);
  geometry.setAttribute('iVel', iVel);
  geometry.setAttribute('iSize', iSize);
  geometry.setAttribute('iRot', iRot);
  geometry.setAttribute('iStretch', iStretch);
  geometry.setAttribute('iAlpha', iAlpha);
  geometry.setAttribute('iGlow', iGlow);
  geometry.setAttribute('iHeat', iHeat);
  geometry.setAttribute('iKind', iKind);
  geometry.setAttribute('iRand', iRand);

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
      },
    ]),
    vertexShader: SMOKE_VERTEX_SHADER,
    fragmentShader: SMOKE_FRAGMENT_SHADER,
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

  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uIntensity: { value: 2.0 },
        uColorHot: { value: COLOR_HOT.clone() },
      },
    ]),
    vertexShader: SMOKE_VERTEX_SHADER,
    fragmentShader: SMOKE_GLOW_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    toneMapped: false,
    fog: true,
  });
  glowMaterial.blendEquation = THREE.AddEquation;
  glowMaterial.blendSrc = THREE.SrcAlphaFactor;
  glowMaterial.blendDst = THREE.OneFactor;
  glowMaterial.blendSrcAlpha = THREE.OneFactor;
  glowMaterial.blendDstAlpha = THREE.OneFactor;

  const glowMesh = new THREE.Mesh(geometry, glowMaterial);
  glowMesh.name = 'footprintLavaSmokeGlow';
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 1010;

  base.dispose();

  return {
    mesh,
    material,
    glowMesh,
    glowMaterial,
    geometry,
    attributes: { iPos, iVel, iSize, iRot, iStretch, iAlpha, iGlow, iHeat, iKind, iRand },
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

  group.add(disc0, disc1, smoke.mesh, smoke.glowMesh);

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
  camera: THREE.Camera
): void {
  render.discMaterials.forEach((material) => {
    material.uniforms.uTime.value = timeSec;
  });
  render.smoke.material.uniforms.uTime.value = timeSec;
  render.smoke.glowMaterial.uniforms.uTime.value = timeSec;
  render.smoke.material.uniforms.uIntensity.value = render.tuning.smokeBodyIntensity;
  render.smoke.glowMaterial.uniforms.uIntensity.value = render.tuning.smokeGlowIntensity;
  render.discMaterials[0].uniforms.uAlpha.value = render.tuning.disc0Alpha;
  render.discMaterials[1].uniforms.uAlpha.value = render.tuning.disc1Alpha;
  const hotScale = render.tuning.smokeColorHotScale;
  render.smoke.material.uniforms.uColorHot.value.set(
    COLOR_HOT.x * hotScale,
    COLOR_HOT.y * hotScale,
    COLOR_HOT.z * hotScale
  );
  render.smoke.glowMaterial.uniforms.uColorHot.value.set(
    COLOR_HOT.x * hotScale,
    COLOR_HOT.y * hotScale,
    COLOR_HOT.z * hotScale
  );

  const pool = internal.pool;
  const count = pool.activeCount;
  render.smoke.geometry.instanceCount = count;

  const attributes = render.smoke.attributes;
  if (count <= 0) {
    attributes.iPos.needsUpdate = true;
    attributes.iVel.needsUpdate = true;
    attributes.iSize.needsUpdate = true;
    attributes.iRot.needsUpdate = true;
    attributes.iStretch.needsUpdate = true;
    attributes.iAlpha.needsUpdate = true;
    attributes.iGlow.needsUpdate = true;
    attributes.iHeat.needsUpdate = true;
    attributes.iKind.needsUpdate = true;
    attributes.iRand.needsUpdate = true;
    return;
  }

  const pos = render.smoke.arrays.pos;
  const vel = render.smoke.arrays.vel;
  const size = render.smoke.arrays.size;
  const rot = render.smoke.arrays.rot;
  const stretch = render.smoke.arrays.stretch;
  const alpha = render.smoke.arrays.alpha;
  const glow = render.smoke.arrays.glow;
  const heat = render.smoke.arrays.heat;
  const kind = render.smoke.arrays.kind;
    const rand = render.smoke.arrays.rand;

    const sortedIndices = sortPoolIndicesByViewZ(pool, camera, render.smoke.sort);
    let minR = Number.POSITIVE_INFINITY;
    let maxR = 0;
    for (let i = 0; i < count; i += 1) {
      const idx = sortedIndices[i];
      const x = pool.posX[idx];
      const z = pool.posZ[idx];
      const r = Math.hypot(x, z);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      pos[i * 3 + 0] = x;
      pos[i * 3 + 1] = pool.posY[idx];
      pos[i * 3 + 2] = z;
      vel[i * 3 + 0] = pool.velX[idx];
      vel[i * 3 + 1] = pool.velY[idx];
      vel[i * 3 + 2] = pool.velZ[idx];
      size[i] = pool.size[idx];
      rot[i] = pool.rot[idx];
    stretch[i] = pool.stretch[idx];
    alpha[i] = pool.alpha[idx];
    glow[i] = pool.glow[idx];
    heat[i] = pool.heat[idx];
      kind[i] = pool.kind[idx];
      rand[i] = pool.rand[idx];
    }
    render.group.userData.smokeRadial = {
      minR,
      maxR,
      targetR: internal.R0,
      minAllowed: internal.R0 - internal.grooveHalfW,
      maxAllowed: internal.R0 + internal.grooveHalfW,
    };

  attributes.iPos.needsUpdate = true;
  attributes.iVel.needsUpdate = true;
  attributes.iSize.needsUpdate = true;
  attributes.iRot.needsUpdate = true;
  attributes.iStretch.needsUpdate = true;
  attributes.iAlpha.needsUpdate = true;
  attributes.iGlow.needsUpdate = true;
  attributes.iHeat.needsUpdate = true;
  attributes.iKind.needsUpdate = true;
  attributes.iRand.needsUpdate = true;
}
