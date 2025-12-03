import { Quaternion, Vector3 } from 'three';
import {
  CubeDestructionSim,
  createCubeDestructionSim,
  createFragment,
  Fragment,
  FragmentKind,
} from './cubeDestructionSim';
import { RowDestructionSim, CubeExplosionSlot } from './rowDestructionSim';
import { generateAngularVelocity } from './fragmentAngular';
import { composeInitialVelocity } from './fragmentVelocity';
import { CUBE_FRAGMENT_PATTERNS, CubeFragmentPattern } from './fragmentPattern';
import { FRAGMENT_KIND_INITIAL_CONFIG } from './fragmentKindConfig';
import { getDefaultShardTemplateSet } from './shardTemplateSet';
import { computeShardLocalCenter } from './shardVolumeMap';
import { DEFAULT_FACE_UV_RECTS } from './faceUvRect';
import { CubeFace } from './cubeSpace';

function getSlotForCube(row: RowDestructionSim, cubeIndex: number): CubeExplosionSlot | null {
  return row.explosions.find((slot) => slot.cubeIndex === cubeIndex) ?? null;
}

function randomInRange(min: number, max: number): number {
  if (max < min) {
    throw new Error('max must be >= min');
  }
  if (max === min) {
    return min;
  }
  return min + (max - min) * Math.random();
}

function randomQuaternion(): Quaternion {
  const axis = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  if (axis.lengthSq() === 0) {
    axis.set(0, 1, 0);
  }
  axis.normalize();
  const angle = Math.random() * Math.PI * 2;
  return new Quaternion().setFromAxisAngle(axis, angle);
}

function pickPattern(): CubeFragmentPattern {
  const keys = Object.keys(CUBE_FRAGMENT_PATTERNS);
  if (keys.length === 0) {
    throw new Error('No cube fragment patterns defined');
  }
  const idx = Math.floor(Math.random() * keys.length);
  return CUBE_FRAGMENT_PATTERNS[keys[idx]];
}

function toWorldPosition(
  cubePos: Vector3,
  cubeSize: { sx: number; sy: number; sz: number },
  local: Vector3
): Vector3 {
  const scaled = new Vector3(local.x * cubeSize.sx, local.y * cubeSize.sy, local.z * cubeSize.sz);
  return cubePos.clone().add(scaled);
}

function jitterQuaternion(maxAngleRad: number): Quaternion {
  const axis = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  if (axis.lengthSq() === 0) {
    axis.set(0, 1, 0);
  }
  axis.normalize();
  const angle = Math.random() * maxAngleRad;
  return new Quaternion().setFromAxisAngle(axis, angle);
}

function computeUvRectForPolygon(face: CubeFace, vertices: Vector3[]): Fragment['uvRect'] | undefined {
  if (face !== CubeFace.Front) {
    return undefined;
  }
  const rect = DEFAULT_FACE_UV_RECTS[CubeFace.Front];
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  vertices.forEach((v) => {
    const sx = v.x + 0.5;
    const sy = v.y + 0.5;
    const u = rect.u0 + sx * (rect.u1 - rect.u0);
    const vv = rect.v0 + (1 - sy) * (rect.v1 - rect.v0);
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, vv);
    v1 = Math.max(v1, vv);
  });
  return { u0, u1, v0, v1 };
}

function spawnFragmentsForCubeV1(
  cube: RowDestructionSim['cubes'][number],
  cubeSize: RowDestructionSim['cubeSize'],
  pattern: CubeFragmentPattern,
  preset: RowDestructionSim['preset']
): Fragment[] {
  const fragments: Fragment[] = [];
  const towerCenter = new Vector3(0, 0, 0);
  const materialByKind: Record<FragmentKind, Fragment['materialId']> = {
    faceShard: 'face',
    edgeShard: 'gold',
    coreShard: 'inner',
    dust: 'dust',
  };

  for (const tpl of pattern) {
    const kindConfig = FRAGMENT_KIND_INITIAL_CONFIG[tpl.kind];
    const position = toWorldPosition(cube.worldPos, cubeSize, tpl.localPosition);
    const radialSpeed =
      randomInRange(preset.radialSpeed.min, preset.radialSpeed.max) *
      randomInRange(kindConfig.radialSpeed[0], kindConfig.radialSpeed[1]);
    const tangentialSpeed =
      randomInRange(preset.tangentialSpeed.min, preset.tangentialSpeed.max) *
      randomInRange(kindConfig.tangentialSpeed[0], kindConfig.tangentialSpeed[1]);
    const velocity = composeInitialVelocity(cube.worldPos, towerCenter, {
      radialSpeed,
      tangentialSpeed,
    }).add(
      new Vector3(
        0,
        randomInRange(preset.verticalSpeed.min, preset.verticalSpeed.max) *
          randomInRange(kindConfig.verticalSpeed[0], kindConfig.verticalSpeed[1]),
        0
      )
    );

    const rotation = tpl.localRotation.clone().multiply(jitterQuaternion(kindConfig.rotationJitterRad));
    const scaleJitter = randomInRange(kindConfig.scaleJitter[0], kindConfig.scaleJitter[1]);
    const scale = tpl.localScale.clone().multiplyScalar(scaleJitter);
    const colorTint = randomInRange(kindConfig.colorTint[0], kindConfig.colorTint[1]);
    const materialId = materialByKind[tpl.kind];

    const fragment = createFragment({
      kind: tpl.kind,
      shardId: tpl.id,
      position,
      velocity,
      rotation,
      scale,
      angularVelocity: generateAngularVelocity(materialId),
      lifetimeMs: Math.floor(
        randomInRange(preset.lifetimeMs.min, preset.lifetimeMs.max) *
          randomInRange(kindConfig.lifetimeMs[0], kindConfig.lifetimeMs[1])
      ),
      instanceId: fragments.length,
      materialId,
      uvRect: tpl.uvRect,
      colorTint,
    });
    fragments.push(fragment);
  }

  return fragments;
}

