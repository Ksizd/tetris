import * as THREE from 'three';
import { Board } from '../core/board';
import { CellContent, BoardDimensions, GameStatus } from '../core/types';
import { createInitialGameState } from '../core/state/initialState';
import { GameState } from '../core/state/gameState';
import {
  createRenderContext,
  RenderConfig,
  RenderConfigOverrides,
  RenderContext,
  renderScene,
  renderFrame,
  resizeRenderer,
} from '../render';
import {
  createVisualDebugControls,
  VisualControlState,
  VisualDebugControls,
} from './visualDebugControls';
import { OrbitCameraController } from './orbitCamera';
import { QualityLevel, RenderModeConfig } from '../render/renderConfig';
import { applyMaterialDebugMode, createMaterialsSnapshot } from '../render/materialDebug';
import { deriveEnvOverrides, applyEnvDebugMode } from '../render/envDebug';
import {
  createDestructionDebugPanel,
  DestructionDebugPanel,
  FragmentDebugFilter,
} from './destructionDebugPanel';
import { startLineDestructionFromBoard } from './destruction/destructionStarter';
import { DestructionSimulationState } from './destruction/destructionSimulationState';
import { launchScheduledExplosions } from './destruction/orchestrator';
import { stepDestructionSimulations } from './destruction/simulationManager';
import { shouldRenderWholeCube } from './destruction/explosionLifecycle';
import { FragmentInstanceUpdate } from './destruction/fragmentInstances';
import { FragmentMaterialId } from './destruction/cubeDestructionSim';
import { applyFragmentInstanceUpdates } from '../render/destruction/instanceUpdater';
import { FragmentPhysicsConfig, DEFAULT_FRAGMENT_PHYSICS } from './destruction/fragmentSimulation';
import { ULTRA_DESTRUCTION_PRESET } from './destruction/destructionPresets';
import { buildShardGeometryLibrary, makeFragmentFromTemplate } from './destruction/shardFragmentFactory';
import { getDefaultShardTemplateSet } from './destruction/shardTemplateSet';
import { FACE_NORMALS, CubeFace } from './destruction/cubeSpace';
import { FaceUvRect, DEFAULT_FACE_UV_RECTS } from './destruction/faceUvRect';

type CameraMode = 'game' | 'inspect';

const QUERY_FLAG = 'visualDebug';
const ULTRA2_FLAG = 'ultra2lab';
const CAMERA_TOGGLE_KEY = 'c';
const CLOSEUP_KEY = 'v';
const TRANSITION_DURATION_MS = 450;
const GAME_MODE_ROTATION_SPEED = 0.00035;
const VISUAL_DEBUG_RENDER_MODE: RenderModeConfig = {
  kind: 'visualDebug',
  showGuides: true,
  showDebugRing: true,
  showColliders: true,
};

export function isVisualDebugModeEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(QUERY_FLAG);
  return value === '1' || value === 'true' || isUltra2LabModeEnabled();
}

function isUltra2LabModeEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(ULTRA2_FLAG);
  return value === '1' || value === 'true';
}

