import * as THREE from 'three';
import { computeFootprintAngleOffsetRad } from './footprintAngles';

export interface FootprintSakuraLavaMaterialParams {
  towerRadius: number;
  blockDepth: number;
  blockSize: number;
  columns: number;
  angleOffsetRad?: number;
  intensity?: number;
}

export interface FootprintSakuraLavaMaterial {
  material: THREE.ShaderMaterial;
  uniforms: {
    uTime: { value: number };
    uDebugLavaUV: { value: number };
  };
  dispose: () => void;
}

const TWO_PI = Math.PI * 2;
const MIN_COLUMNS = 3;
const MIN_ANGULAR_SEGMENTS = 96;
const ANGULAR_MULTIPLIER = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeThetaHalfWidth(columns: number, angularSegments: number): number {
  const dTheta = TWO_PI / columns;
  const microStep = TWO_PI / angularSegments;
  const baseThetaW = dTheta * 0.08;
  let steps = Math.max(2, Math.round(baseThetaW / microStep));
  if (steps % 2 === 1) {
    steps += 1;
  }
  return (steps * microStep) * 0.5;
}

const VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  #include <common>

  uniform float uTime;
  uniform float uIntensity;
  uniform float uDebugLavaUV;
  uniform float uAngleOffset;

  uniform float uR0;
  uniform float uR1;
  uniform float uGrooveHalfW;
  uniform float uThetaHalfW;
  uniform float uRadialMinR;
  uniform float uRadialMaxR;
  uniform float uColumns;

  uniform vec3 uColorBase;
  uniform vec3 uColorHot;
  uniform vec3 uColorDeep;

  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vNormal;
  const float TWO_PI = 6.283185307179586;

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
    float radius = length(xz);
    float theta = atan(xz.y, xz.x);
    float thetaAligned = theta - uAngleOffset;
    thetaAligned = mod(thetaAligned, TWO_PI);
    if (thetaAligned < 0.0) {
      thetaAligned += TWO_PI;
    }
    float thetaNorm = thetaAligned / TWO_PI;

    float sRing0 = abs(radius - uR0) - uGrooveHalfW;
    float sRing1 = abs(radius - uR1) - uGrooveHalfW;

    float dTheta = TWO_PI / max(1.0, uColumns);
    float rel = fract(thetaAligned / dTheta);
    float signedRel = rel < 0.5 ? rel : rel - 1.0;
    float angDist = abs(signedRel) * dTheta;
    float sTheta = angDist - uThetaHalfW;
    float sRadial = radius >= uRadialMinR && radius <= uRadialMaxR ? sTheta * radius : 1e9;

    float sMin = min(min(sRing0, sRing1), sRadial);
    float edgeDist = max(0.0, -sMin);

    float ringMin = min(sRing0, sRing1);
    float isRadial = step(sRadial, ringMin);
    float channelHalfW = mix(uGrooveHalfW, max(0.0001, radius * uThetaHalfW), isRadial);
    float rimWidth = channelHalfW * 0.45;
    float rim = 1.0 - smoothstep(0.0, rimWidth, edgeDist);
    rim = pow(rim, 0.7);

    float ringChoice = step(sRing1, sRing0);
    float ringCenter = mix(uR0, uR1, ringChoice);
    float ringRNorm = clamp((radius - ringCenter) / (uGrooveHalfW * 2.0) + 0.5, 0.0, 1.0);
    float radialRNorm = clamp((signedRel * dTheta) / (uThetaHalfW * 2.0) + 0.5, 0.0, 1.0);
    float rNorm = mix(ringRNorm, radialRNorm, isRadial);

    vec4 outColor = vec4(0.0);
    if (uDebugLavaUV > 0.5) {
      vec2 grid = fract(vUv * 16.0);
      float line = step(grid.x, 0.03) + step(grid.y, 0.03);
      vec3 uvCol = vec3(vUv, 0.0);
      vec3 col = mix(uvCol, vec3(1.0, 1.0, 1.0), clamp(line, 0.0, 1.0));
      outColor = vec4(col, 1.0);
    } else {
      vec2 flowUv = vec2(thetaNorm * 12.0 + uTime * 0.12, rNorm * 6.0 + radius * 0.08 - uTime * 0.04);
      float baseNoise = fbm(flowUv);
      float vort = fbm(flowUv * 2.2 + vec2(-uTime * 0.07, uTime * 0.11));
      float veins = fbm(flowUv * 3.7 + vec2(uTime * 0.22, -uTime * 0.18));

      float core = smoothstep(0.32, 0.92, baseNoise);
      float swirl = smoothstep(0.1, 0.95, vort);
      float hotMask = smoothstep(0.78, 0.985, veins);
      hotMask = pow(hotMask, 2.6);

      vec3 col = mix(uColorDeep, uColorBase, core);
      col = mix(col, uColorHot, hotMask * 0.9);
      col = mix(col, uColorHot, rim * 0.65);

      float shimmer = 0.65 + 0.35 * sin(uTime * 1.55 + baseNoise * TWO_PI);
      float glow = (0.35 + core * 0.95 + hotMask * 1.25 + swirl * 0.35) * shimmer;

      float facingUp = clamp(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
      float shade = 0.88 + 0.12 * facingUp;
      vec3 outCol = col * glow * uIntensity * shade;

      outColor = vec4(outCol, 1.0);
    }

    gl_FragColor = outColor;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createFootprintSakuraLavaMaterial(
  params: FootprintSakuraLavaMaterialParams
): FootprintSakuraLavaMaterial {
  const columns = Math.max(MIN_COLUMNS, Math.floor(params.columns));
  const towerRadius = params.towerRadius;
  const blockDepth = params.blockDepth;
  const intensity = params.intensity ?? 3.25;
  const angleOffsetRad = params.angleOffsetRad ?? computeFootprintAngleOffsetRad(columns);

  const angularSegments = Math.max(MIN_ANGULAR_SEGMENTS, columns * ANGULAR_MULTIPLIER);
  const thetaHalfW = computeThetaHalfWidth(columns, angularSegments);

  const R0 = towerRadius - blockDepth * 0.5;
  const R1 = towerRadius + blockDepth * 0.5;

  const grooveW = clamp(blockDepth * 0.08, blockDepth * 0.06, blockDepth * 0.1);
  const grooveHalfW = grooveW * 0.5;
  const radialMinR = R0 - grooveHalfW;
  const radialMaxR = R1 + grooveHalfW;

  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: intensity },
    uDebugLavaUV: { value: 0 },
    uAngleOffset: { value: angleOffsetRad },
    uR0: { value: R0 },
    uR1: { value: R1 },
    uGrooveHalfW: { value: grooveHalfW },
    uThetaHalfW: { value: thetaHalfW },
    uRadialMinR: { value: radialMinR },
    uRadialMaxR: { value: radialMaxR },
    uColumns: { value: columns },
    uColorBase: { value: new THREE.Color(1.0, 0.24, 0.68) },
    uColorHot: { value: new THREE.Color(1.6, 0.92, 1.25) },
    uColorDeep: { value: new THREE.Color(0.22, 0.02, 0.18) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const dispose = () => {
    material.dispose();
  };

  return { material, uniforms: { uTime: uniforms.uTime, uDebugLavaUV: uniforms.uDebugLavaUV }, dispose };
}