function spawnFragmentsFromShardTemplates(
  cube: RowDestructionSim['cubes'][number],
  cubeSize: RowDestructionSim['cubeSize'],
  preset: RowDestructionSim['preset']
): Fragment[] {
  const fragments: Fragment[] = [];
  const towerCenter = new Vector3(0, 0, 0);
  const templates = getDefaultShardTemplateSet().templates;
  templates.forEach((tpl) => {
    const kind: FragmentKind = tpl.face === CubeFace.Front ? 'faceShard' : 'edgeShard';
    const kindConfig = FRAGMENT_KIND_INITIAL_CONFIG[kind];
    const localCenter = computeShardLocalCenter(tpl);
    const worldCenter = cube.worldPos.clone().add(
      new Vector3(localCenter.x * cubeSize.sx, localCenter.y * cubeSize.sy, localCenter.z * cubeSize.sz)
    );
    const radialSpeed =
      randomInRange(preset.radialSpeed.min, preset.radialSpeed.max) *
      randomInRange(kindConfig.radialSpeed[0], kindConfig.radialSpeed[1]);
    const tangentialSpeed =
      randomInRange(preset.tangentialSpeed.min, preset.tangentialSpeed.max) *
      randomInRange(kindConfig.tangentialSpeed[0], kindConfig.tangentialSpeed[1]);
    const velocity = composeInitialVelocity(cube.worldPos, towerCenter, {
      radialSpeed,
      tangentialSpeed,
    }).add(
      new Vector3(
        0,
        randomInRange(preset.verticalSpeed.min, preset.verticalSpeed.max) *
          randomInRange(kindConfig.verticalSpeed[0], kindConfig.verticalSpeed[1]),
        0
      )
    );
    const rotation = jitterQuaternion(kindConfig.rotationJitterRad);
    const scaleJitter = randomInRange(kindConfig.scaleJitter[0], kindConfig.scaleJitter[1]);
    const scale = new Vector3(1, 1, 1).multiplyScalar(scaleJitter);
    const colorTint = randomInRange(kindConfig.colorTint[0], kindConfig.colorTint[1]);
    const materialId: Fragment['materialId'] = tpl.face === CubeFace.Front ? 'face' : 'gold';
    const uvRect = computeUvRectForPolygon(
      tpl.face,
      tpl.polygon2D.vertices.map((v) => new Vector3(v.x, v.y, 0))
    );

    fragments.push(
      createFragment({
        kind,
        position: worldCenter,
        velocity,
        rotation,
        scale,
        angularVelocity: generateAngularVelocity(materialId),
        lifetimeMs: Math.floor(
          randomInRange(preset.lifetimeMs.min, preset.lifetimeMs.max) *
            randomInRange(kindConfig.lifetimeMs[0], kindConfig.lifetimeMs[1])
        ),
        instanceId: fragments.length,
        materialId,
        uvRect,
        colorTint,
        templateId: tpl.id,
        shardId: tpl.id,
      })
    );
  });
  return fragments;
}

function createFragmentsForCube(row: RowDestructionSim, cubeIndex: number): Fragment[] {
  const cube = row.cubes[cubeIndex];
  const preset = row.preset;
  // Всегда используем шардовые шаблоны (ultra_v2) для любых уровней качества.
  return spawnFragmentsFromShardTemplates(cube, row.cubeSize, preset);
}

/**
 * DY¥?D_DýDæ¥?¥?Dæ¥,, D'D_D¯DDæD« D¯D, ¥+DæD¯¥<D1 D§¥ŸDñ Dæ¥%¥` ¥?DæD«D'Dæ¥?D,¥,¥O¥?¥? (D'D_ ¥?¥,Dø¥?¥,Dø DýDú¥?¥<DýDø ¥?D¯D_¥, D«Dæ D«Dø¥ØD,D«DøD¯ ¥?D,D¬¥ŸD¯¥?¥+D,¥Z).
 */
export function shouldRenderWholeCube(row: RowDestructionSim, cubeIndex: number): boolean {
  const slot = getSlotForCube(row, cubeIndex);
  if (!slot) {
    return true;
  }
  return slot.started !== true;
}

/**
 * D-DøD¨¥Ÿ¥?D§DøDæ¥, DýDú¥?¥<Dý D§¥ŸDñDø: D¨D_D¬Dæ¥ØDøDæ¥, ¥?D¯D_¥, started, ¥?D_DúD'Dø¥`¥, ¥?D,D¬¥ŸD¯¥?¥+D,¥Z D§¥ŸDñDø ¥? D¨¥Ÿ¥?¥,¥<D¬D, ¥,¥?DøD3D¬DæD«¥,DøD¬D,
 * (¥,¥?DøD3D¬DæD«¥,¥< Dñ¥ŸD'¥Ÿ¥, ¥?D3DæD«Dæ¥?D,¥?D_DýDøD«¥< D«Dø ¥^DøD3Dæ 12.5).
 */
export function startCubeExplosion(
  row: RowDestructionSim,
  cubeIndex: number,
  startedAtMs: number
): CubeDestructionSim {
  const slot = getSlotForCube(row, cubeIndex);
  if (!slot) {
    throw new Error(`No explosion slot for cube index ${cubeIndex}`);
  }
  const cube = row.cubes[cubeIndex];
  if (!cube) {
    throw new Error(`Cube index ${cubeIndex} out of range for level ${row.level}`);
  }
  slot.started = true;
  const fragments = createFragmentsForCube(row, cubeIndex);
  return createCubeDestructionSim(cube, fragments, startedAtMs, false);
}
