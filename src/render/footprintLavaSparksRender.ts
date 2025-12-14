import * as THREE from 'three';
import type { FootprintLavaSparksFxInternal } from './footprintLavaSparksFx';

export interface FootprintLavaSparksRender {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  geometry: THREE.InstancedBufferGeometry;
  attributes: {
    iPos: THREE.InstancedBufferAttribute;
    iVel: THREE.InstancedBufferAttribute;
    iSize: THREE.InstancedBufferAttribute;
    iRot: THREE.InstancedBufferAttribute;
    iStretch: THREE.InstancedBufferAttribute;
    iTemp: THREE.InstancedBufferAttribute;
    iAlpha: THREE.InstancedBufferAttribute;
    iKind: THREE.InstancedBufferAttribute;
    iRand: THREE.InstancedBufferAttribute;
  };
  arrays: {
    pos: Float32Array;
    vel: Float32Array;
    size: Float32Array;
    rot: Float32Array;
    stretch: Float32Array;
    temp: Float32Array;
    alpha: Float32Array;
    kind: Float32Array;
    rand: Float32Array;
  };
  dispose: () => void;
}

const VERTEX_SHADER = `
  #include <common>

  attribute vec3 iPos;
  attribute vec3 iVel;
  attribute float iSize;
  attribute float iRot;
  attribute float iStretch;
  attribute float iTemp;
  attribute float iAlpha;
  attribute float iKind;
  attribute float iRand;

  uniform float uTime;
  uniform float uSizeScale;

  varying vec2 vUv;
  varying float vTemp;
  varying float vAlpha;
  varying float vStretch;
  varying float vKind;
  varying float vRand;

  void main() {
    vec2 corner = position.xy;
    float cs = cos(iRot);
    float sn = sin(iRot);
    vec2 uvRot = vec2(corner.x * cs - corner.y * sn, corner.x * sn + corner.y * cs);

    vec4 mvCenter = modelViewMatrix * vec4(iPos, 1.0);
    vec3 velView = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
    float speed = length(velView);
    vec2 dir2 = speed > 1e-4 ? normalize(velView.xy) : vec2(0.0, 1.0);
    vec2 perp2 = vec2(-dir2.y, dir2.x);
    float stretch = max(1.0, iStretch);
    vec2 aligned = perp2 * uvRot.x + dir2 * (uvRot.y * stretch);

    float kindSize = mix(0.9, 1.25, iKind);
    float size = iSize * uSizeScale * kindSize;
    mvCenter.xy += aligned * size;

    vUv = uvRot;
    vTemp = iTemp;
    vAlpha = iAlpha;
    vStretch = stretch;
    vKind = iKind;
    vRand = iRand + uTime * 0.0001;

    gl_Position = projectionMatrix * mvCenter;
  }
`;