export function startVisualDebugMode(canvas: HTMLCanvasElement): void {
  const ultra2Lab = isUltra2LabModeEnabled();
  const qualityFromUrl = ultra2Lab ? 'ultra2' : parseQualityFromUrl(window.location.search);
  const baseOverrides: RenderConfigOverrides = { renderMode: { ...VISUAL_DEBUG_RENDER_MODE } };
  const renderOverrides: RenderConfigOverrides = qualityFromUrl
    ? { ...baseOverrides, quality: { level: qualityFromUrl } }
    : baseOverrides;
  let renderCtx = createRenderContext(canvas, renderOverrides);
  let snapshot = createStaticSnapshot(renderCtx.renderConfig.boardDimensions);
  let controlState = configToControlState(renderCtx.renderConfig);
  let materialsSnapshot = createMaterialsSnapshot(renderCtx.board, renderCtx.activePiece);
  let destructionSim: DestructionSimulationState | null = null;
  let fragmentFilter: FragmentDebugFilter = 'all';
  let fractureDebugGroup: THREE.Group | null = null;
  let showSourceRegion = false;
  let sourceRegionGroup: THREE.Group | null = null;
  let sourceOverlay: {
    container: HTMLDivElement;
    canvas: HTMLCanvasElement;
    polygons: { id: number; vertices: { x: number; y: number }[] }[];
    rect: FaceUvRect;
  } | null = null;
  let highlightedMesh: THREE.Mesh | null = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cameraOrientation = extractCameraOrientation(renderCtx.renderConfig);
  let cameraMode: CameraMode = ultra2Lab ? 'inspect' : 'game';
  let gameRotationAngle = 0;
  let lastFrameTime = performance.now();
  const orbitControllerRef: { current: OrbitCameraController | null } = { current: null };
  const createOrbit = (placement = renderCtx.cameraBasePlacement) => {
    const ctrl = new OrbitCameraController(renderCtx.camera, placement, {
      minDistance: renderCtx.renderConfig.board.towerRadius * 1.25,
      innerDistance:
        renderCtx.renderConfig.board.towerRadius + renderCtx.renderConfig.board.blockSize * 0.6,
      maxDistance: renderCtx.renderConfig.board.towerRadius * 3.2,
      minPolarAngle: THREE.MathUtils.degToRad(18),
      maxPolarAngle: THREE.MathUtils.degToRad(82),
      minTargetY: renderCtx.renderConfig.board.blockSize * 0.4,
      floorY: 0,
    });
    ctrl.attach(canvas);
    orbitControllerRef.current = ctrl;
  };
  createOrbit();
  const switchToGame = () => {
    cameraMode = 'game';
    orbitControllerRef.current?.detach(canvas);
    orbitControllerRef.current = null;
    transitionCamera(renderCtx, renderCtx.cameraBasePlacement);
  };

  const switchToInspect = (placement?: { position: THREE.Vector3; target: THREE.Vector3 }) => {
    cameraMode = 'inspect';
    const basePlacement =
      placement ?? orbitControllerRef.current?.getPlacement() ?? renderCtx.cameraBasePlacement;
    orbitControllerRef.current?.detach(canvas);
    createOrbit(basePlacement);
  };
  const controls = createVisualDebugControls(
    controlState,
    (next) => {
      controlState = next;
      if (controlState.materialDebugMode !== next.materialDebugMode) {
        applyMaterialDebugMode(
          renderCtx.board,
          renderCtx.activePiece,
          next.materialDebugMode,
          materialsSnapshot
        );
      }
      if (controlState.envDebugMode !== next.envDebugMode) {
        applyEnvDebugMode(renderCtx, next.envDebugMode);
      }
      pendingRebuild = true;
    },
    () => {
      controlState = configToControlState(renderCtx.renderConfig);
      controlState.materialDebugMode = 'none';
      controlState.envDebugMode = 'full';
      controlState.autoRotateEnabled = false;
      pendingRebuild = true;
    }
  );

  logVisualParameters(renderCtx);

  let pendingRebuild = false;
  let destructionPanel: DestructionDebugPanel | null = null;
  let physicsTuning = { explosionStrength: 1, gravityScale: 1, dragScale: 1 };
  function triggerDestruction(level: number) {
    physicsTuning = destructionPanel?.getPhysicsOverrides?.() ?? physicsTuning;
    const started = startLineDestructionFromBoard({
      board: snapshot.board,
      mapper: renderCtx.mapper,
      levels: [level],
      startedAtMs: performance.now(),
      preset: {
        ...ULTRA_DESTRUCTION_PRESET,
        radialSpeed: {
          min: ULTRA_DESTRUCTION_PRESET.radialSpeed.min * physicsTuning.explosionStrength,
          max: ULTRA_DESTRUCTION_PRESET.radialSpeed.max * physicsTuning.explosionStrength,
        },
        tangentialSpeed: {
          min: ULTRA_DESTRUCTION_PRESET.tangentialSpeed.min * physicsTuning.explosionStrength,
          max: ULTRA_DESTRUCTION_PRESET.tangentialSpeed.max * physicsTuning.explosionStrength,
        },
        verticalSpeed: {
          min: ULTRA_DESTRUCTION_PRESET.verticalSpeed.min * physicsTuning.explosionStrength,
          max: ULTRA_DESTRUCTION_PRESET.verticalSpeed.max * physicsTuning.explosionStrength,
        },
        linearDrag: ULTRA_DESTRUCTION_PRESET.linearDrag,
        angularDrag: ULTRA_DESTRUCTION_PRESET.angularDrag,
        gravityScale: ULTRA_DESTRUCTION_PRESET.gravityScale,
        floorRestitution: ULTRA_DESTRUCTION_PRESET.floorRestitution,
        wallRestitution: ULTRA_DESTRUCTION_PRESET.wallRestitution,
        floorFriction: ULTRA_DESTRUCTION_PRESET.floorFriction,
        wallFriction: ULTRA_DESTRUCTION_PRESET.wallFriction,
      },
    });
    destructionSim = started.simulation;
    console.log('[visual debug] StartLineDestruction', started.event, {
      levels: started.scenario.levels,
      activeCubes: destructionSim.activeCubes.length,
      rows: started.scenario.perLevel.size,
    });
  }

  function applyDestructionMask(board: Board, sim: DestructionSimulationState) {
    sim.rows.perLevel.forEach((row) => {
      row.cubes.forEach((cube, idx) => {
        const renderWhole = shouldRenderWholeCube(row, idx);
        board.setCell({ x: cube.id.x, y: cube.id.y }, renderWhole ? CellContent.Block : CellContent.Empty);
      });
    });
  }

  function collectFragmentUpdatesByTemplate(
    sim: DestructionSimulationState
  ): Map<number, { materialId: FragmentMaterialId; updates: FragmentInstanceUpdate[] }> {
    const map = new Map<number, { materialId: FragmentMaterialId; updates: FragmentInstanceUpdate[] }>();
    sim.activeCubes.forEach((cubeSim) => {
      cubeSim.fragments.forEach((fragment) => {
        const templateId = fragment.templateId ?? -1;
        const bucket =
          map.get(templateId) ??
          (() => {
            const created = { materialId: fragment.materialId, updates: [] as FragmentInstanceUpdate[] };
            map.set(templateId, created);
            return created;
          })();
        const updates = bucket.updates;
        updates.push({
          instanceId: updates.length,
          position: fragment.position.clone(),
          rotation: fragment.rotation.clone(),
          scale: fragment.scale.clone(),
          fade: fragment.fade,
          colorTint: fragment.colorTint,
          templateId,
          materialId: fragment.materialId,
        });
      });
    });
    return map;
  }

  function buildFractureDebugGroup(ctx: RenderContext): THREE.Group | null {
    if (!ctx.fragments) return null;
    const group = new THREE.Group();
    ctx.fragments.geometryLibrary.forEach((res) => {
      const materialId = ctx.fragments.templateMaterial.get(res.templateId) ?? 'gold';
      const material = ctx.fragments.materials[materialId];
      const mesh = new THREE.Mesh(res.geometry, material);
      mesh.name = `fracture-debug-${res.templateId}`;
      mesh.userData.shardId = res.templateId;
      mesh.userData.originalMaterial = material;
      group.add(mesh);

      const wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(res.geometry),
        new THREE.LineBasicMaterial({ color: materialId === 'face' ? 0x44aaff : 0xffcc66 })
      );
      wire.name = `fracture-debug-wire-${res.templateId}`;
      wire.userData.shardId = res.templateId;
      group.add(wire);
    });
    return group;
  }

  function ensureFractureDebugGroup(ctx: RenderContext): void {
    if (!fractureDebugGroup) {
      fractureDebugGroup = buildFractureDebugGroup(ctx);
      if (fractureDebugGroup) {
        ctx.scene.add(fractureDebugGroup);
      }
    }
    if (fractureDebugGroup) {
      fractureDebugGroup.visible = true;
    }
  }

  function removeFractureDebugGroup(ctx: RenderContext): void {
    if (fractureDebugGroup) {
      ctx.scene.remove(fractureDebugGroup);
      fractureDebugGroup.traverse((obj) => {
        if (obj.type === 'LineSegments') {
          const line = obj as THREE.LineSegments;
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
        } else if (obj.type === 'Mesh') {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry instanceof THREE.WireframeGeometry) {
            mesh.geometry.dispose();
          }
        }
      });
    }
    fractureDebugGroup = null;
  }

  function attachFractureHover(ctx: RenderContext): void {
    const canvas = ctx.renderer.domElement;
    const onMove = (ev: PointerEvent) => {
      if (fragmentFilter !== 'fractureDebug' || !fractureDebugGroup) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, ctx.camera);
      const hits = raycaster.intersectObjects(fractureDebugGroup.children, false);
      const first = hits[0]?.object as THREE.Mesh | THREE.LineSegments | undefined;
      const mesh =
        (first as any as THREE.Mesh)?.isMesh
          ? (first as THREE.Mesh)
          : (first?.parent as THREE.Mesh | undefined);
      if (mesh) {
        mesh.userData.originalMaterial = mesh.userData.originalMaterial ?? mesh.material;
      }
      setHighlight(mesh ?? null);
      if (mesh?.userData?.shardId !== undefined) {
        console.info('[fracture-debug] shardId', mesh.userData.shardId);
      }
    };
    canvas.addEventListener('pointermove', onMove);
  }

  function renderFragmentInstances(
    ctx: RenderContext,
    sim: DestructionSimulationState | null
  ): void {
    const fragments = ctx.fragments;
    if (!fragments) {
      return;
    }
    const isFractureDebug = fragmentFilter === 'fractureDebug';
    fragments.meshesByTemplate.forEach((mesh) => {
      mesh.count = 0;
      mesh.visible = false;
      mesh.instanceMatrix.needsUpdate = true;
    });
    if (isFractureDebug) {
      ensureFractureDebugGroup(ctx);
      return;
    }
    removeFractureDebugGroup(ctx);
    if (!sim) {
      return;
    }
    const updatesByTemplate = collectFragmentUpdatesByTemplate(sim);
    const isMaterialAllowed = (mat: FragmentMaterialId) => {
      if (fragmentFilter === 'all') return true;
      if (fragmentFilter === 'gold') return mat === 'gold' || mat === 'inner';
      return mat === fragmentFilter;
    };
    updatesByTemplate.forEach((entry, templateId) => {
      const mesh = fragments.meshesByTemplate.get(templateId);
      if (!mesh) {
        return;
      }
      const matId = fragments.templateMaterial.get(templateId) ?? entry.materialId;
      if (!isMaterialAllowed(matId)) {
        mesh.count = 0;
        mesh.visible = false;
        return;
      }
      const capped = entry.updates.slice(0, fragments.capacityPerTemplate);
      mesh.count = capped.length;
      mesh.visible = true;
      const base = fragments.materials[matId].color;
      applyFragmentInstanceUpdates(mesh, capped, { r: base.r, g: base.g, b: base.b });
    });
  }

  function onFragmentFilterChange(filter: FragmentDebugFilter) {
    fragmentFilter = filter;
    if (fragmentFilter !== 'fractureDebug') {
      removeFractureDebugGroup(renderCtx);
    }
  }

  function getFragmentPhysicsConfig(): FragmentPhysicsConfig {
    const base = DEFAULT_FRAGMENT_PHYSICS;
    const tuning = destructionPanel?.getPhysicsOverrides?.() ?? physicsTuning;
    physicsTuning = tuning;
    return {
      ...base,
      gravity: base.gravity.clone().multiplyScalar(tuning.gravityScale ?? 1),
      linearDrag: base.linearDrag * (tuning.dragScale ?? 1),
      angularDrag: base.angularDrag * (tuning.dragScale ?? 1),
      floor: { floorY: 0, minBounceSpeed: 0.8, bounceFactor: 0.35, smallOffset: 0.002 },
      radiusLimit: {
        center: new THREE.Vector3(0, 0, 0),
        maxRadius: renderCtx.renderConfig.board.towerRadius * 2.6,
        radialDamping: 2.2,
        killOutside: false,
      },
    };
  }

  function ensureDestructionPanel(ctx: RenderContext) {
    if (!destructionPanel) {
      destructionPanel = createDestructionDebugPanel({
        levels: getLevels(ctx.renderConfig.boardDimensions.height),
        onDestroy: (level) => {
          triggerDestruction(level);
        },
        onFilterChange: (filter) => {
          onFragmentFilterChange(filter);
        },
        onShowSourceRegion: () => {
          showStaticSourceRegion(ctx);
        },
      });
      attachPanelDisposalOnUnload(() => destructionPanel?.dispose());
    } else {
      destructionPanel.setLevels(getLevels(ctx.renderConfig.boardDimensions.height));
    }
  }

  function rebuildContextIfNeeded() {
    if (!pendingRebuild) {
      return;
    }
    pendingRebuild = false;
    destructionSim = null;
    clearSourceRegionGroup();
    removeFractureDebugGroup(renderCtx);

    disposeRenderResources(renderCtx);
    const overrides = controlStateToOverrides(controlState, cameraOrientation);
    renderCtx = createRenderContext(canvas, overrides);
    snapshot = createStaticSnapshot(renderCtx.renderConfig.boardDimensions);
    orbitControllerRef.current?.detach(canvas);
    createOrbit();
    materialsSnapshot = createMaterialsSnapshot(renderCtx.board, renderCtx.activePiece);
    applyMaterialDebugMode(
      renderCtx.board,
      renderCtx.activePiece,
      controlState.materialDebugMode,
      materialsSnapshot
    );
    applyEnvDebugMode(renderCtx, controlState.envDebugMode);
    cameraMode = 'game';
    transitionCamera(renderCtx, renderCtx.cameraBasePlacement);
    ensureDestructionPanel(renderCtx);
    logVisualParameters(renderCtx);
  }

  function loop() {
    rebuildContextIfNeeded();
    const now = performance.now();
    const dt = Math.max(0, now - lastFrameTime);
    lastFrameTime = now;
    if (destructionSim && !showSourceRegion) {
      const withStarts = launchScheduledExplosions(destructionSim, now);
      const stepped = stepDestructionSimulations(withStarts.state, dt, getFragmentPhysicsConfig());
      destructionSim = stepped.state;
      applyDestructionMask(snapshot.board, destructionSim);
      if (destructionSim.rows.finished) {
        destructionSim = null;
      }
    }
    renderFragmentInstances(renderCtx, destructionSim);
    renderScene(renderCtx, snapshot);
    applyCameraMode(
      renderCtx,
      cameraMode,
      orbitControllerRef,
      dt,
      controlState.autoRotateEnabled,
      () => {
        gameRotationAngle += GAME_MODE_ROTATION_SPEED * dt;
        return gameRotationAngle;
      }
    );
    renderFrame(renderCtx, dt);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  ensureDestructionPanel(renderCtx);
  window.addEventListener('resize', () => {
    resizeRenderer(renderCtx, canvas.clientWidth, canvas.clientHeight);
  });

  attachControlsDisposalOnUnload(controls);
  attachOrbitDisposalOnUnload(orbitControllerRef, canvas);
  attachCameraModeToggle(() => {
    if (cameraMode === 'game') {
      switchToInspect();
    } else {
      switchToGame();
    }
  });
  attachCloseupHotkey(renderCtx, orbitControllerRef, () => {
    cameraMode = 'inspect';
    switchToInspect(createCloseupPlacement(renderCtx));
  });

  function restoreMeshMaterial(mesh: THREE.Mesh) {
    const orig = mesh.userData.originalMaterial as THREE.Material | undefined;
    if (orig) {
      mesh.material = orig;
    }
  }

  function setHighlight(mesh: THREE.Mesh | null) {
    if (mesh === highlightedMesh) {
      return;
    }
    if (highlightedMesh) {
      restoreMeshMaterial(highlightedMesh);
    }
    highlightedMesh = mesh;
    if (mesh) {
      const highlightMat = new THREE.MeshBasicMaterial({ color: 0xfff38a, wireframe: true });
      mesh.material = highlightMat;
    }
  }

  function attachHoverHighlight(ctx: RenderContext): void {
    const canvas = ctx.renderer.domElement;
    const onMove = (ev: PointerEvent) => {
      if (!showSourceRegion || !sourceRegionGroup) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, ctx.camera);
      const hits = raycaster.intersectObjects(sourceRegionGroup.children, false);
      const mesh = (hits[0]?.object as THREE.Mesh | undefined) ?? null;
      setHighlight(mesh);
      const tplId = mesh?.userData.templateId as number | undefined;
      if (sourceOverlay) {
        drawOverlay(sourceOverlay, tplId);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener(
      'beforeunload',
      () => {
        canvas.removeEventListener('pointermove', onMove);
      },
      { once: true }
    );
  }

  function buildSourceOverlay(polygons: { id: number; vertices: { x: number; y: number }[] }[]) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.right = '12px';
    container.style.bottom = '12px';
    container.style.width = '220px';
    container.style.height = '220px';
    container.style.background = 'rgba(10,10,12,0.85)';
    container.style.border = '1px solid rgba(255,255,255,0.12)';
    container.style.borderRadius = '8px';
    container.style.zIndex = '2100';
    container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)';
    const label = document.createElement('div');
    label.textContent = 'Front face UV map';
    label.style.color = '#d6d6d6';
    label.style.fontSize = '12px';
    label.style.fontFamily = 'sans-serif';
    label.style.padding = '6px 8px 2px';
    container.appendChild(label);
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 180;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto 6px';
    container.appendChild(canvas);
    document.body.appendChild(container);
    drawOverlay({ container, canvas, polygons, rect: DEFAULT_FACE_UV_RECTS.front }, null);
    return { container, canvas, polygons, rect: DEFAULT_FACE_UV_RECTS.front };
  }

  function drawOverlay(
    overlay: {
      container: HTMLDivElement;
      canvas: HTMLCanvasElement;
      polygons: { id: number; vertices: { x: number; y: number }[] }[];
      rect: FaceUvRect;
    },
    highlightId: number | null | undefined
  ) {
    const ctx2d = overlay.canvas.getContext('2d');
    if (!ctx2d) return;
    ctx2d.clearRect(0, 0, overlay.canvas.width, overlay.canvas.height);
    const pad = 10;
    const w = overlay.canvas.width - pad * 2;
    const h = overlay.canvas.height - pad * 2;
    ctx2d.strokeStyle = '#4d82ff';
    ctx2d.lineWidth = 1;
    ctx2d.strokeRect(pad, pad, w, h);
    overlay.polygons.forEach((poly) => {
      const isHl = poly.id === highlightId;
      ctx2d.beginPath();
      poly.vertices.forEach((v, idx) => {
        const sx = pad + (v.x + 0.5) * w;
        const sy = pad + (1 - (v.y + 0.5)) * h;
        if (idx === 0) ctx2d.moveTo(sx, sy);
        else ctx2d.lineTo(sx, sy);
      });
      ctx2d.closePath();
      ctx2d.strokeStyle = isHl ? '#ffed8a' : '#9fb4ff';
      ctx2d.lineWidth = isHl ? 2 : 1;
      if (isHl) {
        ctx2d.fillStyle = 'rgba(255, 237, 138, 0.2)';
        ctx2d.fill();
      }
      ctx2d.stroke();
    });
  }
  function clearSourceRegionGroup(): void {
    if (sourceRegionGroup) {
      renderCtx.scene.remove(sourceRegionGroup);
      sourceRegionGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
        }
      });
      sourceRegionGroup = null;
    }
    showSourceRegion = false;
    if (sourceOverlay) {
      sourceOverlay.container.remove();
      sourceOverlay = null;
    }
    if (highlightedMesh) {
      restoreMeshMaterial(highlightedMesh);
      highlightedMesh = null;
    }
  }

  function showStaticSourceRegion(ctx: RenderContext): void {
    clearSourceRegionGroup();
    destructionSim = null;
    renderFragmentInstances(ctx, null);
    let lib;
    const templateSet = getDefaultShardTemplateSet();
    try {
      lib = buildShardGeometryLibrary(templateSet);
    } catch (err) {
      console.error('[visual debug] failed to build shard geometry library', err);
      return;
    }
    const group = new THREE.Group();
    const size = {
      sx: ctx.renderConfig.board.blockSize,
      sy: ctx.renderConfig.board.blockSize,
      sz: ctx.renderConfig.board.blockDepth,
    };
    const cubeWorldPos = new THREE.Vector3(0, ctx.renderConfig.board.blockSize * 1.25, 0);
    const offsetBase = size.sx * 0.14;
    const polygons2D: { id: number; vertices: { x: number; y: number }[] }[] = [];
    templateSet.templates.forEach((tpl) => {
      const frag = makeFragmentFromTemplate({
        templateId: tpl.id,
        cubeWorldPos,
        cubeSize: size,
        geometryLib: lib,
      });
      const normal = FACE_NORMALS[tpl.face].clone();
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * size.sx * 0.08,
        (Math.random() - 0.5) * size.sy * 0.08,
        (Math.random() - 0.5) * size.sz * 0.08
      );
      const offsetPos = frag.worldCenter.clone().add(normal.multiplyScalar(offsetBase)).add(jitter);
      const mesh = new THREE.Mesh(frag.geometry, ctx.fragments.materials[frag.materialId]);
       mesh.userData.templateId = tpl.id;
       mesh.userData.originalMaterial = mesh.material;
      mesh.matrixAutoUpdate = false;
      const m = frag.matrix.clone();
      m.setPosition(offsetPos);
      mesh.applyMatrix4(m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
       if (tpl.face === CubeFace.Front) {
         const verts = tpl.polygon2D.vertices.map((v) => ({
           x: v.x,
           y: v.y,
         }));
         polygons2D.push({ id: tpl.id, vertices: verts });
       }
    });
    ctx.scene.add(group);
    sourceRegionGroup = group;
    sourceOverlay = buildSourceOverlay(polygons2D);
    attachHoverHighlight(ctx);
    showSourceRegion = true;
    cameraMode = 'inspect';
    switchToInspect();
    console.info('[visual debug] source region view enabled');
    attachFractureHover(renderCtx);
  }
}

