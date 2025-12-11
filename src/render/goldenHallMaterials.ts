import * as THREE from 'three';
import { QualityLevel } from './renderConfig';
import {
  createMahjongMaterialMaps,
  createGoldenHallEmissiveRimTexture,
  createGoldenHallLightShaftAlphaMap,
  MahjongMaterialMaps,
} from './textures';

export interface GoldenHallMaterialSet {
  baseOuter: THREE.MeshStandardMaterial;
  baseInner: THREE.MeshStandardMaterial;
  baseCenter: THREE.MeshStandardMaterial;
  wallMain: THREE.MeshStandardMaterial;
  wallEmissiveRim: THREE.MeshStandardMaterial;
  pillar: THREE.MeshStandardMaterial;
  panel: THREE.MeshStandardMaterial;
  dustParticle: THREE.PointsMaterial;
  lightShaft: THREE.MeshBasicMaterial;
}

export interface GoldenHallMaterialParams {
  quality?: QualityLevel;
  maps?: MahjongMaterialMaps;
  envMap?: THREE.Texture | null;
  useDustFx?: boolean;
  useLightShafts?: boolean;
}

export interface GoldenHallEffectFlags {
  useRim: boolean;
  useLightShafts: boolean;
  useDust: boolean;
  textureQuality: 'full' | 'reduced' | 'minimal';
}

const DEFAULT_GOLD = 0xcaa154;
const DEFAULT_DARK_STONE = 0x0e0b0a;
const DEFAULT_BASE_GOLD = 0xcaa154;

function pickMaps(quality: QualityLevel, params?: GoldenHallMaterialParams): MahjongMaterialMaps {
  if (params?.maps) {
    return params.maps;
  }
  // Reuse mahjong tile PBR maps to keep lighting consistent with cubes and avoid new heavy textures.
  // Dial down resolution for low quality to stay GPU-friendly.
  const size = quality === 'low' ? 256 : 512;
  return createMahjongMaterialMaps(size);
}

export function getGoldenHallEffectFlags(
  quality: QualityLevel,
  overrides?: { useLightShafts?: boolean; useDust?: boolean }
): GoldenHallEffectFlags {
  const base: GoldenHallEffectFlags =
    quality === 'ultra' || quality === 'ultra2'
      ? { useRim: true, useLightShafts: true, useDust: true, textureQuality: 'full' }
      : quality === 'medium'
        ? { useRim: true, useLightShafts: false, useDust: true, textureQuality: 'reduced' }
        : { useRim: true, useLightShafts: false, useDust: false, textureQuality: 'minimal' };

  let useLightShafts = overrides?.useLightShafts ?? base.useLightShafts;
  let useDust = overrides?.useDust ?? base.useDust;

  if (quality === 'low') {
    useLightShafts = false;
    useDust = false;
  } else if (quality === 'medium' && useLightShafts && useDust) {
    // Keep only one medium-tier FX to stay within budget; prefer dust.
    useLightShafts = false;
  }

  return { ...base, useLightShafts, useDust };
}

export function createGoldenHallMaterials(params?: GoldenHallMaterialParams): GoldenHallMaterialSet {
  const quality: QualityLevel = params?.quality ?? 'ultra';
  const fx = getGoldenHallEffectFlags(quality, {
    useDust: params?.useDustFx,
    useLightShafts: params?.useLightShafts,
  });
  const maps = pickMaps(quality, params);
  const envMap = params?.envMap ?? null;
  const envProps = (intensity?: number) => (envMap ? { envMap, envMapIntensity: intensity ?? 1 } : {});
  const emissiveRimMap =
    fx.useRim && quality !== 'low'
      ? createGoldenHallEmissiveRimTexture(fx.textureQuality === 'reduced' ? 128 : 256)
      : null;
  const lightShaftAlpha =
    fx.useLightShafts && fx.textureQuality !== 'minimal'
      ? createGoldenHallLightShaftAlphaMap(fx.textureQuality === 'reduced' ? 96 : 128)
      : null;

  // Pedestal gold is intentionally rougher/dimmer than the hero cubes so the tower stays visually dominant.
  const baseOuter = new THREE.MeshStandardMaterial({
    color: DEFAULT_BASE_GOLD,
    metalness: 0.6,
    roughness: 0.58,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    ...envProps(0.85),
  });

  const baseInner = new THREE.MeshStandardMaterial({
    color: 0xb8862e,
    metalness: 0.94,
    roughness: 0.26,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    ...envProps(1.2),
  });

  const baseCenter = new THREE.MeshStandardMaterial({
    color: DEFAULT_DARK_STONE,
    metalness: 0.08,
    roughness: 0.7,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    ...envProps(0.35),
  });

  const wallMain = new THREE.MeshStandardMaterial({
    color: 0x1a120f,
    metalness: 0.28,
    roughness: 0.68,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    ...envProps(0.9),
    side: THREE.BackSide,
  });

  const wallEmissiveRim = new THREE.MeshStandardMaterial({
    color: 0xc6a25b,
    metalness: 0.85,
    roughness: 0.18,
    emissive: 0xffedd0,
    emissiveIntensity: fx.useRim ? (quality === 'low' ? 0.6 : quality === 'medium' ? 0.95 : 1.25) : 0,
    emissiveMap: fx.useRim ? emissiveRimMap ?? undefined : undefined,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    ...envProps(1.2),
    side: THREE.DoubleSide,
  });

  const pillar = new THREE.MeshStandardMaterial({
    color: 0x2d1c12,
    metalness: 0.72,
    roughness: 0.45,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    ...envProps(0.9),
  });

  const panel = new THREE.MeshStandardMaterial({
    color: 0x1a1310,
    metalness: 0.26,
    roughness: 0.6,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    aoMap: maps.aoMap,
    ...envProps(0.85),
  });

  const dustParticle = new THREE.PointsMaterial({
    color: 0xffefc8,
    size: fx.useDust ? (quality === 'low' ? 0.1 : 0.12) : 0,
    transparent: true,
    opacity: fx.useDust ? (quality === 'low' ? 0.22 : quality === 'medium' ? 0.32 : 0.42) : 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lightShaft = new THREE.MeshBasicMaterial({
    color: 0xfff5e0,
    transparent: true,
    opacity: fx.useLightShafts ? (quality === 'low' ? 0.2 : quality === 'medium' ? 0.32 : 0.5) : 0,
    alphaMap: lightShaftAlpha ?? undefined,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  return {
    baseOuter,
    baseInner,
    baseCenter,
    wallMain,
    wallEmissiveRim,
    pillar,
    panel,
    dustParticle,
    lightShaft,
  };
}
