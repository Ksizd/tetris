import type { FootprintLavaSparksFxInternal, ParticlePool } from './footprintLavaSparksFx';

const KIND_EMBER = 0;
const KIND_DROPLET = 1;

const STATE_SPLIT_DONE = 1 << 0;
const STATE_BOUNCED = 1 << 1;

const SUBSTEP_THRESHOLD_SEC = 1 / 30;
const DT_CLAMP_SEC = 0.075;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function randStep01(value: number): number {
  return fract(value * 1.3723981 + 0.12741839);
}

function spawnEmberAt(
  internal: FootprintLavaSparksFxInternal,
  allocateParticle: (pool: ParticlePool) => number,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  baseRand: number,
  tempScale: number,
  sizeScale: number,
  lifeScale: number
): void {
  const pool = internal.pool;
  const idx = allocateParticle(pool);
  if (idx < 0) {
    return;
  }

  const r1 = randStep01(baseRand);
  const r2 = randStep01(r1);
  const r3 = randStep01(r2);
  const r4 = randStep01(r3);

  pool.posX[idx] = x;
  pool.posY[idx] = y;
  pool.posZ[idx] = z;
  pool.velX[idx] = vx;
  pool.velY[idx] = vy;
  pool.velZ[idx] = vz;
  pool.age[idx] = 0;
  pool.life[idx] = (0.35 + r1 * 0.85) * lifeScale;
  pool.size[idx] = (0.25 + r2 * 0.85) * sizeScale;
  pool.temp0[idx] = (0.9 + r3 * 0.5) * tempScale;
  pool.temp[idx] = pool.temp0[idx];
  pool.kind[idx] = KIND_EMBER;
  pool.state[idx] = 0;
  pool.splitAtSec[idx] = 0;
  pool.spin[idx] = (r4 * 2 - 1) * 6.0;
  pool.rand[idx] = randStep01(r4);
  pool.alpha[idx] = 1;
  pool.stretch[idx] = 1;
  pool.rot[idx] = 0;
}

function fillDebugSamples(internal: FootprintLavaSparksFxInternal): void {
  const pool = internal.pool;
  const sampleCount = Math.min(10, pool.activeCount);
  internal.debugSampleCount = sampleCount;
  for (let s = 0; s < sampleCount; s += 1) {
    const idx = pool.activeIndices[s];
    internal.debugSampleKind[s] = pool.kind[idx];
    internal.debugSamplePos[s * 3 + 0] = pool.posX[idx];
    internal.debugSamplePos[s * 3 + 1] = pool.posY[idx];
    internal.debugSamplePos[s * 3 + 2] = pool.posZ[idx];
    internal.debugSampleVel[s * 3 + 0] = pool.velX[idx];
    internal.debugSampleVel[s * 3 + 1] = pool.velY[idx];
    internal.debugSampleVel[s * 3 + 2] = pool.velZ[idx];
    internal.debugSampleTemp[s] = pool.temp[idx];
    internal.debugSampleAge[s] = pool.age[idx];
  }
}