function createStaticSnapshot(dimensions: BoardDimensions): GameState {
  const base = createInitialGameState({ board: dimensions });
  const board = buildStaticBoard(dimensions);
  return {
    ...base,
    board,
    currentPiece: null,
    gameStatus: GameStatus.Paused,
    timing: { ...base.timing, fallProgressMs: 0 },
  };
}

function buildStaticBoard(dimensions: BoardDimensions): Board {
  const board = Board.createEmpty(dimensions);
  const filledLayers = Math.min(
    dimensions.height,
    Math.max(4, Math.floor(dimensions.height * 0.3))
  );

  for (let y = 0; y < filledLayers; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      board.setCell({ x, y }, CellContent.Block);
    }
  }

  const accentLayer = Math.min(dimensions.height - 1, filledLayers + 1);
  for (let x = 0; x < dimensions.width; x += 2) {
    board.setCell({ x, y: accentLayer }, CellContent.Block);
  }

  return board;
}

function configToControlState(config: RenderConfig): VisualControlState {
  const delta = config.camera.position.clone().sub(config.camera.target);
  return {
    fov: config.camera.fov,
    cameraDistance: delta.length(),
    cameraHeight: config.camera.position.y,
    towerRadius: config.board.towerRadius,
    ambientIntensity: config.lights.ambient.intensity,
    hemisphereIntensity: config.lights.hemisphere.intensity,
    keyIntensity: config.lights.key.intensity,
    autoRotateEnabled: false,
    qualityLevel: config.quality.level,
    materialDebugMode: 'none',
    envDebugMode: 'full',
  };
}

