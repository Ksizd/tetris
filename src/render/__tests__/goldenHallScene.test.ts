import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGoldenHall, updateGoldenHallFx } from '../goldenHallScene';
import { createBoardRenderConfig } from '../boardConfig';
import { computeTowerEnvelope } from '../towerBounds';
import { VISUAL_DEFAULTS } from '../visualDefaults';
import { HallLayoutRadii, computeHallLayout, createDefaultHallLayoutConfig } from '../hallLayout';
import { BoardDimensions } from '../../core/types';

const DIMENSIONS: BoardDimensions = { width: 10, height: 20 };
const BOARD_CONFIG = createBoardRenderConfig(DIMENSIONS);

describe('goldenHallScene', () => {
  it('builds hall groups with FX and applies floor offset', () => {
    const goldenHall = {
      ...VISUAL_DEFAULTS.goldenHall.ultra,
      enabled: true,
    };
    const towerBounds = computeTowerEnvelope(DIMENSIONS, BOARD_CONFIG, { minY: -1.5 });
    const envMap = new THREE.Texture();

    const hall = createGoldenHall({
      towerBounds,
      dimensions: DIMENSIONS,
      board: BOARD_CONFIG,
      goldenHall,
      quality: 'ultra',
      envMap,
    })!;

    expect(hall.baseGroup.name).toBe('hall-base');
    expect(hall.hallGroup.name).toBe('hall-group');
    expect(hall.fxGroup.children.length).toBeGreaterThan(0);
    expect(hall.baseGroup.position.y).toBeCloseTo(-1.5);
    expect(hall.hallGroup.position.y).toBeCloseTo(-1.5);
    expect(hall.fxGroup.position.y).toBeCloseTo(-1.5);

    expect(hall.updateFx).toBeTruthy();
    updateGoldenHallFx(hall, 16);
    hall.dispose();
  });

  it('respects quality/flags by skipping FX on low', () => {
    const goldenHall = {
      ...VISUAL_DEFAULTS.goldenHall.low,
      enabled: true,
      useDustFx: false,
      useLightShafts: false,
    };
    const towerBounds = computeTowerEnvelope(DIMENSIONS, BOARD_CONFIG);

    const hall = createGoldenHall({
      towerBounds,
      dimensions: DIMENSIONS,
      board: BOARD_CONFIG,
      goldenHall,
      quality: 'low',
    })!;

    expect(hall.fxGroup.children.length).toBe(0);
    hall.dispose();
  });

  it('returns null when hall disabled', () => {
    const towerBounds = computeTowerEnvelope(DIMENSIONS, BOARD_CONFIG);
    const hall = createGoldenHall({
      towerBounds,
      dimensions: DIMENSIONS,
      board: BOARD_CONFIG,
      goldenHall: { ...VISUAL_DEFAULTS.goldenHall.ultra, enabled: false },
      quality: 'ultra',
    });
    expect(hall).toBeNull();
  });

  it('applies hallLayout override for hall and platform radii', () => {
    const towerBounds = computeTowerEnvelope(DIMENSIONS, BOARD_CONFIG);
    const hallLayout: HallLayoutRadii = {
      towerOuterRadius: BOARD_CONFIG.towerRadius + BOARD_CONFIG.blockDepth * 0.5,
      cameraOrbitRadius: 12,
      hallInnerRadius: 14,
      hallOuterRadius: 16,
      platformOuterRadius: 11,
    };

    const hall = createGoldenHall({
      towerBounds,
      dimensions: DIMENSIONS,
      board: BOARD_CONFIG,
      goldenHall: VISUAL_DEFAULTS.goldenHall.ultra,
      quality: 'ultra',
      hallLayout,
    })!;

    expect(hall.layout.base.outerRadius).toBeCloseTo(hallLayout.platformOuterRadius);
    expect(hall.layout.hallRadius).toBeCloseTo(hallLayout.hallOuterRadius);
    hall.dispose();
  });

  it('keeps platform top aligned to tower floor and radii tied to hallLayout', () => {
    const towerBounds = computeTowerEnvelope(DIMENSIONS, BOARD_CONFIG, { minY: -2 });
    const hallLayoutConfig = createDefaultHallLayoutConfig(BOARD_CONFIG.blockSize);
    const hallLayout = computeHallLayout(
      {
        towerOuterRadius: BOARD_CONFIG.towerRadius + BOARD_CONFIG.blockDepth * 0.5,
        cameraOrbitRadius: 12,
      },
      hallLayoutConfig
    );

    const hall = createGoldenHall({
      towerBounds,
      dimensions: DIMENSIONS,
      board: BOARD_CONFIG,
      goldenHall: VISUAL_DEFAULTS.goldenHall.ultra,
      quality: 'ultra',
      hallLayout,
    })!;

    expect(hall.layout.base.outerRadius).toBeCloseTo(hallLayout.platformOuterRadius);
    expect(hall.layout.footprint.outerRadius).toBeGreaterThan(0);

    hall.baseGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(hall.baseGroup);
    expect(box.max.y).toBeCloseTo(towerBounds.minY, 1e-3);
    expect(hall.baseGroup.position.x).toBeCloseTo(0);
    expect(hall.baseGroup.position.z).toBeCloseTo(0);

    hall.dispose();
  });
});