export function simulateFootprintLavaSparks(
  internal: FootprintLavaSparksFxInternal,
  dtSec: number,
  timeSec: number,
  allocateParticle: (pool: ParticlePool) => number,
  freeParticle: (pool: ParticlePool, idx: number) => void
): void {
  const dt = Math.min(dtSec, DT_CLAMP_SEC);
  const pool = internal.pool;
  const ringATopY = internal.ringATopY;
  const lavaSurfaceY = internal.lavaSurfaceY;
  const reabsorbY = lavaSurfaceY - internal.blockSize * 0.08;

  let substeps = 1;
  if (dt > SUBSTEP_THRESHOLD_SEC) {
    substeps = dt > 1 / 20 ? 3 : 2;
  }
  internal.substepsLastFrame = substeps;
  const stepDt = dt / substeps;

  for (let sub = 0; sub < substeps; sub += 1) {
    const simTimeSec = timeSec + stepDt * sub;
    let i = 0;
    while (i < pool.activeCount) {
      const idx = pool.activeIndices[i];
      const kind = pool.kind[idx];

      let px = pool.posX[idx];
      let py = pool.posY[idx];
      let pz = pool.posZ[idx];
      let vx = pool.velX[idx];
      let vy = pool.velY[idx];
      let vz = pool.velZ[idx];
      const oldPy = py;

      let age = pool.age[idx] + stepDt;
      const life = pool.life[idx];
      pool.age[idx] = age;
      if (!(age < life)) {
        freeParticle(pool, idx);
        continue;
      }

      const temp0 = Math.max(1e-6, pool.temp0[idx]);
      const coolRate = kind === KIND_DROPLET ? 0.95 : 1.05;
      const tempNorm = Math.exp(-coolRate * age);
      const temp = temp0 * tempNorm;
      pool.temp[idx] = temp;

      let alpha = clamp01(1 - age / Math.max(1e-6, life));
      alpha *= clamp01(tempNorm / 0.25);
      pool.alpha[idx] = alpha;
      if (!(alpha > 0.002)) {
        freeParticle(pool, idx);
        continue;
      }

      // If a particle sinks back into the lava channel, treat it as reabsorbed.
      if (py < reabsorbY) {
        freeParticle(pool, idx);
        continue;
      }

      if (
        kind === KIND_DROPLET &&
        (pool.state[idx] & STATE_SPLIT_DONE) === 0 &&
        age >= pool.splitAtSec[idx]
      ) {
        const baseRand = pool.rand[idx];
        const parts = baseRand < 0.62 ? 2 : 3;
        const invR = 1 / Math.max(1e-6, Math.hypot(px, pz));
        const rx = px * invR;
        const rz = pz * invR;
        const tx = -rz;
        const tz = rx;
        for (let p = 1; p < parts; p += 1) {
          const r1 = randStep01(baseRand + p * 0.31);
          const r2 = randStep01(r1);
          const r3 = randStep01(r2);
          const spread = (0.25 + r1 * 0.6) * (0.55 + r2 * 0.9);
          const swirl = (r2 * 2 - 1) * spread;
          const radial = (r3 * 2 - 1) * spread;
          spawnEmberAt(
            internal,
            allocateParticle,
            px,
            py + 0.002,
            pz,
            vx * (0.55 + r1 * 0.15) + tx * swirl + rx * radial,
            vy * (0.6 + r2 * 0.15) + (0.18 + r3 * 0.22),
            vz * (0.55 + r3 * 0.15) + tz * swirl + rz * radial,
            r3,
            temp0 * (0.7 + 0.2 * randStep01(r3)),
            0.55,
            0.65
          );
        }
        pool.state[idx] |= STATE_SPLIT_DONE;
        pool.temp0[idx] = temp0 * (0.7 + 0.2 * randStep01(baseRand));
        pool.size[idx] = pool.size[idx] * 0.84;
      }

      const tempNormNow = clamp01(temp / temp0);
      const g = kind === KIND_DROPLET ? 9.2 : 7.2;
      let ax = 0;
      let ay = -g;
      let az = 0;

      const height = Math.max(0, py - lavaSurfaceY);
      const nearSurface = 1 / (1 + height * (kind === KIND_DROPLET ? 3.0 : 2.1));
      const b = kind === KIND_DROPLET ? 2.2 : 8.2;
      ay += b * tempNormNow * nearSurface;

      const freq = kind === KIND_DROPLET ? 0.55 : 0.75;
      const phase0 = simTimeSec * 0.9;
      const phase1 = simTimeSec * 1.2;
      const phase2 = simTimeSec * 0.7;
      const nX = px * freq;
      const nY = (py - lavaSurfaceY) * freq;
      const nZ = pz * freq;
      const a = Math.cos(nX + nY + phase2);
      const b0 = Math.cos(nY + nZ + phase0);
      const c = Math.cos(nZ + nX + phase1);
      const curlX = (a - c) * freq;
      const curlY = (b0 - a) * freq;
      const curlZ = (c - b0) * freq;
      const turbStrength = (kind === KIND_DROPLET ? 1.0 : 1.55) * tempNormNow;
      ax += turbStrength * curlX;
      ay += turbStrength * curlY * 0.35;
      az += turbStrength * curlZ;

      const speed = Math.hypot(vx, vy, vz);
      const k1 = kind === KIND_DROPLET ? 1.35 : 0.75;
      const k2 = kind === KIND_DROPLET ? 0.34 : 0.12;
      const drag = k1 + k2 * speed;
      ax += -drag * vx;
      ay += -drag * vy;
      az += -drag * vz;

      vx += ax * stepDt;
      vy += ay * stepDt;
      vz += az * stepDt;
      px += vx * stepDt;
      py += vy * stepDt;
      pz += vz * stepDt;

      if (oldPy > ringATopY && py <= ringATopY) {
        if (kind === KIND_DROPLET) {
          const state = pool.state[idx];
          const rBase = pool.rand[idx];
          const canBounce = (state & STATE_BOUNCED) === 0 && rBase < 0.16;
          if (canBounce) {
            const r1 = randStep01(rBase);
            const r2 = randStep01(r1);
            const restitution = 0.15 + r1 * 0.2;
            const friction = 0.5 + r2 * 0.3;
            py = ringATopY + 0.0005;
            vy = Math.abs(vy) * restitution;
            vx *= friction;
            vz *= friction;
            pool.state[idx] = state | STATE_BOUNCED;
            pool.temp0[idx] = pool.temp0[idx] * 0.87;
          } else {
            const microCount = 2 + Math.floor(randStep01(rBase) * 4);
            const invR = 1 / Math.max(1e-6, Math.hypot(px, pz));
            const rx = px * invR;
            const rz = pz * invR;
            const tx = -rz;
            const tz = rx;
            for (let m = 0; m < microCount; m += 1) {
              const rm1 = randStep01(rBase + m * 0.29);
              const rm2 = randStep01(rm1);
              const rm3 = randStep01(rm2);
              const spread = (0.15 + rm1 * 0.45) * (0.5 + rm2 * 0.85);
              const swirl = (rm2 * 2 - 1) * spread;
              const radial = (rm3 * 2 - 1) * spread;
              spawnEmberAt(
                internal,
                allocateParticle,
                px,
                ringATopY + 0.0006,
                pz,
                vx * 0.2 + tx * swirl + rx * radial,
                Math.abs(vy) * (0.12 + rm1 * 0.18) + (0.35 + rm2 * 0.35),
                vz * 0.2 + tz * swirl + rz * radial,
                rm3,
                temp0 * (0.8 + 0.15 * rm1),
                0.38,
                0.42
              );
            }
            freeParticle(pool, idx);
            continue;
          }
        } else {
          freeParticle(pool, idx);
          continue;
        }
      }

      pool.posX[idx] = px;
      pool.posY[idx] = py;
      pool.posZ[idx] = pz;
      pool.velX[idx] = vx;
      pool.velY[idx] = vy;
      pool.velZ[idx] = vz;
      pool.rot[idx] += pool.spin[idx] * stepDt;
      const speedAfter = Math.hypot(vx, vy, vz);
      pool.stretch[idx] = 1 + speedAfter * (kind === KIND_DROPLET ? 0.22 : 0.14);
      i += 1;
    }
  }

  fillDebugSamples(internal);
}
