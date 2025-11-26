import { GameState } from '../core/state/gameState';
import { renderBoard } from './boardRenderer';
import { renderActivePiece } from './activePieceRenderer';
import { RenderContext } from './renderer';

export type SceneRenderContext = Pick<
  RenderContext,
  'board' | 'activePiece' | 'mapper' | 'renderConfig'
>;

export function renderScene(ctx: SceneRenderContext, snapshot: Readonly<GameState>): void {
  renderBoard({ board: snapshot.board, instanced: ctx.board, mapper: ctx.mapper });
  const offsetY = computeActivePieceOffset(snapshot, ctx.renderConfig.verticalSpacing);
  renderActivePiece({
    piece: snapshot.currentPiece,
    instanced: ctx.activePiece,
    mapper: ctx.mapper,
    offsetY,
  });
}

function computeActivePieceOffset(snapshot: Readonly<GameState>, verticalSpacing: number): number {
  if (!snapshot.currentPiece) {
    return 0;
  }
  const { fallProgressMs, fallIntervalMs } = snapshot.timing;
  if (fallIntervalMs <= 0) {
    return 0;
  }
  const t = Math.min(1, Math.max(0, fallProgressMs / fallIntervalMs));
  return -t * verticalSpacing;
}
