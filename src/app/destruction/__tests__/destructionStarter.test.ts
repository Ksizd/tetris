import { describe, expect, it } from 'vitest';
import { Board } from '../../../core/board';
import { CellContent } from '../../../core/types';
import { BoardToWorldMapper } from '../../../render';
import { GameEventType } from '../../events';
import {
  getDefaultDestructionDelayMs,
  startLineDestructionFromBoard,
} from '../destructionStarter';

describe('startLineDestructionFromBoard', () => {
  it('builds event, scenario and simulation state from board and mapper', () => {
    const board = Board.createEmpty({ width: 3, height: 4 });
    board.setCell({ x: 0, y: 1 }, CellContent.Block);
    board.setCell({ x: 2, y: 1 }, CellContent.Block);
    board.setCell({ x: 1, y: 2 }, CellContent.Block);
    const mapper = new BoardToWorldMapper(board.getDimensions());
    const startedAtMs = 500;

    const result = startLineDestructionFromBoard({
      board,
      mapper,
      levels: [1, 1, 2],
      startedAtMs,
    });

    expect(result.event.type).toBe(GameEventType.StartLineDestruction);
    expect(result.event.clearedLevels).toEqual([1, 2]);
    expect(result.scenario.levels).toEqual([1, 2]);

    const row1 = result.scenario.perLevel.get(1);
    const row2 = result.scenario.perLevel.get(2);
    expect(row1?.cubes).toHaveLength(2);
    expect(row2?.cubes).toHaveLength(1);
    expect(row1?.explosions).toHaveLength(2);
    expect(row2?.explosions).toHaveLength(1);

    const expectedDelay = getDefaultDestructionDelayMs();
    expect(row1?.explosions[0].startTimeMs).toBe(startedAtMs);
    expect(row1?.explosions[1].startTimeMs).toBe(startedAtMs + expectedDelay);

    const expectedPos = mapper.cellToWorldPosition(0, 1);
    expect(row1?.cubes[0].worldPos.equals(expectedPos)).toBe(true);
    expect(result.simulation.activeCubes).toHaveLength(0);
    expect(result.simulation.rows.startedAtMs).toBe(startedAtMs);
    expect(result.simulation.rows.finished).toBe(false);
  });
});