interface CameraOrientation {
  target: THREE.Vector3;
  azimuthXZ: THREE.Vector2;
}

function extractCameraOrientation(config: RenderConfig): CameraOrientation {
  const target = config.camera.target.clone();
  const azimuthVector = new THREE.Vector2(
    config.camera.position.x - target.x,
    config.camera.position.z - target.z
  );
  const azimuthXZ =
    azimuthVector.lengthSq() > 0 ? azimuthVector.normalize() : new THREE.Vector2(1, 0);
  return { target, azimuthXZ };
}

function controlStateToOverrides(
  state: VisualControlState,
  orientation: CameraOrientation
): RenderConfigOverrides {
  const dy = state.cameraHeight - orientation.target.y;
  const horizontal = Math.max(0.01, Math.sqrt(Math.max(state.cameraDistance ** 2 - dy ** 2, 0)));
  const position = new THREE.Vector3(
    orientation.target.x + orientation.azimuthXZ.x * horizontal,
    state.cameraHeight,
    orientation.target.z + orientation.azimuthXZ.y * horizontal
  );

  return {
    camera: {
      fov: state.fov,
      position,
      target: orientation.target.clone(),
    },
    board: {
      towerRadius: state.towerRadius,
    },
    lights: {
      ambient: { intensity: state.ambientIntensity },
      hemisphere: { intensity: state.hemisphereIntensity },
      key: { intensity: state.keyIntensity },
    },
    quality: { level: state.qualityLevel as QualityLevel },
    environment: deriveEnvOverrides(state.envDebugMode),
    renderMode: { ...VISUAL_DEBUG_RENDER_MODE },
  };
}

