export interface DestructionDebugPanel {
  dispose: () => void;
  getSelectedLevel: () => number | null;
  setLevels: (levels: number[]) => void;
  getFragmentFilter: () => FragmentDebugFilter;
  onShowSourceRegion?: () => void;
}

export type FragmentDebugFilter = 'all' | 'face' | 'gold' | 'dust' | 'fractureDebug';

export interface DestructionDebugOptions {
  levels: number[];
  onDestroy: (level: number) => void;
  onFilterChange?: (filter: FragmentDebugFilter) => void;
  onShowSourceRegion?: () => void;
}

/**
 * Простая панель для visual debug: выбор уровня и кнопка Destroy level (реальную логику вызовет вызывающий код).
 */
export function createDestructionDebugPanel(options: DestructionDebugOptions): DestructionDebugPanel {
  let levels = [...options.levels];
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    top: '12px',
    left: '12px',
    padding: '10px',
    background: 'rgba(15, 15, 18, 0.92)',
    color: '#e5e5e5',
    fontFamily: 'sans-serif',
    fontSize: '12px',
    borderRadius: '8px',
    zIndex: '2000',
    width: '220px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
  });

  const title = document.createElement('div');
  title.textContent = 'Destruction (debug)';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '6px';
  container.appendChild(title);

  const selectLabel = document.createElement('label');
  selectLabel.textContent = 'Level to destroy';
  selectLabel.style.display = 'block';
  selectLabel.style.marginBottom = '4px';
  container.appendChild(selectLabel);

  const levelSelect = document.createElement('select');
  levelSelect.style.width = '100%';
  levelSelect.style.padding = '4px';
  levelSelect.style.marginBottom = '8px';

  function rebuildOptions() {
    const prev = levelSelect.value;
    levelSelect.innerHTML = '';
    levels.forEach((lvl) => {
      const opt = document.createElement('option');
      opt.value = lvl.toString();
      opt.textContent = lvl.toString();
      levelSelect.appendChild(opt);
    });
    if (levels.length > 0) {
      levelSelect.value = levels.includes(Number(prev)) ? prev : levels[0].toString();
    }
  }

  rebuildOptions();

  const destroyBtn = document.createElement('button');
  destroyBtn.textContent = 'Destroy level (real sim)';
  destroyBtn.style.width = '100%';
  destroyBtn.style.padding = '8px';
  destroyBtn.style.background = '#ff4d62';
  destroyBtn.style.color = '#fff';
  destroyBtn.style.border = 'none';
  destroyBtn.style.borderRadius = '6px';
  destroyBtn.style.cursor = 'pointer';
  destroyBtn.style.fontWeight = 'bold';
  destroyBtn.addEventListener('click', () => {
    const selected = Number.parseInt(levelSelect.value, 10);
    if (Number.isFinite(selected)) {
      options.onDestroy(selected);
    }
  });

  const filterLabel = document.createElement('label');
  filterLabel.textContent = 'Fragments debug';
  filterLabel.style.display = 'block';
  filterLabel.style.margin = '10px 0 4px';
  container.appendChild(filterLabel);

  const filterSelect = document.createElement('select');
  filterSelect.style.width = '100%';
  filterSelect.style.padding = '4px';
  ['all', 'face', 'gold', 'dust', 'fractureDebug'].forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    filterSelect.appendChild(opt);
  });
  filterSelect.value = 'all';
  filterSelect.addEventListener('change', () => {
    const value = filterSelect.value as FragmentDebugFilter;
    options.onFilterChange?.(value);
  });

  container.appendChild(levelSelect);
  container.appendChild(destroyBtn);
  container.appendChild(filterSelect);

  const sourceRegionBtn = document.createElement('button');
  sourceRegionBtn.textContent = 'Show source region (static)';
  sourceRegionBtn.style.width = '100%';
  sourceRegionBtn.style.padding = '6px';
  sourceRegionBtn.style.marginTop = '8px';
  sourceRegionBtn.style.background = '#4d82ff';
  sourceRegionBtn.style.color = '#fff';
  sourceRegionBtn.style.border = 'none';
  sourceRegionBtn.style.borderRadius = '6px';
  sourceRegionBtn.style.cursor = 'pointer';
  sourceRegionBtn.style.fontWeight = 'bold';
  sourceRegionBtn.addEventListener('click', () => {
    options.onShowSourceRegion?.();
  });
  container.appendChild(sourceRegionBtn);

  document.body.appendChild(container);

  return {
    dispose: () => container.remove(),
    getSelectedLevel: () => {
      const selected = Number.parseInt(levelSelect.value, 10);
      return Number.isFinite(selected) ? selected : null;
    },
    setLevels: (nextLevels: number[]) => {
      levels = [...nextLevels];
      rebuildOptions();
    },
    getFragmentFilter: () => filterSelect.value as FragmentDebugFilter,
    onShowSourceRegion: options.onShowSourceRegion,
  };
}
