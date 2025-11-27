export interface VisualControlState {
  fov: number;
  cameraDistance: number;
  cameraHeight: number;
  towerRadius: number;
  ambientIntensity: number;
  hemisphereIntensity: number;
  keyIntensity: number;
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
  onChange: (state: VisualControlState) => void
): VisualDebugControls {
  const state: VisualControlState = { ...initial };
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
      onChange({ ...state });
    });

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(valueLabel);
    row.appendChild(inputWrapper);
    container.appendChild(row);
  });

  document.body.appendChild(container);

  return {
    dispose: () => container.remove(),
    getState: () => ({ ...state }),
  };
}