function disposeRenderResources(ctx: RenderContext): void {
  ctx.board.geometry.dispose();
  disposeMaterials(ctx.board.material);
  ctx.activePiece.geometry.dispose();
  disposeMaterials(ctx.activePiece.material);
  disposeMeshes(ctx.boardPlaceholder);
  ctx.environment?.dispose();
  ctx.post?.composer.dispose();
  ctx.renderer.dispose();
}

function disposeMeshes(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material?.dispose();
      }
    }
  });
}

function disposeMaterials(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
    return;
  }
  material.dispose();
}

function attachControlsDisposalOnUnload(controls: VisualDebugControls): void {
  window.addEventListener(
    'beforeunload',
    () => {
      controls.dispose();
    },
    { once: true }
  );
}

function attachOrbitDisposalOnUnload(
  ref: { current: OrbitCameraController | null },
  canvas: HTMLCanvasElement
): void {
  window.addEventListener(
    'beforeunload',
    () => {
      ref.current?.detach(canvas);
    },
    { once: true }
  );
}

function attachCameraModeToggle(onToggle: () => void): void {
  const handler = (ev: KeyboardEvent) => {
    if (ev.key.toLowerCase() === CAMERA_TOGGLE_KEY) {
      onToggle();
    }
  };
  window.addEventListener('keydown', handler);
  window.addEventListener(
    'beforeunload',
    () => {
      window.removeEventListener('keydown', handler);
    },
    { once: true }
  );
}

