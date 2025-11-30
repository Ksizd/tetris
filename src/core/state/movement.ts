import { GameState } from './gameState';
import { CellCoord, CellContent, PieceOrientation, RotationDirection } from '../types';
import { rotateOrientation, getWorldBlocks } from '../piece';

export interface MoveRequest {
  dx: number;
  dy: number;
  rotation: number; // steps of 90°: -1, 0, +1, etc.
}

export type MoveBlockReason = 'out_of_bounds' | 'occupied';

export interface MoveResult {
  state: GameState;
  moved: boolean;
  reason?: MoveBlockReason;
  cells?: CellCoord[];
}

/**
 * Single entry point for piece movement (translation + rotation) in the domain layer.
 */
export function tryMovePiece(state: GameState, move: MoveRequest): MoveResult {
  const piece = state.currentPiece;
  if (!piece) {
    return { state, moved: false };
  }

  const normalizedRotation = normalizeRotationSteps(move.rotation);
  const nextOrientation = applyRotationSteps(piece.orientation, normalizedRotation);
  const candidate = {
    ...piece,
    orientation: nextOrientation,
    position: {
      x: piece.position.x + move.dx,
      y: piece.position.y + move.dy,
    },
  };

  const dimensions = state.board.getDimensions();
  const blocks = getWorldBlocks(candidate, dimensions);
  const outOfBounds = blocks.filter((cell) => cell.y < 0 || cell.y >= dimensions.height);
  if (outOfBounds.length > 0) {
    return { state, moved: false, reason: 'out_of_bounds', cells: outOfBounds };
  }

  const overlapping = blocks.filter((cell) => {
    if (state.board.getCell(cell) !== CellContent.Empty) {
      return true;
    }
    if (piece.position.y === 0 && cell.y - 1 >= 0) {
      const below = { x: cell.x, y: cell.y - 1 };
      if (state.board.getCell(below) !== CellContent.Empty) {
        return true;
      }
    }
    return false;
  });
  if (overlapping.length > 0) {
    return { state, moved: false, reason: 'occupied', cells: overlapping };
  }

  return {
    state: { ...state, currentPiece: candidate },
    moved: true,
  };
}

/**
 * Convenience wrapper for pure translation via the unified movement path.
 */
export function tryTranslatePiece(state: GameState, dx: number, dy: number): MoveResult {
  return tryMovePiece(state, { dx, dy, rotation: 0 });
}

function normalizeRotationSteps(raw: number): number {
  if (!Number.isFinite(raw)) {
    return 0;
  }
  // reduce to -3..3 to avoid excessive loops; 4 steps = full turn
  const mod = ((Math.round(raw) % 4) + 4) % 4;
  return mod > 2 ? mod - 4 : mod;
}

function applyRotationSteps(orientation: PieceOrientation, steps: number): PieceOrientation {
  let result = orientation;
  const dir = steps >= 0 ? RotationDirection.Clockwise : RotationDirection.CounterClockwise;
  for (let i = 0; i < Math.abs(steps); i += 1) {
    result = rotateOrientation(result, dir);
  }
  return result;
}
