import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRenderConfig } from '../renderConfig';

describe('createRenderConfig lighting', () => {
  it('provides key and rim lights with positions and targets', () => {
    const config = createRenderConfig();
    const { key, rim, ambient, hemisphere } = config.lights;

    expect(ambient.intensity).toBeGreaterThan(0);
    expect(hemisphere.intensity).toBeGreaterThan(0);

    expect(key.intensity).toBeGreaterThan(0);
    expect(key.position).toBeInstanceOf(THREE.Vector3);
    expect(key.target).toBeInstanceOf(THREE.Vector3);

    expect(rim.intensity).toBeGreaterThan(0);
    expect(rim.position).toBeInstanceOf(THREE.Vector3);
    expect(rim.target).toBeInstanceOf(THREE.Vector3);
  });
});
