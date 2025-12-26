import { GameState } from '../core/state/gameState';
import { renderBoard } from './boardRenderer';
import { renderActivePiece } from './activePieceRenderer';
import { RenderContext } from './renderer';
import { canMove } from '../core/collision';
import { applyFragmentInstanceUpdates } from './destruction/instanceUpdater';
import { FragmentInstancedResources } from './destruction/fragmentInstancedMesh';
import { FragmentBucket } from '../app/destruction/destructionRuntime';
import { updateGameCamera, CameraFollowState } from './cameraMotion';
import { CellCoord } from '../core/types';
import * as THREE from 'three';
import { updateGoldenHallFx } from './goldenHallScene';
import { updateFootprintLavaSparksFx } from './footprintLavaSparksFx';
import { updateFootprintLavaSmokeFx } from './footprintLavaSmokeFx';

export type SceneRenderContext = Pick<
  RenderContext,
  | 'board'
  | 'activePiece'
  | 'ghost'
  | 'mapper'
  | 'renderConfig'
  | 'fragments'
  | 'camera'
  | 'clock'
  | 'towerBounds'
  | 'hallLayout'
  | 'cameraBasePlacement'
  | 'goldenHall'
  | 'goldenPlatform'
>;

export interface SceneDestructionPayload {
  hiddenCells?: Set<string>;
  fragmentBuckets?: Map<number, FragmentBucket>;
}

export interface GhostRenderState {
  cells: CellCoord[];
  visible: boolean;
}

export function renderScene(
  ctx: SceneRenderContext,
  snapshot: Readonly<GameState>,
  destruction?: SceneDestructionPayload,
  cameraFollow?: CameraFollowState | null,
  deltaMs?: number,
  ghost?: GhostRenderState | null
): void {
  const clockDtSec = ctx.clock.getDelta();
  const timeSeconds = ctx.clock.elapsedTime;
  const footprintTimeSeconds = ctx.renderConfig.disableFootprintLavaAnimation ? 0 : timeSeconds;
  ctx.goldenPlatform?.update(footprintTimeSeconds);
  if (cameraFollow?.enabled) {
    updateGameCamera(ctx.camera, ctx.cameraBasePlacement, ctx.towerBounds, cameraFollow, deltaMs ?? 0);
    ctx.renderConfig.camera.position.copy(ctx.camera.position);
    ctx.renderConfig.camera.target.set(
      ctx.towerBounds.center.x,
      ctx.cameraBasePlacement.target.y,
      ctx.towerBounds.center.z
    );
  }
  const sparksFx = ctx.goldenPlatform?.footprintSparksFx ?? null;
  const smokeFx = ctx.goldenPlatform?.footprintSmokeFx ?? null;
  if (sparksFx || smokeFx) {
    const dtSec =
      ctx.renderConfig.disableFootprintLavaAnimation
        ? 0
        : Number.isFinite(deltaMs) && deltaMs > 0
          ? deltaMs / 1000
          : clockDtSec;
    if (sparksFx) {
      updateFootprintLavaSparksFx(sparksFx, dtSec, footprintTimeSeconds, ctx.camera);
    }
    if (smokeFx) {
      updateFootprintLavaSmokeFx(smokeFx, dtSec, footprintTimeSeconds, ctx.camera);
    }
  }
  renderBoard({
    board: snapshot.board,
    instanced: ctx.board,
    mapper: ctx.mapper,
    hiddenCells: destruction?.hiddenCells,
  });
  updateGoldenHallFx(ctx.goldenHall, deltaMs ?? 0);
  const offsetY = computeActivePieceOffset(snapshot, ctx.renderConfig.board.verticalSpacing);
  renderActivePiece({
    piece: snapshot.currentPiece,
    instanced: ctx.activePiece,
    mapper: ctx.mapper,
    offsetY,
  });
  renderGhost(ctx, ghost);
  renderFragments(ctx.fragments ?? null, destruction?.fragmentBuckets);
}

