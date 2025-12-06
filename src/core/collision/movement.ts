import { Board } from '../board';
import { ActivePiece, RotationDirection } from '../types';
import { canPlacePiece } from './canPlacePiece';
import { rotateOrientation } from '../piece';

/**
 * Проверяет возможность смещения фигуры на dx, dy.
 */
export function canMove(board: Board, piece: ActivePiece, dx: number, dy: number): boolean {
  const moved: ActivePiece = {
    ...piece,
    position: { x: piece.position.x + dx, y: piece.position.y + dy },
  };
  return canPlacePiece(board, moved);
}

/**
 * Проверяет возможность вращения фигуры (простое вращение без wall-kick).
 */
export function canRotate(board: Board, piece: ActivePiece, direction: RotationDirection): boolean {
  const rotated: ActivePiece = {
    ...piece,
    orientation: rotateOrientation(piece.orientation, direction),
  };
  return canPlacePiece(board, rotated);
}

/**
 * Returns true if the piece cannot move one cell down (y - 1) without collision.
 */
export function isGrounded(board: Board, piece: ActivePiece): boolean {
  return !canMove(board, piece, 0, -1);
}
