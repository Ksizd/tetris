import { VolumeCell } from './coreVolumeCells';

export interface CoreShardCluster {
  id: number;
  cells: VolumeCell[];
}

export interface CoreShardClusterOptions {
  random?: () => number;
  minSize?: number;
  maxSize?: number;
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function areNeighbors(a: VolumeCell, b: VolumeCell): boolean {
  const dx = Math.abs(a.center.x - b.center.x);
  const dy = Math.abs(a.center.y - b.center.y);
  const dz = Math.abs(a.center.z - b.center.z);
  const base = Math.max(a.sizeHint.x, a.sizeHint.y, a.sizeHint.z, b.sizeHint.x, b.sizeHint.y, b.sizeHint.z);
  const sameAxis = (v: number) => v < base * 0.65;
  const nearAxis = (v: number) => v < base * 1.35;
  const closeCount = [dx, dy, dz].filter(sameAxis).length;
  return closeCount >= 2 && nearAxis(Math.max(dx, dy, dz));
}

export function buildCoreShardClusters(cells: VolumeCell[], options: CoreShardClusterOptions = {}): CoreShardCluster[] {
  if (cells.length === 0) {
    return [];
  }
  const rnd = options.random ?? Math.random;
  const minSize = Math.max(2, Math.floor(options.minSize ?? 3));
  const maxSize = Math.max(minSize, Math.floor(options.maxSize ?? 6));
  const pool = shuffle(cells, rnd);
  const clusters: CoreShardCluster[] = [];
  let cursor = 0;

  while (cursor < pool.length) {
    const seed = pool[cursor];
    cursor += 1;
    if (!seed) break;
    const targetSize = Math.min(
      maxSize,
      Math.max(minSize, Math.floor(minSize + rnd() * (maxSize - minSize + 1)))
    );
    const clusterCells: VolumeCell[] = [seed];
    const queue: VolumeCell[] = [seed];

    while (queue.length > 0 && clusterCells.length < targetSize) {
      const current = queue.shift();
      if (!current) break;
      for (let i = cursor; i < pool.length && clusterCells.length < targetSize; i += 1) {
        const candidate = pool[i];
        if (areNeighbors(current, candidate)) {
          clusterCells.push(candidate);
          queue.push(candidate);
          pool.splice(i, 1);
          i -= 1;
        }
      }
    }

    while (clusterCells.length < minSize && cursor < pool.length) {
      clusterCells.push(pool[cursor]);
      cursor += 1;
    }

    if (clusterCells.length < minSize && clusters.length > 0) {
      const donor = [...clusters].reverse().find((c) => c.cells.length > minSize);
      if (donor) {
        const needed = minSize - clusterCells.length;
        const moved = donor.cells.splice(donor.cells.length - needed, needed);
        clusterCells.push(...moved);
      } else {
        clusters[clusters.length - 1].cells.push(...clusterCells);
        continue;
      }
    }

    clusters.push({ id: clusters.length, cells: clusterCells });
  }

  return clusters;
}

export function validateClusters(cells: VolumeCell[], clusters: CoreShardCluster[]): { ok: boolean; reason?: string } {
  const seen = new Set<number>();
  clusters.forEach((cl) => {
    cl.cells.forEach((cell) => {
      seen.add(cell.id);
    });
  });
  if (seen.size !== cells.length) {
    return { ok: false, reason: 'not all cells covered or duplicates exist' };
  }
  return { ok: true };
}
