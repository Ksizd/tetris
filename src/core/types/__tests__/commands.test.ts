import { describe, expect, it } from 'vitest';
import { ALL_GAME_COMMAND_TYPES, GameCommandType } from '../commands';

describe('GameCommand definitions', () => {
  it('contains all command types without duplicates', () => {
    const set = new Set(ALL_GAME_COMMAND_TYPES);
    expect(set.size).toBe(ALL_GAME_COMMAND_TYPES.length);
    expect(set.has(GameCommandType.MoveLeft)).toBe(true);
    expect(set.has(GameCommandType.TogglePause)).toBe(true);
  });
});
