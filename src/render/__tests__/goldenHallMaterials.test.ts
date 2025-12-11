import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGoldenHallMaterials, getGoldenHallEffectFlags } from '../goldenHallMaterials';

describe('createGoldenHallMaterials', () => {
  it('creates all logical material roles and passes envMap through', () => {
    const envMap = new THREE.Texture();
    const set = createGoldenHallMaterials({ envMap });

    expect(set.baseOuter.envMap).toBe(envMap);
    expect(set.wallMain.envMap).toBe(envMap);
    expect(set.wallEmissiveRim.envMap).toBe(envMap);
    expect(set.pillar.envMap).toBe(envMap);
    expect(set.panel.envMap).toBe(envMap);
    expect(set.baseInner.envMap).toBe(envMap);
    expect(set.baseCenter.envMap).toBe(envMap);
    expect(set.dustParticle).toBeInstanceOf(THREE.PointsMaterial);
    expect(set.lightShaft).toBeInstanceOf(THREE.MeshBasicMaterial);
  });

  it('adapts emissive/intensity choices to render quality', () => {
    const low = createGoldenHallMaterials({ quality: 'low' });
    const medium = createGoldenHallMaterials({ quality: 'medium' });
    const ultra = createGoldenHallMaterials({ quality: 'ultra' });

    expect(low.dustParticle.opacity).toBeLessThan(ultra.dustParticle.opacity);
    expect(medium.wallEmissiveRim.emissiveIntensity).toBeLessThan(ultra.wallEmissiveRim.emissiveIntensity);
    expect(low.wallEmissiveRim.emissiveIntensity).toBeLessThan(medium.wallEmissiveRim.emissiveIntensity);
    expect(ultra.lightShaft.opacity).toBeGreaterThan(0);
    expect(medium.lightShaft.opacity).toBe(0);
    expect(low.lightShaft.opacity).toBe(0);
  });

  it('reuses provided PBR maps across all roles to avoid duplication', () => {
    const roughnessMap = new THREE.DataTexture(new Uint8Array([0]), 1, 1);
    const metalnessMap = new THREE.DataTexture(new Uint8Array([0]), 1, 1);
    const aoMap = new THREE.DataTexture(new Uint8Array([0]), 1, 1);
    const maps = { roughnessMap, metalnessMap, aoMap };

    const set = createGoldenHallMaterials({ maps });

    expect(set.baseOuter.roughnessMap).toBe(roughnessMap);
    expect(set.wallMain.metalnessMap).toBe(metalnessMap);
    expect(set.wallMain.aoMap).toBe(aoMap);
    expect(set.pillar.roughnessMap).toBe(roughnessMap);
    expect(set.panel.metalnessMap).toBe(metalnessMap);
    expect(set.baseCenter.aoMap).toBe(aoMap);
  });

  it('keeps stone-like materials darker, rougher, and less metallic than outer gold', () => {
    const set = createGoldenHallMaterials({ quality: 'ultra' });
    expect(set.baseCenter.metalness).toBeLessThan(set.baseOuter.metalness);
    expect(set.baseCenter.roughness).toBeGreaterThan(set.baseOuter.roughness);
    expect(set.wallMain.metalness).toBeLessThan(set.baseOuter.metalness);
    expect(set.wallMain.roughness).toBeGreaterThan(set.baseOuter.roughness);
    expect(set.baseCenter.color.getHex()).toBeLessThan(set.baseOuter.color.getHex());
  });

  it('keeps pedestal gold slightly rougher/dimmer than the inner accent', () => {
    const envMap = new THREE.Texture();
    const set = createGoldenHallMaterials({ quality: 'medium', envMap });
    expect(set.baseOuter.roughness).toBeGreaterThan(set.baseInner.roughness);
    expect(set.baseOuter.metalness).toBeLessThan(set.baseInner.metalness);
    expect(set.baseOuter.envMapIntensity ?? 0).toBeLessThan(set.baseInner.envMapIntensity ?? 1);
  });

  it('respects metalness/roughness ranges per material spec', () => {
    const set = createGoldenHallMaterials({ quality: 'ultra' });
    expect(set.baseInner.metalness).toBeGreaterThanOrEqual(0.9);
    expect(set.baseInner.metalness).toBeLessThanOrEqual(1.0);
    expect(set.baseInner.roughness).toBeGreaterThanOrEqual(0.2);
    expect(set.baseInner.roughness).toBeLessThanOrEqual(0.35);

    expect(set.baseOuter.metalness).toBeGreaterThanOrEqual(0.5);
    expect(set.baseOuter.metalness).toBeLessThanOrEqual(0.8);
    expect(set.baseOuter.roughness).toBeGreaterThanOrEqual(0.4);
    expect(set.baseOuter.roughness).toBeLessThanOrEqual(0.7);

    expect(set.baseCenter.metalness).toBeGreaterThanOrEqual(0);
    expect(set.baseCenter.metalness).toBeLessThanOrEqual(0.2);
    expect(set.baseCenter.roughness).toBeGreaterThanOrEqual(0.5);
    expect(set.baseCenter.roughness).toBeLessThanOrEqual(0.8);

    expect(set.wallMain.metalness).toBeGreaterThanOrEqual(0.2);
    expect(set.wallMain.metalness).toBeLessThanOrEqual(0.6);
    expect(set.wallMain.roughness).toBeGreaterThanOrEqual(0.6);
    expect(set.wallMain.roughness).toBeLessThanOrEqual(0.9);

    expect(set.pillar.metalness).toBeGreaterThanOrEqual(0.6);
    expect(set.pillar.metalness).toBeLessThanOrEqual(0.9);
    expect(set.pillar.roughness).toBeGreaterThanOrEqual(0.3);
    expect(set.pillar.roughness).toBeLessThanOrEqual(0.6);
  });

  it('uses warm emissive rim and gradient alpha for shafts, with dust toned for darkness', () => {
    const set = createGoldenHallMaterials({ quality: 'ultra' });
    const emissiveHex = set.wallEmissiveRim.emissive.getHex();
    expect(emissiveHex).toBeGreaterThanOrEqual(0xffe6b0);
    expect(emissiveHex).toBeLessThanOrEqual(0xfff2d0);
    expect(set.wallEmissiveRim.emissiveMap).toBeDefined();
    expect(set.lightShaft.alphaMap).toBeDefined();
    expect(set.dustParticle.color.getHex()).toBeGreaterThan(0xf0d000);
  });

  it('uses envMapIntensity lower than cubes for hall metals', () => {
    const set = createGoldenHallMaterials({ quality: 'ultra', envMap: new THREE.Texture() });
    expect(set.baseInner.envMapIntensity).toBeLessThan(1.5);
    expect(set.baseOuter.envMapIntensity).toBeLessThan(1.0);
    expect(set.pillar.envMapIntensity).toBeLessThan(1.0);
    expect(set.wallMain.envMapIntensity).toBeLessThan(1.1);
  });

  it('sets effect flags per quality LOD', () => {
    expect(getGoldenHallEffectFlags('ultra')).toEqual({
      useRim: true,
      useLightShafts: true,
      useDust: true,
      textureQuality: 'full',
    });
    expect(getGoldenHallEffectFlags('medium')).toEqual({
      useRim: true,
      useLightShafts: false,
      useDust: true,
      textureQuality: 'reduced',
    });
    expect(getGoldenHallEffectFlags('low')).toEqual({
      useRim: true,
      useLightShafts: false,
      useDust: false,
      textureQuality: 'minimal',
    });
  });

  it('clamps medium to a single FX when both overrides are requested', () => {
    expect(
      getGoldenHallEffectFlags('medium', {
        useDust: true,
        useLightShafts: true,
      })
    ).toEqual({
      useRim: true,
      useLightShafts: false,
      useDust: true,
      textureQuality: 'reduced',
    });
    expect(
      getGoldenHallEffectFlags('low', {
        useDust: true,
        useLightShafts: true,
      })
    ).toEqual({
      useRim: true,
      useLightShafts: false,
      useDust: false,
      textureQuality: 'minimal',
    });
  });
});