const FRAGMENT_SHADER = `
  #include <common>

  uniform float uTime;
  uniform float uIntensity;

  varying vec2 vUv;
  varying float vTemp;
  varying float vAlpha;
  varying float vStretch;
  varying float vKind;
  varying float vRand;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  vec3 lutColor(float t) {
    vec3 c0 = vec3(0.18, 0.01, 0.04);
    vec3 c1 = vec3(0.82, 0.10, 0.07);
    vec3 c2 = vec3(1.05, 0.34, 0.16);
    vec3 c3 = vec3(1.15, 0.52, 0.92);
    vec3 c4 = vec3(1.60, 0.96, 1.35);
    if (t < 0.35) return mix(c0, c1, t / 0.35);
    if (t < 0.60) return mix(c1, c2, (t - 0.35) / 0.25);
    if (t < 0.85) return mix(c2, c3, (t - 0.60) / 0.25);
    return mix(c3, c4, (t - 0.85) / 0.15);
  }

  void main() {
    vec2 uv = vUv;
    float r = length(uv);
    float circle = 1.0 - smoothstep(0.88, 1.05, r);

    float core = exp(-r * r * 12.0);
    float halo = exp(-r * r * 2.4);

    float axial = abs(uv.y) / max(1.0, vStretch);
    float lateral = abs(uv.x);
    float streak = exp(-lateral * lateral * 16.0) * exp(-axial * axial * 2.0);
    streak = pow(streak, 0.85);

    float shape = core * 1.15 + halo * 0.35 + streak * mix(0.22, 0.55, vKind);
    shape *= circle;

    float n = hash21(uv * 7.5 + vec2(vRand, vRand * 1.7) + uTime * 0.12);
    shape *= 0.86 + 0.28 * n;

    float flicker = 0.88 + 0.22 * sin(uTime * (3.1 + vRand * 6.2) + vRand * 12.0);
    float tempN = clamp(vTemp / 1.35, 0.0, 1.0);
    float intensity = pow(tempN, 2.2) * uIntensity * flicker;
    intensity *= mix(0.85, 1.2, vKind);

    vec3 col = lutColor(tempN);
    float alpha = shape * vAlpha;

    if (alpha < 0.003) discard;

    gl_FragColor = vec4(col * intensity * alpha, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createDynamicInstancedAttribute(array: Float32Array, itemSize: number): THREE.InstancedBufferAttribute {
  const attribute = new THREE.InstancedBufferAttribute(array, itemSize);
  attribute.setUsage(THREE.DynamicDrawUsage);
  return attribute;
}

export function createFootprintLavaSparksRender(internal: FootprintLavaSparksFxInternal): FootprintLavaSparksRender {
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
    temp: new Float32Array(max),
    alpha: new Float32Array(max),
    kind: new Float32Array(max),
    rand: new Float32Array(max),
  };

  const iPos = createDynamicInstancedAttribute(arrays.pos, 3);
  const iVel = createDynamicInstancedAttribute(arrays.vel, 3);
  const iSize = createDynamicInstancedAttribute(arrays.size, 1);
  const iRot = createDynamicInstancedAttribute(arrays.rot, 1);
  const iStretch = createDynamicInstancedAttribute(arrays.stretch, 1);
  const iTemp = createDynamicInstancedAttribute(arrays.temp, 1);
  const iAlpha = createDynamicInstancedAttribute(arrays.alpha, 1);
  const iKind = createDynamicInstancedAttribute(arrays.kind, 1);
  const iRand = createDynamicInstancedAttribute(arrays.rand, 1);

  geometry.setAttribute('iPos', iPos);
  geometry.setAttribute('iVel', iVel);
  geometry.setAttribute('iSize', iSize);
  geometry.setAttribute('iRot', iRot);
  geometry.setAttribute('iStretch', iStretch);
  geometry.setAttribute('iTemp', iTemp);
  geometry.setAttribute('iAlpha', iAlpha);
  geometry.setAttribute('iKind', iKind);
  geometry.setAttribute('iRand', iRand);

  const sizeScale =
    internal.quality === 'low'
      ? internal.blockSize * 0.03
      : internal.quality === 'medium'
        ? internal.blockSize * 0.032
        : internal.blockSize * 0.035;

  const intensity = internal.quality === 'low' ? 0.95 : internal.quality === 'medium' ? 1.15 : 1.3;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSizeScale: { value: sizeScale },
      uIntensity: { value: intensity },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'footprintLavaSparks';
  mesh.frustumCulled = false;

  const dispose = () => {
    geometry.dispose();
    material.dispose();
    base.dispose();
  };

  return {
    mesh,
    material,
    geometry,
    attributes: { iPos, iVel, iSize, iRot, iStretch, iTemp, iAlpha, iKind, iRand },
    arrays,
    dispose,
  };
}

export function updateFootprintLavaSparksRender(
  render: FootprintLavaSparksRender,
  internal: FootprintLavaSparksFxInternal,
  timeSec: number
): void {
  const pool = internal.pool;
  const count = pool.activeCount;

  render.geometry.instanceCount = count;
  render.material.uniforms.uTime.value = timeSec;

  if (count <= 0) {
    render.attributes.iPos.needsUpdate = true;
    render.attributes.iVel.needsUpdate = true;
    render.attributes.iSize.needsUpdate = true;
    render.attributes.iRot.needsUpdate = true;
    render.attributes.iStretch.needsUpdate = true;
    render.attributes.iTemp.needsUpdate = true;
    render.attributes.iAlpha.needsUpdate = true;
    render.attributes.iKind.needsUpdate = true;
    render.attributes.iRand.needsUpdate = true;
    return;
  }

  const pos = render.arrays.pos;
  const vel = render.arrays.vel;
  const size = render.arrays.size;
  const rot = render.arrays.rot;
  const stretch = render.arrays.stretch;
  const temp = render.arrays.temp;
  const alpha = render.arrays.alpha;
  const kind = render.arrays.kind;
  const rand = render.arrays.rand;

  for (let i = 0; i < count; i += 1) {
    const idx = pool.activeIndices[i];

    pos[i * 3 + 0] = pool.posX[idx];
    pos[i * 3 + 1] = pool.posY[idx];
    pos[i * 3 + 2] = pool.posZ[idx];

    vel[i * 3 + 0] = pool.velX[idx];
    vel[i * 3 + 1] = pool.velY[idx];
    vel[i * 3 + 2] = pool.velZ[idx];

    size[i] = pool.size[idx];
    rot[i] = pool.rot[idx];
    stretch[i] = pool.stretch[idx];
    temp[i] = pool.temp[idx];
    alpha[i] = pool.alpha[idx];
    kind[i] = pool.kind[idx];
    rand[i] = pool.rand[idx];
  }

  render.attributes.iPos.needsUpdate = true;
  render.attributes.iVel.needsUpdate = true;
  render.attributes.iSize.needsUpdate = true;
  render.attributes.iRot.needsUpdate = true;
  render.attributes.iStretch.needsUpdate = true;
  render.attributes.iTemp.needsUpdate = true;
  render.attributes.iAlpha.needsUpdate = true;
  render.attributes.iKind.needsUpdate = true;
  render.attributes.iRand.needsUpdate = true;
}
