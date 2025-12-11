import { HallLayoutRadii } from '../hallLayout';
import { PlatformLayout } from '../platformLayout';
import { HallGeometrySnapshot } from './hallGeometrySnapshot';
import { HallGeometryViolation } from './hallGeometryMonitor';

export interface HallGeometryFrameLog {
  type: 'hall_geometry_snapshot';
  engineVersion: string;
  hallLayout: HallLayoutRadii;
  platformLayout: PlatformLayout;
  objects: HallGeometrySnapshot['towerCells'];
  violations: HallGeometryViolation[];
}

export function buildHallGeometryFrameLog(params: {
  hallLayout: HallLayoutRadii;
  platformLayout: PlatformLayout;
  snapshot: HallGeometrySnapshot;
  violations: HallGeometryViolation[];
  engineVersion?: string;
}): HallGeometryFrameLog {
  return {
    type: 'hall_geometry_snapshot',
    engineVersion: params.engineVersion ?? 'dev',
    hallLayout: params.hallLayout,
    platformLayout: params.platformLayout,
    objects: [
      ...params.snapshot.towerCells,
      ...params.snapshot.platformRings,
      ...params.snapshot.platformSides,
      ...params.snapshot.footprints,
      ...params.snapshot.hallFloor,
      ...params.snapshot.hallShells,
      ...params.snapshot.hallColumns,
      ...params.snapshot.others,
    ],
    violations: params.violations,
  };
}

export function buildHallBugTemplate(report: string): string {
  return [
    'Когда глючит платформа/footprint:',
    '1) Запусти HallGeometryLab и нажми "Run geometry analysis".',
    '2) Скопируй HALL_GEOMETRY_REPORT или JSON snapshot.',
    '3) Отправь это Codex\'у/ИИ и попроси исправить геометрию так, чтобы все инварианты были зелёными.',
    '',
    '--- Report ---',
    report,
  ].join('\n');
}
