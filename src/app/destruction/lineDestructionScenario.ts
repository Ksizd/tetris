import { RowDestructionSim } from './rowDestructionSim';

/**
 * Сценарий разрушения линий в визуальном слое: хранит уровни, по которым нужно запустить
 * симуляцию, расписание по уровням и базовые флаги времени/завершения.
 */
export interface LineDestructionScenario {
  levels: number[];
  perLevel: Map<number, RowDestructionSim>;
  startedAtMs: number;
  finished: boolean;
}

export function createLineDestructionScenario(
  levels: number[],
  startedAtMs: number
): LineDestructionScenario {
  return {
    levels: [...levels],
    perLevel: new Map<number, RowDestructionSim>(),
    startedAtMs,
    finished: false,
  };
}
