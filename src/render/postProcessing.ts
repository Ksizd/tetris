import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { PostProcessingConfig } from './renderConfig';

export interface PostProcessingContext {
  composer: EffectComposer;
  renderPass: RenderPass;
  bloom?: UnrealBloomPass;
  colorGrade?: ShaderPass;
  ssao?: SSAOPass;
  dof?: BokehPass;
}

export function createPostProcessingContext(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  config: PostProcessingConfig
): PostProcessingContext | null {
  if (!shouldUseComposer(config)) {
    return null;
  }

  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.setSize(size.x, size.y);
  composer.setPixelRatio(renderer.getPixelRatio());

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  let ssao: SSAOPass | undefined;
  if (config.ssao.enabled) {
    ssao = new SSAOPass(scene, camera, size.x, size.y);
    ssao.kernelRadius = config.ssao.kernelRadius;
    ssao.minDistance = config.ssao.minDistance;
    ssao.maxDistance = config.ssao.maxDistance;
    ssao.bias = config.ssao.bias;
    ssao.output = SSAOPass.OUTPUT.Default;
    ssao.blendEquation = THREE.AddEquation;
    ssao.blendDstAlpha = 1;
    ssao.blendDst = THREE.OneMinusSrcAlphaFactor;
    ssao.blendSrc = THREE.SrcAlphaFactor;
    ssao.blendSrcAlpha = 1;
    ssao.blendColor = new THREE.Color(0, 0, 0);
    composer.addPass(ssao);
  }

  let bloom: UnrealBloomPass | undefined;
  if (config.bloom.enabled) {
    bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      config.bloom.strength,
      config.bloom.radius,
      config.bloom.threshold
    );
    bloom.renderToScreen = false;
    composer.addPass(bloom);
  }

  let dof: BokehPass | undefined;
  if (config.depthOfField.enabled) {
    dof = new BokehPass(scene, camera, {
      focus: config.depthOfField.focus,
      aperture: config.depthOfField.aperture,
      maxblur: config.depthOfField.maxBlur,
      width: size.x,
      height: size.y,
    });
    composer.addPass(dof);
  }

  const colorGradePass = createCinematicColorPass(config);
  if (colorGradePass) {
    composer.addPass(colorGradePass);
  }

  // Ensure last pass outputs to screen.
  const chain = [colorGradePass, dof, bloom, ssao, renderPass].filter(
    (pass): pass is RenderPass | ShaderPass | UnrealBloomPass | SSAOPass | BokehPass =>
      Boolean(pass)
  );
  if (chain.length > 0) {
    chain[0].renderToScreen = true;
  }

  return { composer, renderPass, bloom, colorGrade: colorGradePass ?? undefined, ssao, dof };
}

export function resizePostProcessing(
  ctx: PostProcessingContext | null | undefined,
  width: number,
  height: number
): void {
  if (!ctx) {
    return;
  }
  ctx.composer.setSize(width, height);
  ctx.bloom?.setSize(width, height);
  if (ctx.ssao) {
    ctx.ssao.setSize(width, height);
  }
}

function shouldUseComposer(config: PostProcessingConfig): boolean {
  return (
    config.bloom.enabled ||
    config.vignette.enabled ||
    config.colorGrade.enabled ||
    config.depthOfField.enabled ||
    config.ssao.enabled
  );
}

function createCinematicColorPass(config: PostProcessingConfig): ShaderPass | null {
  const gradeEnabled = config.colorGrade.enabled;
  const vignetteEnabled = config.vignette.enabled;
  if (!gradeEnabled && !vignetteEnabled) {
    return null;
  }

  const shader: THREE.Shader = {
    uniforms: {
      tDiffuse: { value: null },
      saturation: { value: config.colorGrade.saturation },
      contrast: { value: config.colorGrade.contrast },
      lift: { value: config.colorGrade.lift },
      gamma: { value: config.colorGrade.gamma },
      gain: { value: config.colorGrade.gain },
      warmShift: { value: config.colorGrade.warmShift },
      coolShift: { value: config.colorGrade.coolShift },
      vignetteOffset: { value: config.vignette.offset },
      vignetteDarkness: { value: config.vignette.darkness },
      gradeEnabled: { value: gradeEnabled ? 1 : 0 },
      vignetteEnabled: { value: vignetteEnabled ? 1 : 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float saturation;
      uniform float contrast;
      uniform float lift;
      uniform float gamma;
      uniform float gain;
      uniform float warmShift;
      uniform float coolShift;
      uniform float vignetteOffset;
      uniform float vignetteDarkness;
      uniform float gradeEnabled;
      uniform float vignetteEnabled;
      varying vec2 vUv;

      vec3 applySaturation(vec3 color, float sat) {
        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        return mix(vec3(luma), color, sat);
      }

      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        vec3 color = base.rgb;

        if (gradeEnabled > 0.5) {
          color = applySaturation(color, saturation);
          color = (color - 0.5) * contrast + 0.5;
          color = max(vec3(0.0), color + lift);
          color = pow(color, vec3(max(0.0001, gamma)));
          color *= gain;
          color += warmShift * vec3(0.06, 0.03, -0.02);
          color += coolShift * vec3(-0.02, 0.0, 0.06);
        }

        if (vignetteEnabled > 0.5) {
          vec2 centered = vUv - 0.5;
          float dist = length(centered) * 1.4142;
          float vignette = smoothstep(vignetteOffset, 1.08, dist);
          color *= mix(1.0, 1.0 - vignetteDarkness, vignette);
        }

        color = clamp(color, 0.0, 5.0);
        gl_FragColor = vec4(color, base.a);
      }
    `,
  };

  return new ShaderPass(shader);
}
