export interface VisualControlState {
  fov: number;
  cameraDistance: number;
  cameraHeight: number;
  towerRadius: number;
  ambientIntensity: number;
  hemisphereIntensity: number;
  keyIntensity: number;
  autoRotateEnabled: boolean;
  qualityLevel: 'ultra' | 'medium' | 'low';
  materialDebugMode: 'none' | 'matcap' | 'flat';
  envDebugMode: 'full' | 'lightsOnly' | 'envOnly';
}

export interface VisualDebugControls {
  dispose: () => void;
  getState: () => VisualControlState;
}

interface ControlSpec {
  key: keyof VisualControlState;
  label: string;
  min: number;
  max: number;
  step: number;
  precision?: number;
}

const CONTROL_SPECS: ControlSpec[] = [
  { key: 'fov', label: 'FOV', min: 20, max: 90, step: 1 },
  { key: 'cameraDistance', label: 'Camera distance', min: 5, max: 80, step: 0.5, precision: 1 },
  { key: 'cameraHeight', label: 'Camera height', min: -10, max: 80, step: 0.5, precision: 1 },
  { key: 'towerRadius', label: 'Tower radius', min: 2, max: 20, step: 0.2, precision: 2 },
  { key: 'ambientIntensity', label: 'Ambient', min: 0, max: 2, step: 0.05, precision: 2 },
  { key: 'hemisphereIntensity', label: 'Hemisphere', min: 0, max: 2, step: 0.05, precision: 2 },
  { key: 'keyIntensity', label: 'Key light', min: 0, max: 2, step: 0.05, precision: 2 },
];