function computeActivePieceOffset(snapshot: Readonly<GameState>, verticalSpacing: number): number {
  if (!snapshot.currentPiece) {
    return 0;
  }
  if (snapshot.fallState?.landed) {
    return 0;
  }
  const canFall = canMove(snapshot.board, snapshot.currentPiece, 0, -1);
  if (!canFall) {
    return 0;
  }
  const { fallProgressMs, fallIntervalMs } = snapshot.timing;
  if (fallIntervalMs <= 0) {
    return 0;
  }
  const t = Math.min(1, Math.max(0, fallProgressMs / fallIntervalMs));
  return -t * verticalSpacing;
}

function renderFragments(
  resources: FragmentInstancedResources | null,
  buckets?: Map<number, FragmentBucket>
): void {
  if (!resources || buckets === undefined) {
    return;
  }
  resources.meshesByTemplate.forEach((mesh) => {
    mesh.count = 0;
    mesh.visible = false;
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (!buckets || buckets.size === 0) {
    return;
  }

  const fallbackTemplateByMaterial = new Map<string, number>();
  resources.templateMaterial.forEach((materialId, tplId) => {
    if (!fallbackTemplateByMaterial.has(materialId)) {
      fallbackTemplateByMaterial.set(materialId, tplId);
    }
  });

  const aggregated = new Map<
    number,
    {
      mesh: THREE.InstancedMesh;
      materialId: string;
      color: { r: number; g: number; b: number };
      updates: typeof buckets extends Map<any, infer V> ? V['updates'] : never;
    }
  >();

  buckets.forEach((bucket, templateId) => {
    const materialId = resources.templateMaterial.get(templateId) ?? bucket.materialId;
    const material =
      resources.materials[materialId] ??
      resources.materials.gold ??
      Object.values(resources.materials)[0];
    if (!material) {
      return;
    }
    let targetTemplate = templateId;
    let mesh = resources.meshesByTemplate.get(targetTemplate);
    if (!mesh) {
      const fallbackTpl =
        fallbackTemplateByMaterial.get(materialId) ?? fallbackTemplateByMaterial.get('gold');
      if (fallbackTpl === undefined) {
        return;
      }
      targetTemplate = fallbackTpl;
      mesh = resources.meshesByTemplate.get(targetTemplate);
      if (!mesh) {
        return;
      }
    }

    const entry =
      aggregated.get(targetTemplate) ??
      (() => {
        const created = {
          mesh,
          materialId,
          color: material.color,
          updates: [] as typeof bucket.updates,
        };
        aggregated.set(targetTemplate, created);
        return created;
      })();

    bucket.updates.forEach((update) => {
      entry.updates.push({
        ...update,
        instanceId: entry.updates.length,
      });
    });
  });

  aggregated.forEach((entry) => {
    const capacity =
      (entry.mesh.userData?.capacity as number | undefined) ?? resources.capacityPerTemplate;
    const capped = entry.updates.slice(0, capacity);
    entry.mesh.count = capped.length;
    entry.mesh.visible = capped.length > 0;
    if (capped.length === 0) {
      return;
    }
    applyFragmentInstanceUpdates(entry.mesh, capped, {
      r: entry.color?.r ?? 1,
      g: entry.color?.g ?? 0.9,
      b: entry.color?.b ?? 0.4,
    });
  });
}

function renderGhost(ctx: SceneRenderContext, ghost?: GhostRenderState | null): void {
  if (!ctx.ghost) {
    return;
  }
  const targetMesh = ctx.ghost.mesh;
  if (!ghost?.visible || !ghost.cells?.length) {
    targetMesh.count = 0;
    targetMesh.instanceMatrix.needsUpdate = true;
    targetMesh.visible = false;
    return;
  }
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  let idx = 0;
  ghost.cells.slice(0, ctx.ghost.capacity).forEach((cell) => {
    const worldPos = ctx.mapper.cellToWorldPosition(cell.x, cell.y, {
      allowOverflowY: cell.y >= ctx.mapper.getDimensions().height,
    });
    ctx.mapper.getRadialOrientation(cell.x, rotation);
    matrix.compose(worldPos, rotation, scale);
    targetMesh.setMatrixAt(idx, matrix);
    idx += 1;
  });
  targetMesh.count = idx;
  targetMesh.instanceMatrix.needsUpdate = true;
  targetMesh.visible = idx > 0;
}
