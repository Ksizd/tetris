import { Board } from '../../core/board';
import { CellContent } from '../../core/types';
import { BoardToWorldMapper, CubeVisual } from '../../render';
import { GameEvent, GameEventType } from '../events';
import { createLineDestructionScenario, LineDestructionScenario } from './lineDestructionScenario';
import { buildLinearExplosionWave } from './waveBuilder';
import { createCubeExplosionSlot, RowDestructionSim } from './rowDestructionSim';
import { createDestructionSimulationState, DestructionSimulationState } from './destructionSimulationState';
import { ULTRA_DESTRUCTION_PRESET, DestructionPreset } from './destructionPresets';

export interface StartLineDestructionParams {
  board: Board;
  mapper: BoardToWorldMapper;
  levels: number[];
  startedAtMs: number;
  delayBetweenCubesMs?: number;
  preset?: DestructionPreset;
}

export interface StartLineDestructionResult {
  event: Extract<GameEvent, { type: GameEventType.StartLineDestruction }>;
  scenario: LineDestructionScenario;
  simulation: DestructionSimulationState;
}

const DEFAULT_DELAY_MS = 45;

function collectCubesForLevel(board: Board, mapper: BoardToWorldMapper, level: number): CubeVisual[] {
  const { width, height } = board.getDimensions();
  if (level < 0 || level >= height) {
    throw new RangeError(`Level ${level} is outside of board bounds [0, ${height - 1}]`);
  }
  const cubes: CubeVisual[] = [];
  for (let x = 0; x < width; x += 1) {
    if (board.getCell({ x, y: level }) === CellContent.Block) {
      cubes.push({
        id: { x, y: level },
        worldPos: mapper.cellToWorldPosition(x, level),
      });
    }
  }
  return cubes;
}

function buildRowSimulation(
  board: Board,
  mapper: BoardToWorldMapper,
  level: number,
  startedAtMs: number,
  delayBetweenCubesMs: number,
  preset: DestructionPreset
): RowDestructionSim {
  const cubes = collectCubesForLevel(board, mapper, level);
  const explosions =
    delayBetweenCubesMs > 0
      ? buildLinearExplosionWave({
          cubes,
          globalStartMs: startedAtMs,
          delayBetweenCubesMs,
        })
      : cubes.map((_, idx) => createCubeExplosionSlot(idx, startedAtMs));

  return {
    level,
    cubes,
    explosions,
    allCubesExploded: false,
    cubeSize: {
      sx: mapper.getBlockSize(),
      sy: mapper.getBlockSize(),
      sz: mapper.getBlockDepth(),
    },
    preset,
  };
}

export function startLineDestructionFromBoard(
  params: StartLineDestructionParams
): StartLineDestructionResult {
  const { board, mapper, levels, startedAtMs } = params;
  const delayBetweenCubesMs = params.delayBetweenCubesMs ?? DEFAULT_DELAY_MS;
  const preset = params.preset ?? ULTRA_DESTRUCTION_PRESET;
  if (delayBetweenCubesMs <= 0) {
    throw new Error('delayBetweenCubesMs must be positive');
  }
  if (levels.length === 0) {
    throw new Error('At least one level must be provided to start line destruction');
  }

  const normalizedLevels = Array.from(new Set(levels));
  const scenario = createLineDestructionScenario(normalizedLevels, startedAtMs);

  normalizedLevels.forEach((level) => {
    const row = buildRowSimulation(board, mapper, level, startedAtMs, delayBetweenCubesMs, preset);
    scenario.perLevel.set(level, row);
  });

  const simulation = createDestructionSimulationState(scenario);
  const event: Extract<GameEvent, { type: GameEventType.StartLineDestruction }> = {
    type: GameEventType.StartLineDestruction,
    clearedLevels: normalizedLevels,
  };

  return {
    event,
    scenario,
    simulation,
  };
}

export function getDefaultDestructionDelayMs(): number {
  return DEFAULT_DELAY_MS;
}