export function createVisualDebugControls(
  initial: VisualControlState,
  onChange: (state: VisualControlState) => void,
  onReset?: () => void
): VisualDebugControls {
  const state: VisualControlState = { ...initial };
  let pendingChange: number | undefined;
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    padding: '10px',
    background: 'rgba(20, 20, 24, 0.9)',
    color: '#e5e5e5',
    fontFamily: 'sans-serif',
    fontSize: '12px',
    borderRadius: '8px',
    zIndex: '2000',
    width: '220px',
  });

  const title = document.createElement('div');
  title.textContent = 'Visual Debug Controls';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '6px';
  container.appendChild(title);

  CONTROL_SPECS.forEach((spec) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.marginBottom = '8px';

    const label = document.createElement('label');
    label.textContent = spec.label;
    label.style.marginBottom = '2px';
    row.appendChild(label);

    const inputWrapper = document.createElement('div');
    inputWrapper.style.display = 'flex';
    inputWrapper.style.alignItems = 'center';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = spec.min.toString();
    input.max = spec.max.toString();
    input.step = spec.step.toString();
    input.value = state[spec.key].toString();
    input.style.flex = '1';

    const valueLabel = document.createElement('span');
    valueLabel.style.display = 'inline-block';
    valueLabel.style.minWidth = '44px';
    valueLabel.style.textAlign = 'right';
    valueLabel.style.marginLeft = '6px';

    function syncValueLabel(val: number) {
      const precision = spec.precision ?? 0;
      valueLabel.textContent = val.toFixed(precision);
    }

    syncValueLabel(state[spec.key]);

    input.addEventListener('input', () => {
      const parsed = Number.parseFloat(input.value);
      state[spec.key] = Number.isFinite(parsed) ? parsed : state[spec.key];
      syncValueLabel(state[spec.key]);
      if (pendingChange !== undefined) {
        window.clearTimeout(pendingChange);
      }
      pendingChange = window.setTimeout(() => {
        pendingChange = undefined;
        onChange({ ...state });
      }, 120);
    });

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(valueLabel);
    row.appendChild(inputWrapper);
    container.appendChild(row);
  });

  const autoRotateRow = document.createElement('div');
  autoRotateRow.style.display = 'flex';
  autoRotateRow.style.alignItems = 'center';
  autoRotateRow.style.marginBottom = '8px';

  const autoRotateLabel = document.createElement('label');
  autoRotateLabel.textContent = 'Auto-rotate (game view)';
  autoRotateLabel.style.flex = '1';

  const autoRotateCheckbox = document.createElement('input');
  autoRotateCheckbox.type = 'checkbox';
  autoRotateCheckbox.checked = Boolean(state.autoRotateEnabled);
  autoRotateCheckbox.addEventListener('change', () => {
    state.autoRotateEnabled = autoRotateCheckbox.checked;
    onChange({ ...state });
  });

  autoRotateRow.appendChild(autoRotateLabel);
  autoRotateRow.appendChild(autoRotateCheckbox);
  container.appendChild(autoRotateRow);

  const qualityRow = document.createElement('div');
  qualityRow.style.display = 'flex';
  qualityRow.style.flexDirection = 'column';
  qualityRow.style.marginBottom = '8px';

  const qualityLabel = document.createElement('label');
  qualityLabel.textContent = 'Quality level';
  qualityLabel.style.marginBottom = '2px';

  const qualitySelect = document.createElement('select');
  ['ultra', 'medium', 'low'].forEach((level) => {
    const opt = document.createElement('option');
    opt.value = level;
    opt.textContent = level;
    qualitySelect.appendChild(opt);
  });
  qualitySelect.value = state.qualityLevel;
  qualitySelect.addEventListener('change', () => {
    const val = qualitySelect.value as VisualControlState['qualityLevel'];
    state.qualityLevel = val;
    onChange({ ...state });
  });

  qualityRow.appendChild(qualityLabel);
  qualityRow.appendChild(qualitySelect);
  container.appendChild(qualityRow);

  const materialRow = document.createElement('div');
  materialRow.style.display = 'flex';
  materialRow.style.flexDirection = 'column';
  materialRow.style.marginBottom = '8px';

  const materialLabel = document.createElement('label');
  materialLabel.textContent = 'Material debug';
  materialLabel.style.marginBottom = '2px';

  const materialSelect = document.createElement('select');
  [
    { value: 'none', label: 'None' },
    { value: 'matcap', label: 'Matcap' },
    { value: 'flat', label: 'Flat IDs' },
  ].forEach((optDef) => {
    const opt = document.createElement('option');
    opt.value = optDef.value;
    opt.textContent = optDef.label;
    materialSelect.appendChild(opt);
  });
  materialSelect.value = state.materialDebugMode;
  materialSelect.addEventListener('change', () => {
    const val = materialSelect.value as VisualControlState['materialDebugMode'];
    state.materialDebugMode = val;
    onChange({ ...state });
  });

  materialRow.appendChild(materialLabel);
  materialRow.appendChild(materialSelect);
  container.appendChild(materialRow);

  const envRow = document.createElement('div');
  envRow.style.display = 'flex';
  envRow.style.flexDirection = 'column';
  envRow.style.marginBottom = '8px';

  const envLabel = document.createElement('label');
  envLabel.textContent = 'Lighting debug';
  envLabel.style.marginBottom = '2px';

  const envSelect = document.createElement('select');
  [
    { value: 'full', label: 'Full (env + lights)' },
    { value: 'lightsOnly', label: 'Lights only' },
    { value: 'envOnly', label: 'Env only' },
  ].forEach((optDef) => {
    const opt = document.createElement('option');
    opt.value = optDef.value;
    opt.textContent = optDef.label;
    envSelect.appendChild(opt);
  });
  envSelect.value = state.envDebugMode;
  envSelect.addEventListener('change', () => {
    const val = envSelect.value as VisualControlState['envDebugMode'];
    state.envDebugMode = val;
    onChange({ ...state });
  });

  envRow.appendChild(envLabel);
  envRow.appendChild(envSelect);
  container.appendChild(envRow);

  if (onReset) {
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset lighting/materials';
    resetBtn.style.width = '100%';
    resetBtn.style.padding = '6px';
    resetBtn.style.marginTop = '6px';
    resetBtn.style.background = '#2d6bff';
    resetBtn.style.color = '#fff';
    resetBtn.style.border = 'none';
    resetBtn.style.borderRadius = '6px';
    resetBtn.style.cursor = 'pointer';
    resetBtn.addEventListener('click', () => onReset());
    container.appendChild(resetBtn);
  }

  document.body.appendChild(container);

  return {
    dispose: () => container.remove(),
    getState: () => ({ ...state }),
  };
}
