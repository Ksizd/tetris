import { GameState } from '../core/state/gameState';
import { renderBoard } from './boardRenderer';
import { renderActivePiece } from './activePieceRenderer';
import { RenderContext } from './renderer';
import { canMove } from '../core/collision';
import { applyFragmentInstanceUpdates } from './destruction/instanceUpdater';
import { FragmentInstancedResources } from './destruction/fragmentInstancedMesh';
import { FragmentBucket } from '../app/destruction/destructionRuntime';
import { updateGameCamera, CameraFollowState } from './cameraMotion';

export type SceneRenderContext = Pick<
  RenderContext,
  | 'board'
  | 'activePiece'
  | 'mapper'
  | 'renderConfig'
  | 'fragments'
  | 'camera'
  | 'towerBounds'
  | 'cameraBasePlacement'
>;

export interface SceneDestructionPayload {
  hiddenCells?: Set<string>;
  fragmentBuckets?: Map<number, FragmentBucket>;
}

export function renderScene(
  ctx: SceneRenderContext,
  snapshot: Readonly<GameState>,
  destruction?: SceneDestructionPayload,
  cameraFollow?: CameraFollowState | null,
  deltaMs?: number
): void {
  if (cameraFollow?.enabled) {
    updateGameCamera(ctx.camera, ctx.cameraBasePlacement, ctx.towerBounds, cameraFollow, deltaMs ?? 0);
    ctx.renderConfig.camera.position.copy(ctx.camera.position);
    ctx.renderConfig.camera.target.set(
      ctx.towerBounds.center.x,
      ctx.cameraBasePlacement.target.y,
      ctx.towerBounds.center.z
    );
  }
  renderBoard({
    board: snapshot.board,
    instanced: ctx.board,
    mapper: ctx.mapper,
    hiddenCells: destruction?.hiddenCells,
  });
  const offsetY = computeActivePieceOffset(snapshot, ctx.renderConfig.board.verticalSpacing);
  renderActivePiece({
    piece: snapshot.currentPiece,
    instanced: ctx.activePiece,
    mapper: ctx.mapper,
    offsetY,
  });
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

  buckets.forEach((bucket, templateId) => {
    const mesh = resources.meshesByTemplate.get(templateId);
    if (!mesh) {
      return;
    }
    const matId = resources.templateMaterial.get(templateId) ?? bucket.materialId;
    const base = resources.materials[matId]?.color;
    if (!base) {
      return;
    }
    const capped = bucket.updates.slice(0, resources.capacityPerTemplate);
    mesh.count = capped.length;
    mesh.visible = capped.length > 0;
    if (capped.length === 0) {
      return;
    }
    applyFragmentInstanceUpdates(mesh, capped, {
      r: base.r,
      g: base.g,
      b: base.b,
    });
  });
}
