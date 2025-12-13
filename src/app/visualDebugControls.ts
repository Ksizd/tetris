export interface VisualControlState {
  fov: number;
  cameraDistance: number;
  cameraHeight: number;
  towerRadius: number;
  goldenHallEnabled: boolean;
  showHallBase: boolean;
  showHallShell: boolean;
  showHallFx: boolean;
  showHallRadii: boolean;
  hallWallHeight: number;
  hallBrightness: number;
  ambientIntensity: number;
  hemisphereIntensity: number;
  keyIntensity: number;
  autoRotateEnabled: boolean;
  showSceneGuides: boolean;
  showSceneDebugRing: boolean;
  showSceneColliders: boolean;
  showHallGeometryOverlay: boolean;
  showFootprintInlayWireframe: boolean;
  showFootprintLavaUV: boolean;
  disableFootprintLavaAnimation: boolean;
  qualityLevel: 'ultra' | 'ultra2' | 'medium' | 'low';
  materialDebugMode: 'none' | 'matcap' | 'flat';
  envDebugMode: 'full' | 'lightsOnly' | 'envOnly' | 'hallOnly' | 'noHall';
  hallMaterialMode: 'off' | 'hallOnly' | 'albedo' | 'roughness' | 'metalness';
  inspectorEnabled: boolean;
}

export interface VisualDebugControls {
  dispose: () => void;
  getState: () => VisualControlState;
  updateInspector: (info: {
    selectedLabel: string;
    summary: string;
    json: string;
    details: string;
  } | null) => void;
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
  { key: 'hallWallHeight', label: 'Hall wall height', min: 12, max: 120, step: 1, precision: 0 },
  { key: 'hallBrightness', label: 'Hall brightness', min: 0.25, max: 2, step: 0.05, precision: 2 },
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
    maxHeight: 'calc(100vh - 24px)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
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

  const hallToggleRow = document.createElement('div');
  hallToggleRow.style.display = 'flex';
  hallToggleRow.style.flexDirection = 'column';
  hallToggleRow.style.marginBottom = '8px';

  const hallEnableLabel = document.createElement('label');
  hallEnableLabel.textContent = 'Enable Golden Hall';
  hallEnableLabel.style.marginBottom = '4px';

  const hallEnableCheckbox = document.createElement('input');
  hallEnableCheckbox.type = 'checkbox';
  hallEnableCheckbox.checked = Boolean(state.goldenHallEnabled);
  hallEnableCheckbox.addEventListener('change', () => {
    state.goldenHallEnabled = hallEnableCheckbox.checked;
    onChange({ ...state });
  });

  const enableWrap = document.createElement('div');
  enableWrap.style.display = 'flex';
  enableWrap.style.alignItems = 'center';
  enableWrap.appendChild(hallEnableLabel);
  enableWrap.appendChild(hallEnableCheckbox);
  enableWrap.style.justifyContent = 'space-between';
  hallToggleRow.appendChild(enableWrap);

  const visibilityRow = document.createElement('div');
  visibilityRow.style.display = 'flex';
  visibilityRow.style.flexDirection = 'column';
  visibilityRow.style.gap = '2px';

  [
    { key: 'showHallBase', label: 'Show base' },
    { key: 'showHallShell', label: 'Show hall shell' },
    { key: 'showHallFx', label: 'Show FX' },
    { key: 'showHallRadii', label: 'Show hall radii' },
  ].forEach((item) => {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = Boolean(state[item.key as keyof VisualControlState]);
    cb.addEventListener('change', () => {
      (state as any)[item.key] = cb.checked;
      onChange({ ...state });
    });
    cb.style.marginRight = '6px';
    row.appendChild(cb);
    row.appendChild(document.createTextNode(item.label));
    visibilityRow.appendChild(row);
  });
  hallToggleRow.appendChild(visibilityRow);
  container.appendChild(hallToggleRow);

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

