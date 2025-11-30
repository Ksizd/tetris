import { Board } from '../board';
import { CellContent, CellCoord } from '../types';
import { getWorldBlocks } from '../piece';
import { GameState } from './gameState';

export const DOMAIN_INVARIANTS = {
  noOverlap: 'Active piece cells never occupy already filled board cells.',
  withinBounds: 'Active piece cells never leave board bounds on any axis.',
  atomicMoves:
    'Each simulation step (gravity, soft drop, player move) yields either a new valid position or no position change at all.',
  renderAligned:
    'The rendered piece corresponds to a valid logical position along a path between two valid positions, never showing an invalid position.',
} as const;

export type DomainInvariantKey = keyof typeof DOMAIN_INVARIANTS;

export interface InvariantViolation {
  key: DomainInvariantKey;
  message: string;
  cells?: CellCoord[];
}

/**
 * Validates core invariants that can be checked from the current game state (overlap and bounds).
 * Remaining invariants (atomicMoves, renderAligned) are declared above and must be upheld by callers.
 */
export function validateGameStateInvariants(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  if (!state.currentPiece) {
    return violations;
  }
  const board = state.board;
  const dimensions = board.getDimensions();
  const blocks = getWorldBlocks(state.currentPiece, dimensions);

  const outOfBounds = blocks.filter((cell) => cell.y < 0 || cell.y >= dimensions.height);
  if (outOfBounds.length > 0) {
    violations.push({
      key: 'withinBounds',
      message: 'Active piece cells are outside board bounds.',
      cells: outOfBounds,
    });
  }

  const overlapping = blocks.filter((cell) => isOccupied(board, cell));
  if (overlapping.length > 0) {
    violations.push({
      key: 'noOverlap',
      message: 'Active piece cells overlap filled board cells.',
      cells: overlapping,
    });
  }

  return violations;
}

export function assertGameStateInvariants(state: GameState): void {
  const violations = validateGameStateInvariants(state);
  if (violations.length > 0) {
    const description = violations
      .map((v) => `[${v.key}] ${v.message} cells=${JSON.stringify(v.cells ?? [])}`)
      .join('; ');
    throw new Error(`Domain invariants violated: ${description}`);
  }
}

function isOccupied(board: Board, cell: CellCoord): boolean {
  try {
    return board.getCell(cell) !== CellContent.Empty;
  } catch {
    return true;
  }
}
