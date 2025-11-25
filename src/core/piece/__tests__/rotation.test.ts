import { describe, expect, it } from 'vitest';
import { getPieceBlocks } from '../orientations';
import { rotateOrientation } from '../rotation';
import { PieceOrientation, PieceType, RotationDirection } from '../../types';

describe('piece rotation', () => {
  it('cycles orientations clockwise and counter-clockwise', () => {
    expect(rotateOrientation(PieceOrientation.Deg0, RotationDirection.Clockwise)).toBe(
      PieceOrientation.Deg90
    );
    expect(rotateOrientation(PieceOrientation.Deg90, RotationDirection.Clockwise)).toBe(
      PieceOrientation.Deg180
    );
    expect(rotateOrientation(PieceOrientation.Deg270, RotationDirection.Clockwise)).toBe(
      PieceOrientation.Deg0
    );

    expect(rotateOrientation(PieceOrientation.Deg0, RotationDirection.CounterClockwise)).toBe(
      PieceOrientation.Deg270
    );
    expect(rotateOrientation(PieceOrientation.Deg270, RotationDirection.CounterClockwise)).toBe(
      PieceOrientation.Deg180
    );
    expect(rotateOrientation(PieceOrientation.Deg180, RotationDirection.CounterClockwise)).toBe(
      PieceOrientation.Deg90
    );
  });

  it('preserves block count across orientations', () => {
    const orientations = [
      PieceOrientation.Deg0,
      PieceOrientation.Deg90,
      PieceOrientation.Deg180,
      PieceOrientation.Deg270,
    ];
    const types = [PieceType.I, PieceType.T, PieceType.S, PieceType.Z, PieceType.J, PieceType.L];

    for (const type of types) {
      const counts = orientations.map((o) => getPieceBlocks(type, o).length);
      expect(new Set(counts).size).toBe(1);
      expect(counts[0]).toBe(4);
    }
  });

  it('keeps shape stable for O piece', () => {
    const base = getPieceBlocks(PieceType.O, PieceOrientation.Deg0);
    expect(getPieceBlocks(PieceType.O, PieceOrientation.Deg90)).toEqual(base);
    expect(getPieceBlocks(PieceType.O, PieceOrientation.Deg180)).toEqual(base);
    expect(getPieceBlocks(PieceType.O, PieceOrientation.Deg270)).toEqual(base);
  });
});