  const overlaysRow = document.createElement('div');
  overlaysRow.style.display = 'flex';
  overlaysRow.style.flexDirection = 'column';
  overlaysRow.style.marginBottom = '8px';

  const overlaysTitle = document.createElement('div');
  overlaysTitle.textContent = 'Debug overlays';
  overlaysTitle.style.fontWeight = 'bold';
  overlaysTitle.style.marginBottom = '4px';
  overlaysRow.appendChild(overlaysTitle);

  [
    { key: 'showSceneGuides', label: 'Scene guides (rails + axes)' },
    { key: 'showSceneDebugRing', label: 'Scene debug ring' },
    { key: 'showSceneColliders', label: 'Collider debug layer' },
    { key: 'showHallGeometryOverlay', label: 'Hall geometry overlay (circles/boxes)' },
  ].forEach((item) => {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = Boolean(state[item.key as keyof VisualControlState]);
    cb.addEventListener('change', () => {
      (state as any)[item.key] = cb.checked;
      onChange({ ...state });
    });
    cb.style.marginRight = '6px';
    row.appendChild(cb);
    row.appendChild(document.createTextNode(item.label));
    overlaysRow.appendChild(row);
  });
  container.appendChild(overlaysRow);

  const footprintRow = document.createElement('div');
  footprintRow.style.display = 'flex';
  footprintRow.style.flexDirection = 'column';
  footprintRow.style.marginBottom = '8px';

  const footprintTitle = document.createElement('div');
  footprintTitle.textContent = 'Footprint inlay';
  footprintTitle.style.fontWeight = 'bold';
  footprintTitle.style.marginBottom = '4px';
  footprintRow.appendChild(footprintTitle);

  [
    { key: 'showFootprintInlayWireframe', label: 'Wireframe (inlay)' },
    { key: 'showFootprintLavaUV', label: 'Show lava UV' },
    { key: 'disableFootprintLavaAnimation', label: 'Freeze lava/FX time' },
  ].forEach((item) => {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = Boolean(state[item.key as keyof VisualControlState]);
    cb.addEventListener('change', () => {
      (state as any)[item.key] = cb.checked;
      onChange({ ...state });
    });
    cb.style.marginRight = '6px';
    row.appendChild(cb);
    row.appendChild(document.createTextNode(item.label));
    footprintRow.appendChild(row);
  });
  container.appendChild(footprintRow);

  const inspectorRow = document.createElement('div');
  inspectorRow.style.display = 'flex';
  inspectorRow.style.alignItems = 'center';
  inspectorRow.style.marginBottom = '8px';
  const inspectorLabel = document.createElement('label');
  inspectorLabel.textContent = 'Object Inspector';
  inspectorLabel.style.flex = '1';
  const inspectorCheckbox = document.createElement('input');
  inspectorCheckbox.type = 'checkbox';
  inspectorCheckbox.checked = Boolean(state.inspectorEnabled);
  inspectorCheckbox.addEventListener('change', () => {
    state.inspectorEnabled = inspectorCheckbox.checked;
    onChange({ ...state });
  });
  inspectorRow.appendChild(inspectorLabel);
  inspectorRow.appendChild(inspectorCheckbox);
  container.appendChild(inspectorRow);

  const inspectorPanel = document.createElement('div');
  inspectorPanel.style.display = 'flex';
  inspectorPanel.style.flexDirection = 'column';
  inspectorPanel.style.gap = '4px';
  inspectorPanel.style.marginBottom = '10px';
  inspectorPanel.style.background = 'rgba(255,255,255,0.03)';
  inspectorPanel.style.padding = '6px';
  inspectorPanel.style.borderRadius = '6px';

  const selectedRow = document.createElement('div');
  selectedRow.textContent = 'Selected object: —';
  selectedRow.style.fontWeight = 'bold';
  inspectorPanel.appendChild(selectedRow);