function attachCloseupHotkey(
  ctx: RenderContext,
  orbitRef: { current: OrbitCameraController | null },
  onCloseup: () => void
): void {
  const handler = (ev: KeyboardEvent) => {
    if (ev.key.toLowerCase() === CLOSEUP_KEY) {
      onCloseup();
    }
  };
  window.addEventListener('keydown', handler);
  window.addEventListener(
    'beforeunload',
    () => {
      window.removeEventListener('keydown', handler);
    },
    { once: true }
  );
}

function attachPanelDisposalOnUnload(dispose: () => void): void {
  window.addEventListener(
    'beforeunload',
    () => {
      dispose();
    },
    { once: true }
  );
}

function transitionCamera(
  ctx: RenderContext,
  targetPlacement: { position: THREE.Vector3; target: THREE.Vector3 }
): void {
  const startPos = ctx.camera.position.clone();
  const startTarget = ctx.renderConfig.camera.target.clone();
  const endPos = targetPlacement.position.clone();
  const endTarget = targetPlacement.target.clone();
  const startTime = performance.now();

  function step() {
    const t = Math.min(1, (performance.now() - startTime) / TRANSITION_DURATION_MS);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
    ctx.camera.position.lerpVectors(startPos, endPos, eased);
    const nextTarget = startTarget.clone().lerp(endTarget, eased);
    ctx.camera.lookAt(nextTarget);
    ctx.renderConfig.camera.position.copy(ctx.camera.position);
    ctx.renderConfig.camera.target.copy(nextTarget);
    if (t < 1) {
      requestAnimationFrame(step);
    }
  }

  step();
}

