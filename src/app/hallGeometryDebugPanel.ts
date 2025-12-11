import { HallGeometryViolation } from '../render/debug/hallGeometryMonitor';

export interface HallGeometryDebugPanel {
  dispose: () => void;
  setViolations: (violations: HallGeometryViolation[]) => void;
  setAutoAnalyze: (enabled: boolean) => void;
  isAutoAnalyze: () => boolean;
  setLog: (lines: string[]) => void;
  setPlatformOffset: (value: number) => void;
  setFootprintOffset: (value: number) => void;
  setFootprintScale: (value: number) => void;
}

export interface HallGeometryDebugPanelOptions {
  onAnalyze: () => void;
  onToggleAuto: (enabled: boolean) => void;
  onSelectViolation?: (violation: HallGeometryViolation | null) => void;
  onCopyReport?: () => void;
  onCopySnapshot?: () => void;
  onCopyBugTemplate?: () => void;
  onPlatformOffsetChange?: (value: number) => void;
  onFootprintOffsetChange?: (value: number) => void;
  onFootprintScaleChange?: (value: number) => void;
}

export function createHallGeometryDebugPanel(options: HallGeometryDebugPanelOptions): HallGeometryDebugPanel {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '12px',
    left: '12px',
    padding: '10px',
    background: 'rgba(15, 15, 18, 0.92)',
    color: '#e5e5e5',
    fontFamily: 'sans-serif',
    fontSize: '12px',
    borderRadius: '8px',
    zIndex: '2000',
    width: '260px',
    maxHeight: '40vh',
    overflowY: 'auto',
    boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
  });

  const title = document.createElement('div');
  title.textContent = 'Hall Geometry Debug';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '6px';
  container.appendChild(title);

  const controlsRow = document.createElement('div');
  controlsRow.style.display = 'flex';
  controlsRow.style.gap = '6px';
  controlsRow.style.marginBottom = '8px';
  container.appendChild(controlsRow);

  const analyzeBtn = document.createElement('button');
  analyzeBtn.textContent = 'Analyze once';
  styleButton(analyzeBtn, '#4caf50');
  analyzeBtn.addEventListener('click', () => options.onAnalyze());
  controlsRow.appendChild(analyzeBtn);

  const autoLabel = document.createElement('label');
  autoLabel.style.display = 'flex';
  autoLabel.style.alignItems = 'center';
  autoLabel.style.gap = '4px';
  autoLabel.style.fontSize = '12px';
  autoLabel.style.cursor = 'pointer';
  const autoCheckbox = document.createElement('input');
  autoCheckbox.type = 'checkbox';
  autoCheckbox.addEventListener('change', () => {
    options.onToggleAuto(autoCheckbox.checked);
  });
  autoLabel.appendChild(autoCheckbox);
  autoLabel.appendChild(document.createTextNode('Auto analyze'));
  controlsRow.appendChild(autoLabel);

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy geometry report';
  styleButton(copyBtn, '#3f51b5');
  copyBtn.style.width = '100%';
  copyBtn.addEventListener('click', () => options.onCopyReport?.());
  container.appendChild(copyBtn);

  const copyRow = document.createElement('div');
  copyRow.style.display = 'flex';
  copyRow.style.gap = '6px';
  copyRow.style.marginTop = '6px';
  container.appendChild(copyRow);

  const copySnapshotBtn = document.createElement('button');
  copySnapshotBtn.textContent = 'Copy JSON snapshot';
  styleButton(copySnapshotBtn, '#607d8b');
  copySnapshotBtn.addEventListener('click', () => options.onCopySnapshot?.());
  copyRow.appendChild(copySnapshotBtn);

  const copyTemplateBtn = document.createElement('button');
  copyTemplateBtn.textContent = 'Bug template';
  styleButton(copyTemplateBtn, '#9c27b0');
  copyTemplateBtn.addEventListener('click', () => options.onCopyBugTemplate?.());
  copyRow.appendChild(copyTemplateBtn);

  const sliders = document.createElement('div');
  sliders.style.display = 'flex';
  sliders.style.flexDirection = 'column';
  sliders.style.gap = '6px';
  sliders.style.marginTop = '6px';
  container.appendChild(sliders);

  const platformY = createLabeledSlider(
    'Platform Y offset',
    -0.5,
    0.5,
    0,
    0.001,
    (v) => options.onPlatformOffsetChange?.(v)
  );
  sliders.appendChild(platformY.container);

  const footprintY = createLabeledSlider(
    'Footprint Y offset',
    -0.2,
    0.2,
    0,
    0.001,
    (v) => options.onFootprintOffsetChange?.(v)
  );
  sliders.appendChild(footprintY.container);

  const footprintScale = createLabeledSlider(
    'Footprint scale',
    0.8,
    1.2,
    1,
    0.001,
    (v) => options.onFootprintScaleChange?.(v)
  );
  sliders.appendChild(footprintScale.container);

  const list = document.createElement('div');
  list.style.marginTop = '8px';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '4px';
  container.appendChild(list);

  const logBox = document.createElement('div');
  logBox.style.marginTop = '8px';
  logBox.style.padding = '6px';
  logBox.style.border = '1px solid rgba(255,255,255,0.08)';
  logBox.style.borderRadius = '6px';
  logBox.style.maxHeight = '120px';
  logBox.style.overflowY = 'auto';
  logBox.style.fontFamily = 'monospace';
  logBox.style.fontSize = '11px';
  logBox.style.whiteSpace = 'pre-wrap';
  container.appendChild(logBox);

  document.body.appendChild(container);

  let currentViolations: HallGeometryViolation[] = [];
  let auto = false;
  const slidersState = {
    platformY: 0,
    footprintY: 0,
    footprintScale: 1,
  };

  function rebuildList() {
    list.innerHTML = '';
    if (!currentViolations.length) {
      const ok = document.createElement('div');
      ok.textContent = 'No violations';
      ok.style.color = '#8bc34a';
      list.appendChild(ok);
      options.onSelectViolation?.(null);
      return;
    }
    currentViolations.forEach((v, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.alignItems = 'center';
      row.style.padding = '6px';
      row.style.borderRadius = '6px';
      row.style.cursor = 'pointer';
      row.style.background = 'rgba(255,255,255,0.04)';
      const icon = document.createElement('span');
      icon.textContent = v.severity === 'error' ? '❌' : '⚠️';
      row.appendChild(icon);
      const text = document.createElement('span');
      text.textContent = `${v.invariant}`;
      text.style.fontWeight = 'bold';
      text.style.color = v.severity === 'error' ? '#ff6b6b' : '#f1c40f';
      row.appendChild(text);
      const count = document.createElement('span');
      count.textContent = `${idx + 1}/${currentViolations.length}`;
      count.style.marginLeft = 'auto';
      count.style.opacity = '0.6';
      row.appendChild(count);
      row.addEventListener('click', () => options.onSelectViolation?.(v));
      list.appendChild(row);
    });
  }

  return {
    dispose: () => {
      container.remove();
    },
    setViolations: (violations) => {
      currentViolations = [...violations];
      rebuildList();
    },
    setLog: (lines) => {
      logBox.textContent = lines.join('\n');
    },
    setAutoAnalyze: (enabled) => {
      auto = enabled;
      autoCheckbox.checked = enabled;
    },
    isAutoAnalyze: () => auto,
    setPlatformOffset: (value) => {
      slidersState.platformY = value;
      platformY.input.value = value.toString();
      platformY.value.textContent = value.toFixed(3);
    },
    setFootprintOffset: (value) => {
      slidersState.footprintY = value;
      footprintY.input.value = value.toString();
      footprintY.value.textContent = value.toFixed(3);
    },
    setFootprintScale: (value) => {
      slidersState.footprintScale = value;
      footprintScale.input.value = value.toString();
      footprintScale.value.textContent = value.toFixed(3);
    },
  };
}

function styleButton(btn: HTMLButtonElement, color: string): void {
  btn.style.flex = '1';
  btn.style.padding = '8px';
  btn.style.background = color;
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  btn.style.fontWeight = 'bold';
}

function createLabeledSlider(
  label: string,
  min: number,
  max: number,
  value: number,
  step: number,
  onChange: (v: number) => void
): { container: HTMLDivElement; input: HTMLInputElement; value: HTMLSpanElement } {
  const container = document.createElement('div');
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.marginBottom = '2px';
  const title = document.createElement('span');
  title.textContent = label;
  const valueLabel = document.createElement('span');
  valueLabel.textContent = value.toFixed(3);
  row.appendChild(title);
  row.appendChild(valueLabel);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min.toString();
  input.max = max.toString();
  input.value = value.toString();
  input.step = step.toString();
  input.style.width = '100%';
  input.addEventListener('input', () => {
    const v = Number.parseFloat(input.value);
    valueLabel.textContent = v.toFixed(3);
    onChange(v);
  });
  container.appendChild(row);
  container.appendChild(input);
  return { container, input, value: valueLabel };
}
