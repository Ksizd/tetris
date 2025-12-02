export interface FragmentStyleWeights {
  smallCubes: number;
  plates: number;
  innerChunks: number;
}

export interface FragmentAllocation {
  smallCubes: number;
  plates: number;
  innerChunks: number;
  total: number;
}

const DEFAULT_WEIGHTS: FragmentStyleWeights = {
  smallCubes: 0.5,
  plates: 0.3,
  innerChunks: 0.2,
};

function validateTotal(total: number): void {
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Total fragment count must be positive');
  }
}

function normalizeWeights(weights?: Partial<FragmentStyleWeights>): FragmentStyleWeights {
  const merged: FragmentStyleWeights = {
    ...DEFAULT_WEIGHTS,
    ...weights,
  };
  const sum = merged.smallCubes + merged.plates + merged.innerChunks;
  if (sum <= 0) {
    throw new Error('At least one fragment style weight must be positive');
  }
  return merged;
}

/**
 * Делит общее число фрагментов на три стилистических набора (мелкие кубики, пластины, внутренние куски)
 * с сохранением суммы и справедливым распределением округлений.
 */
export function allocateFragmentCounts(
  total: number,
  weights?: Partial<FragmentStyleWeights>
): FragmentAllocation {
  validateTotal(total);
  const w = normalizeWeights(weights);
  const sum = w.smallCubes + w.plates + w.innerChunks;

  const raw = [
    { key: 'smallCubes' as const, value: (w.smallCubes / sum) * total },
    { key: 'plates' as const, value: (w.plates / sum) * total },
    { key: 'innerChunks' as const, value: (w.innerChunks / sum) * total },
  ];

  const baseCounts = raw.map((r) => Math.floor(r.value));
  let remaining = total - baseCounts.reduce((acc, val) => acc + val, 0);

  // Largest remainder method to distribute the leftover counts deterministically.
  const remainders = raw
    .map((r, idx) => ({ key: r.key, remainder: r.value - baseCounts[idx], idx }))
    .sort((a, b) => b.remainder - a.remainder || a.idx - b.idx);

  for (let i = 0; i < remainders.length && remaining > 0; i += 1) {
    baseCounts[remainders[i].idx] += 1;
    remaining -= 1;
  }

  return {
    smallCubes: baseCounts[0],
    plates: baseCounts[1],
    innerChunks: baseCounts[2],
    total,
  };
}
