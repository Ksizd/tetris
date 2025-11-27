import { computeTowerHeight, CameraPlacement } from './cameraSetup';
import { RenderContext } from './renderer';

const TWO_PI = Math.PI * 2;

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
  const heightOffset = Math.sin(t * motion.heightSpeed) * (towerHeight * motion.heightAmplitudeRatio);
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