function applyCameraMode(
  ctx: RenderContext,
  mode: CameraMode,
  orbitRef: { current: OrbitCameraController | null },
  dtMs: number,
  autoRotateEnabled: boolean,
  nextAngle: () => number
): void {
  if (mode === 'inspect') {
    orbitRef.current?.update();
    return;
  }
  const offset = autoRotateEnabled ? nextAngle() : 0;
  const base = ctx.cameraBasePlacement;
  const rotated = new THREE.Vector3(
    base.position.x * Math.cos(offset) - base.position.z * Math.sin(offset),
    base.position.y,
    base.position.x * Math.sin(offset) + base.position.z * Math.cos(offset)
  );
  ctx.camera.position.copy(rotated);
  ctx.camera.lookAt(base.target);
  ctx.renderConfig.camera.position.copy(rotated);
  ctx.renderConfig.camera.target.copy(base.target);
}

function createCloseupPlacement(ctx: RenderContext): {
  position: THREE.Vector3;
  target: THREE.Vector3;
} {
  const radius = Math.max(
    ctx.renderConfig.board.blockSize * 3.2,
    ctx.renderConfig.board.towerRadius * 0.9
  );
  const baseAzimuth = new THREE.Vector2(
    ctx.cameraBasePlacement.position.x,
    ctx.cameraBasePlacement.position.z
  );
  const dir = baseAzimuth.lengthSq() > 0 ? baseAzimuth.normalize() : new THREE.Vector2(1, 0);
  const targetY = Math.min(
    ctx.renderConfig.board.blockSize * 3,
    computeMidHeight(ctx.renderConfig.boardDimensions, ctx.renderConfig.board)
  );
  const target = new THREE.Vector3(0, targetY, 0);
  const position = new THREE.Vector3(
    dir.x * radius,
    targetY + ctx.renderConfig.board.blockSize * 0.6,
    dir.y * radius
  );
  return { position, target };
}

