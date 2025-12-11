export interface HallLayoutConfig {
  /** Минимальный зазор от камеры до внутренней стенки зала (world units). */
  cameraInnerMargin: number;
  /** Минимальный зазор от башни до внутренней стенки зала (world units). */
  towerInnerMargin: number;
  /** Толщина стенки зала по радиусу. */
  shellThickness: number;
  /** Зазор между внутренней стенкой зала и внешним радиусом платформы. */
  platformWallGap: number;
}

export interface HallLayoutRadii {
  towerOuterRadius: number;
  cameraOrbitRadius: number;
  hallInnerRadius: number;
  hallOuterRadius: number;
  platformOuterRadius: number;
}

export function computeHallLayout(
  params: {
    towerOuterRadius: number;
    cameraOrbitRadius: number;
  },
  cfg: HallLayoutConfig
): HallLayoutRadii {
  if (params.towerOuterRadius <= 0) {
    throw new Error('towerOuterRadius must be positive');
  }
  if (params.cameraOrbitRadius <= 0) {
    throw new Error('cameraOrbitRadius must be positive');
  }
  if (
    cfg.cameraInnerMargin < 0 ||
    cfg.towerInnerMargin < 0 ||
    cfg.shellThickness < 0 ||
    cfg.platformWallGap < 0
  ) {
    throw new Error('HallLayoutConfig margins must be non-negative');
  }

  const minByCamera = params.cameraOrbitRadius + cfg.cameraInnerMargin;
  const minByTower = params.towerOuterRadius + cfg.towerInnerMargin;
  const hallInnerRadius = Math.max(minByCamera, minByTower);
  const hallOuterRadius = hallInnerRadius + cfg.shellThickness;

  const platformOuterRadiusRaw = hallInnerRadius - cfg.platformWallGap;
  const platformOuterRadius = Math.max(platformOuterRadiusRaw, params.towerOuterRadius + 0.01);

  return {
    towerOuterRadius: params.towerOuterRadius,
    cameraOrbitRadius: params.cameraOrbitRadius,
    hallInnerRadius,
    hallOuterRadius,
    platformOuterRadius,
  };
}

export function createDefaultHallLayoutConfig(blockSize: number): HallLayoutConfig {
  if (blockSize <= 0) {
    throw new Error('blockSize must be positive');
  }
  const clamp = (value: number): number => Math.max(0, value);
  return {
    cameraInnerMargin: clamp(blockSize * 1.0),
    towerInnerMargin: clamp(blockSize * 0.75),
    shellThickness: clamp(blockSize * 1.25),
    platformWallGap: clamp(blockSize * 0.35),
  };
}
