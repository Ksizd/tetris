import * as THREE from 'three';
import { computeTowerHeight, CameraPlacement } from './cameraSetup';
import { RenderContext } from './renderer';
import { TowerBounds } from './towerBounds';
import { getColumnAngle } from '../core/coords';

const TWO_PI = Math.PI * 2;
const FOLLOW_DAMPING = 0.0065;

export interface CameraFollowState {
  enabled: boolean;
  columnIndex: number;
  width: number;
  snap?: boolean;
}

/**
 * Applies a subtle breathing/orbit motion to the camera based on the base placement stored in the render context.
 */
export function updateCameraMotion(ctx: RenderContext, timeMs: number): void {
  const motion = ctx.renderConfig.cameraMotion;
  if (!motion.enabled) {
    return;
  }

  const base = ctx.cameraBasePlacement;
  const towerHeight = computeTowerHeight(ctx.renderConfig.boardDimensions, ctx.renderConfig.board);
  const baseVector = toVector(base);
  const azimuth = Math.atan2(baseVector.z, baseVector.x);
  const radius = Math.hypot(baseVector.x, baseVector.z);
  const t = timeMs / 1000;

  const angleOffset = Math.sin(t * motion.orbitSpeed) * motion.orbitAmplitude;
  const heightOffset =
    Math.sin(t * motion.heightSpeed) * (towerHeight * motion.heightAmplitudeRatio);
  const angle = wrapAngle(azimuth + angleOffset);

  const x = base.target.x + Math.cos(angle) * radius;
  const z = base.target.z + Math.sin(angle) * radius;
  const y = base.position.y + heightOffset;
  const targetY = base.target.y + heightOffset * motion.targetFollowRatio;

  ctx.camera.position.set(x, y, z);
  ctx.camera.lookAt(base.target.x, targetY, base.target.z);
  ctx.renderConfig.camera.position.copy(ctx.camera.position);
  ctx.renderConfig.camera.target.set(base.target.x, targetY, base.target.z);
}

export function updateGameCamera(
  camera: THREE.PerspectiveCamera,
  base: CameraPlacement,
  towerBounds: TowerBounds,
  follow: CameraFollowState | null,
  deltaTime: number
): void {
  if (!follow?.enabled) {
    return;
  }
  const center = towerBounds.center;
  const baseOffset = base.position.clone().sub(base.target);
  const baseDistance = Math.hypot(baseOffset.x, baseOffset.z);
  const baseHeight = base.position.y;
  const currentAngle = Math.atan2(camera.position.z - center.z, camera.position.x - center.x);
  const targetAngle = getColumnAngle(follow.columnIndex, follow.width);
  const angle = follow.snap
    ? targetAngle
    : interpolateAngle(
        currentAngle,
        targetAngle,
        THREE.MathUtils.clamp(1 - Math.exp(-FOLLOW_DAMPING * Math.max(deltaTime, 0)), 0.08, 0.28)
      );
  const r = baseDistance + towerBounds.radius;
  const eye = new THREE.Vector3(
    Math.cos(angle) * r + center.x,
    baseHeight,
    Math.sin(angle) * r + center.z
  );
  const target = new THREE.Vector3(center.x, base.target.y, center.z);
  camera.position.copy(eye);
  camera.lookAt(target);
}

function toVector(placement: CameraPlacement) {
  return {
    x: placement.position.x - placement.target.x,
    y: placement.position.y - placement.target.y,
    z: placement.position.z - placement.target.z,
  };
}

function wrapAngle(angle: number): number {
  let a = angle % TWO_PI;
  if (a < -Math.PI) {
    a += TWO_PI;
  } else if (a > Math.PI) {
    a -= TWO_PI;
  }
  return a;
}

function interpolateAngle(current: number, target: number, factor: number): number {
  const delta = wrapAngle(target - current);
  const step = delta * Math.max(0, Math.min(1, factor));
  return wrapAngle(current + step);
}