  const summaryArea = document.createElement('textarea');
  summaryArea.readOnly = true;
  summaryArea.rows = 3;
  summaryArea.style.width = '100%';
  summaryArea.style.resize = 'vertical';
  summaryArea.placeholder = 'summaryForLLM';
  inspectorPanel.appendChild(summaryArea);

  const buttonsRow = document.createElement('div');
  buttonsRow.style.display = 'flex';
  buttonsRow.style.gap = '6px';
  const copySummaryBtn = document.createElement('button');
  copySummaryBtn.textContent = 'Copy summary';
  copySummaryBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(summaryArea.value ?? '');
  });
  const copyJsonBtn = document.createElement('button');
  copyJsonBtn.textContent = 'Copy JSON';
  copyJsonBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(jsonArea.value ?? '');
  });
  buttonsRow.appendChild(copySummaryBtn);
  buttonsRow.appendChild(copyJsonBtn);
  inspectorPanel.appendChild(buttonsRow);

  const jsonArea = document.createElement('textarea');
  jsonArea.readOnly = true;
  jsonArea.rows = 3;
  jsonArea.style.width = '100%';
  jsonArea.style.resize = 'vertical';
  jsonArea.placeholder = 'jsonForLLM';
  inspectorPanel.appendChild(jsonArea);

  const detailsArea = document.createElement('div');
  detailsArea.style.fontFamily = 'monospace';
  detailsArea.style.fontSize = '11px';
  detailsArea.style.whiteSpace = 'pre-wrap';
  detailsArea.style.background = 'rgba(255,255,255,0.04)';
  detailsArea.style.padding = '6px';
  detailsArea.style.borderRadius = '4px';
  detailsArea.textContent = 'debugTag: —';
  inspectorPanel.appendChild(detailsArea);

  container.appendChild(inspectorPanel);

  const qualityRow = document.createElement('div');
  qualityRow.style.display = 'flex';
  qualityRow.style.flexDirection = 'column';
  qualityRow.style.marginBottom = '8px';

  const qualityLabel = document.createElement('label');
  qualityLabel.textContent = 'Quality level';
  qualityLabel.style.marginBottom = '2px';

  const qualitySelect = document.createElement('select');
  ['ultra', 'ultra2', 'medium', 'low'].forEach((level) => {
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
    { value: 'hallOnly', label: 'Hall only' },
    { value: 'noHall', label: 'No hall' },
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

  const hallRow = document.createElement('div');
  hallRow.style.display = 'flex';
  hallRow.style.flexDirection = 'column';
  hallRow.style.marginBottom = '8px';

  const hallLabel = document.createElement('label');
  hallLabel.textContent = 'Golden Hall material preview';
  hallLabel.style.marginBottom = '2px';

  const hallSelect = document.createElement('select');
  [
    { value: 'off', label: 'Off' },
    { value: 'hallOnly', label: 'Hall only (hide tower)' },
    { value: 'albedo', label: 'Hall Albedo' },
    { value: 'roughness', label: 'Hall Roughness' },
    { value: 'metalness', label: 'Hall Metalness' },
  ].forEach((optDef) => {
    const opt = document.createElement('option');
    opt.value = optDef.value;
    opt.textContent = optDef.label;
    hallSelect.appendChild(opt);
  });
  hallSelect.value = state.hallMaterialMode;
  hallSelect.addEventListener('change', () => {
    const val = hallSelect.value as VisualControlState['hallMaterialMode'];
    state.hallMaterialMode = val;
    onChange({ ...state });
  });

  hallRow.appendChild(hallLabel);
  hallRow.appendChild(hallSelect);
  container.appendChild(hallRow);

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
    updateInspector: (info) => {
      if (!info) {
        selectedRow.textContent = 'Selected object: —';
        summaryArea.value = '';
        jsonArea.value = '';
        detailsArea.textContent = 'debugTag: —';
        return;
      }
      selectedRow.textContent = `Selected object: ${info.selectedLabel}`;
      summaryArea.value = info.summary;
      jsonArea.value = info.json;
      detailsArea.textContent = info.details;
    },
  };
}
