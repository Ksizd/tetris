import type { FootprintLavaSmokeFxInternal, SmokeParticlePool } from './footprintLavaSmokeFx';

const KIND_BASE = 0;
const KIND_PLUME = 1;

const SUBSTEP_THRESHOLD_SEC = 1 / 30;
const DT_CLAMP_SEC = 0.075;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function freeParticle(pool: SmokeParticlePool, idx: number): void {
  const posInActive = pool.activePos[idx];
  if (posInActive < 0) {
    return;
  }
  const lastIdx = pool.activeIndices[pool.activeCount - 1];
  pool.activeIndices[posInActive] = lastIdx;
  pool.activePos[lastIdx] = posInActive;
  pool.activeCount -= 1;
  pool.activePos[idx] = -1;
  pool.freeList[pool.freeCount] = idx;
  pool.freeCount += 1;
}

export function simulateFootprintLavaSmoke(
  internal: FootprintLavaSmokeFxInternal,
  dtSec: number,
  timeSec: number
): void {
  const dt = Math.min(dtSec, DT_CLAMP_SEC);
  if (!(dt > 0)) {
    internal.substepsLastFrame = 0;
    return;
  }

  let substeps = 1;
  if (dt > SUBSTEP_THRESHOLD_SEC) {
    substeps = dt > 1 / 20 ? 3 : 2;
  }
  internal.substepsLastFrame = substeps;
  const stepDt = dt / substeps;

  const pool = internal.pool;
  const activeIndices = pool.activeIndices;
  const posXArr = pool.posX;
  const posYArr = pool.posY;
  const posZArr = pool.posZ;
  const velXArr = pool.velX;
  const velYArr = pool.velY;
  const velZArr = pool.velZ;
  const ageArr = pool.age;
  const lifeArr = pool.life;
  const sizeArr = pool.size;
  const baseSizeArr = pool.baseSize;
  const baseStretchArr = pool.baseStretch;
  const alphaArr = pool.alpha;
  const glowArr = pool.glow;
  const heatArr = pool.heat;
  const stretchArr = pool.stretch;
  const kindArr = pool.kind;
  const randArr = pool.rand;
  const lavaSurfaceY = internal.lavaSurfaceY;
  const blockSize = internal.blockSize;
  const blockDepth = internal.blockDepth;
  const ringRadius = internal.R0;
  const ringHalfW = internal.grooveHalfW;
  const ringMinR = ringRadius - ringHalfW;
  const ringMaxR = ringRadius + ringHalfW;
  const rMax = ringMaxR + ringHalfW * 0.25;
  const minY = lavaSurfaceY - blockSize * 0.02;

  for (let sub = 0; sub < substeps; sub += 1) {
    const simTimeSec = timeSec + stepDt * sub;
    let i = 0;
    while (i < pool.activeCount) {
      const idx = activeIndices[i];
      const life = lifeArr[idx];
      if (!(life > 0)) {
        freeParticle(pool, idx);
        continue;
      }

      let px = posXArr[idx];
      let py = posYArr[idx];
      let pz = posZArr[idx];
      let vx = velXArr[idx];
      let vy = velYArr[idx];
      let vz = velZArr[idx];
      const kindValue = kindArr[idx];

      const age = ageArr[idx] + stepDt;
      if (age >= life) {
        freeParticle(pool, idx);
        continue;
      }
      const t = age / life;

      let ax = 0;
      let ay = kindValue === KIND_PLUME ? 1.0 : 0.95;
      let az = 0;

      ay *= 1.0 - 0.55 * t;
      ay -= 0.18 * smoothstep(0.75, 1.0, t);

      const rBase = Math.sqrt(px * px + pz * pz);
      const invR = 1 / Math.max(1e-6, rBase);
      const rx = px * invR;
      const rz = pz * invR;
      const tx = -rz;
      const tz = rx;

      let swirl = kindValue === KIND_PLUME ? 0.7 : 0.6;
      swirl *= 0.65 + 0.35 * Math.sin(simTimeSec * 0.35 + randArr[idx] * 12.0);
      ax += tx * swirl;
      az += tz * swirl;

      const dr = rBase - ringRadius;
      const ringSpring = kindValue === KIND_PLUME ? 0.9 : 1.6;
      ax += -rx * dr * ringSpring;
      az += -rz * dr * ringSpring;

      const freq = kindValue === KIND_PLUME ? 0.18 : 0.22;
      const phase0 = simTimeSec * 0.55;
      const phase1 = simTimeSec * 0.72;
      const phase2 = simTimeSec * 0.41;
      const nX = px * freq;
      const nY = (py - lavaSurfaceY) * freq;
      const nZ = pz * freq;
      const a = Math.cos(nX + nY + phase2);
      const b = Math.cos(nY + nZ + phase0);
      const c = Math.cos(nZ + nX + phase1);
      const curlX = (a - c) * freq;
      const curlY = (b - a) * freq;
      const curlZ = (c - b) * freq;

      let turb = kindValue === KIND_PLUME ? 0.65 : 0.6;
      turb *= 1.0 - 0.55 * t;
      ax += turb * curlX;
      ay += turb * curlY * 0.22;
      az += turb * curlZ;

      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const drag = (kindValue === KIND_PLUME ? 0.72 : 0.8) + speed * 0.18;
      ax += -drag * vx;
      ay += -drag * vy;
      az += -drag * vz;

      vx += ax * stepDt;
      vy += ay * stepDt;
      vz += az * stepDt;

      px += vx * stepDt;
      py += vy * stepDt;
      pz += vz * stepDt;

      if (py < minY) {
        py = minY;
        vy = Math.abs(vy) * 0.15;
      }

      let rNow = Math.sqrt(px * px + pz * pz);
      if (rNow > rMax) {
        const invRNow = 1 / Math.max(1e-6, rNow);
        const rxNow = px * invRNow;
        const rzNow = pz * invRNow;
        const over = rNow - rMax;
        const pull = over * 1.8;
        const pullX = -rxNow * pull;
        const pullZ = -rzNow * pull;
        vx += pullX * stepDt;
        vz += pullZ * stepDt;
        px += pullX * stepDt * stepDt;
        pz += pullZ * stepDt * stepDt;
        rNow = Math.sqrt(px * px + pz * pz);
      }

      const rMin = ringMinR;
      const rMaxBand = ringMaxR;
      if (rNow < rMin || rNow > rMaxBand) {
        const rClamped = Math.min(rMaxBand, Math.max(rMin, rNow));
        const invRNow = 1 / Math.max(1e-6, rNow);
        const rxNow = px * invRNow;
        const rzNow = pz * invRNow;
        const scale = rClamped / Math.max(1e-6, rNow);
        px *= scale;
        pz *= scale;
        const vr = vx * rxNow + vz * rzNow;
        vx -= rxNow * vr * 0.45;
        vz -= rzNow * vr * 0.45;
        rNow = rClamped;
      }

      const tClamped = clamp01(t);
      const fadeIn = smoothstep(0.0, 0.1, tClamped);
      const fadeOut = 1.0 - smoothstep(0.7, 1.0, tClamped);
      let alpha = fadeIn * fadeOut;
      const hNow = Math.max(0, py - lavaSurfaceY);
      const lowBoost = 0.65 + 0.35 * Math.exp(-hNow / (blockSize * 0.42));
      const lowBoostScaled = 0.65 + (lowBoost - 0.65) * internal.tuning.lowBoostScale;
      alpha *= lowBoostScaled;
      const heightFade = Math.exp(-hNow / (blockSize * 1.6));
      if (kindValue !== KIND_PLUME) {
        alpha *= heightFade;
        alpha *= 0.85;
      } else {
        alpha *= 1.3;
      }

      const grow = kindValue === KIND_PLUME ? 2.0 : 1.75;
      const size = baseSizeArr[idx] * (1.0 + grow * smoothstep(0.0, 1.0, tClamped));

      let heat = Math.exp(-hNow / (blockSize * internal.tuning.heatHeightScale));
      heat *= 1.0 - 0.45 * tClamped;
      heat = clamp01(heat);

      const ringDist = Math.abs(rNow - ringRadius);
      const ringGlow = Math.exp(-ringDist / (blockDepth * 0.22));
      const heightGlow = Math.exp(-hNow / (blockSize * 0.3));
      let glow = ringGlow * heightGlow;
      glow *= 1.0 - 0.25 * tClamped;
      glow = clamp01(glow);

      const stretch = baseStretchArr[idx] +
        smoothstep(0.1, 0.65, tClamped) * (kindValue === KIND_PLUME ? 0.95 : 0.65);

      posXArr[idx] = px;
      posYArr[idx] = py;
      posZArr[idx] = pz;
      velXArr[idx] = vx;
      velYArr[idx] = vy;
      velZArr[idx] = vz;
      ageArr[idx] = age;
      sizeArr[idx] = size;
      alphaArr[idx] = alpha;
      glowArr[idx] = glow;
      heatArr[idx] = heat;
      stretchArr[idx] = stretch;

      i += 1;
    }
  }
}