function getLevels(height: number): number[] {
  const result: number[] = [];
  for (let y = 0; y < height; y += 1) {
    result.push(y);
  }
  return result;
}

function computeMidHeight(dimensions: BoardDimensions, board: BoardRenderConfig): number {
  const towerHeight = (dimensions.height - 1) * board.verticalSpacing + board.blockSize;
  return towerHeight * 0.4;
}

function parseQualityFromUrl(search: string): QualityLevel | null {
  const params = new URLSearchParams(search);
  const raw = params.get('quality')?.toLowerCase();
  if (raw === 'ultra' || raw === 'medium' || raw === 'low') {
    return raw;
  }
  if (raw === 'ultra2' || raw === 'ultra_cinematic') {
    return 'ultra2';
  }
  return null;
}

function logVisualParameters(ctx: RenderContext): void {
  const { boardDimensions, board, camera, lights, postProcessing } = ctx.renderConfig;
  console.groupCollapsed('Visual debug mode');
  console.log('board', {
    dimensions: boardDimensions,
    blockSize: board.blockSize,
    verticalSpacing: board.verticalSpacing,
    towerRadius: board.towerRadius,
  });
  console.log('camera', {
    fov: camera.fov,
    position: camera.position.toArray(),
    target: camera.target.toArray(),
  });
  console.log('lights', {
    ambient: lights.ambient,
    hemisphere: lights.hemisphere,
    key: {
      ...lights.key,
      position: lights.key.position.toArray(),
      target: lights.key.target?.toArray(),
    },
    rim: {
      ...lights.rim,
      position: lights.rim.position.toArray(),
      target: lights.rim.target?.toArray(),
    },
  });
  console.log('postProcessing', postProcessing);
  console.groupEnd();
}
