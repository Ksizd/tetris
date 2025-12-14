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
  createHallRadiiOverlay,
} from '../render';
import {
  createVisualDebugControls,
  VisualControlState,
  VisualDebugControls,
} from './visualDebugControls';
import { ObjectInspector } from '../render/debug/objectInspector';
import { ObjectDebugInfo, readDebugTag } from '../render/debug/objectInspectorTypes';
import { OrbitCameraController } from './orbitCamera';
import { QualityLevel, RenderModeConfig } from '../render/renderConfig';
import { applyMaterialDebugMode, createMaterialsSnapshot } from '../render/materialDebug';
import { deriveEnvOverrides, applyEnvDebugMode } from '../render/envDebug';
import { applyHallMaterialPreview } from '../render/goldenHallDebug';
import {
  createDestructionDebugPanel,
  DestructionDebugPanel,
  FragmentDebugFilter,
} from './destructionDebugPanel';
import { createHallGeometryDebugPanel, HallGeometryDebugPanel } from './hallGeometryDebugPanel';
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
import { computeHallLayout, createDefaultHallLayoutConfig, HallLayoutRadii } from '../render/hallLayout';
import { deriveTowerRadii, measureCameraOrbit } from '../render/hallRadiiSources';
import { createGoldenHall, type GoldenHallInstance } from '../render/goldenHallScene';
import { collectHallSnapshot } from '../render/debug/hallGeometrySnapshot';
import { analyzeHallGeometry, HallGeometryViolation } from '../render/debug/hallGeometryMonitor';
import { buildHallBugTemplate, buildHallGeometryFrameLog } from '../render/debug/hallGeometryReport';
import { PlatformLayout } from '../render/platformLayout';
import { computeFootprintAngleOffsetRad } from '../render/footprintAngles';
import {
  buildFootprintLavaSparksReport,
  requestFootprintLavaSparksStepOnce,
  setFootprintLavaSparksEmittersVisible,
  setFootprintLavaSparksFrozen,
} from '../render/footprintLavaSparksDebug';

type CameraMode = 'game' | 'inspect';

const QUERY_FLAG = 'visualDebug';
const ULTRA2_FLAG = 'ultra2lab';
const LAB_FLAG = 'lab';
const CAMERA_TOGGLE_KEY = 'c';
const CLOSEUP_KEY = 'v';
const TRANSITION_DURATION_MS = 450;
const GAME_MODE_ROTATION_SPEED = 0.00035;
const VISUAL_DEBUG_RENDER_MODE: RenderModeConfig = {
  kind: 'visualDebug',
  showGuides: false,
  showDebugRing: false,
  showColliders: false,
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

function isHallGeometryLabModeEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(LAB_FLAG);
  return value === 'hallGeometry';
}

export function startVisualDebugMode(canvas: HTMLCanvasElement): void {
  const ultra2Lab = isUltra2LabModeEnabled();
  const hallGeometryLab = isHallGeometryLabModeEnabled();
  const qualityFromUrl = ultra2Lab ? 'ultra2' : parseQualityFromUrl(window.location.search);
  const baseOverrides: RenderConfigOverrides = { renderMode: { ...VISUAL_DEBUG_RENDER_MODE } };
  const renderOverrides: RenderConfigOverrides = qualityFromUrl
    ? { ...baseOverrides, quality: { level: qualityFromUrl } }
    : baseOverrides;
  let labPlatformOffset = 0;
  let labFootprintOffset = 0;
  let labFootprintScale = 1;
  let sparksFrozen = false;
  let sparksEmittersVisible = false;
  let renderCtx = createRenderContext(canvas, renderOverrides);
  let snapshot = createStaticSnapshot(renderCtx.renderConfig.boardDimensions, hallGeometryLab ? 2 : undefined);
  let controlState = configToControlState(renderCtx.renderConfig);
  if (hallGeometryLab) {
    controlState.showHallShell = false;
    controlState.showHallFx = false;
    controlState.autoRotateEnabled = false;
    controlState.hallMaterialMode = 'off';
  }
  if (hallGeometryLab) {
    renderCtx.activePiece.mesh.visible = false;
    renderCtx.ghost?.mesh && (renderCtx.ghost.mesh.visible = false);
    renderCtx.fragments?.meshesByTemplate.forEach((m) => (m.visible = false));
    applyHallGeometryLabTransforms();
  }
  let materialsSnapshot = createMaterialsSnapshot(renderCtx.board, renderCtx.activePiece);
  let hallOverlay: ReturnType<typeof createHallRadiiOverlay> | null = null;
  let destructionSim: DestructionSimulationState | null = null;
  let fragmentFilter: FragmentDebugFilter = 'all';
  let showLockFxBursts = true;
  let fractureDebugGroup: THREE.Group | null = null;
  let hallGeometryPanel: HallGeometryDebugPanel | null = null;
  let hallGeometryOverlay: THREE.Group | null = null;
  let lastHallSnapshot: ReturnType<typeof collectHallSnapshot> | null = null;
  let hallViolations: HallGeometryViolation[] = [];
  let hallAutoAnalyze = false;
  let hallLastAnalyzeMs = 0;
  let selectedViolation: HallGeometryViolation | null = null;
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
  let objectInspector: ObjectInspector | null = null;
  let inspectorHighlight: THREE.LineSegments | null = null;
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
  const disposeHallRadiiOverlay = () => {
    if (hallOverlay) {
      renderCtx.scene.remove(hallOverlay.group);
      hallOverlay.dispose();
      hallOverlay = null;
    }
  };

  const clearInspectorHighlight = () => {
    if (inspectorHighlight) {
      renderCtx.scene.remove(inspectorHighlight);
      inspectorHighlight.geometry.dispose();
      (inspectorHighlight.material as THREE.Material).dispose();
      inspectorHighlight = null;
    }
  };

  const updateInspectorHighlight = (info: ObjectDebugInfo | null) => {
    clearInspectorHighlight();
    if (!info?.object) {
      return;
    }
    const box = new THREE.Box3();
    if ((info.object as THREE.Mesh).isInstancedMesh && info.instanceId !== undefined) {
      const inst = info.object as THREE.InstancedMesh;
      const geom = inst.geometry as THREE.BufferGeometry;
      if (!geom.boundingBox) {
        geom.computeBoundingBox();
      }
      const bbox = geom.boundingBox;
      const matrix = new THREE.Matrix4();
      inst.getMatrixAt(info.instanceId, matrix);
      box.copy(bbox ?? new THREE.Box3()).applyMatrix4(matrix).applyMatrix4(inst.matrixWorld);
    } else {
      box.setFromObject(info.object);
    }
    if (!box.isEmpty()) {
      const helper = new THREE.Box3Helper(box, 0x66ff66);
      helper.renderOrder = 999;
      helper.userData.debugSelectable = false;
      // Avoid inspector ray hits on the helper itself.
      helper.raycast = () => undefined;
      inspectorHighlight = helper;
      renderCtx.scene.add(helper);
    }
  };

  const ensureInspector = () => {
    if (controlState.inspectorEnabled) {
      if (!objectInspector) {
        objectInspector = new ObjectInspector({
          camera: renderCtx.camera,
          scene: renderCtx.scene,
          renderMode: renderCtx.renderConfig.renderMode,
          domElement: canvas,
          onSelect: (_sel, info) => {
            updateInspectorUI(info ?? null);
            updateInspectorHighlight(info ?? null);
          },
        });
      }
      objectInspector.enable();
      canvas.style.cursor = 'crosshair';
      orbitControllerRef.current?.detach(canvas);
    } else if (objectInspector) {
      objectInspector.disable();
      objectInspector = null;
      updateInspectorUI(null);
      clearInspectorHighlight();
      canvas.style.cursor = '';
      if (cameraMode === 'inspect' && !orbitControllerRef.current) {
        createOrbit();
      }
    }
  };

  const ensureHallGeometryPanel = (ctx: RenderContext) => {
    if (hallGeometryPanel) {
      return;
    }
    hallGeometryPanel = createHallGeometryDebugPanel({
      onAnalyze: () => runHallAnalysis(ctx),
      onToggleAuto: (enabled) => {
        hallAutoAnalyze = enabled;
        hallGeometryPanel?.setAutoAnalyze(enabled);
      },
      onSelectViolation: (v) => {
        selectedViolation = v ?? null;
        rebuildHallGeometryOverlay(ctx);
      },
      onCopyReport: () => copyHallGeometryReport(ctx),
      onCopyFootprintInlayReport: () => copyFootprintInlayReport(ctx),
      onCopySnapshot: () => copyHallGeometrySnapshotJson(ctx),
      onCopyBugTemplate: () => copyHallBugTemplate(ctx),
      onPlatformOffsetChange: (v) => {
        labPlatformOffset = v;
        applyHallGeometryLabTransforms();
        runHallAnalysis(ctx);
      },
      onFootprintOffsetChange: (v) => {
        labFootprintOffset = v;
        applyHallGeometryLabTransforms();
        runHallAnalysis(ctx);
      },
      onFootprintScaleChange: (v) => {
        labFootprintScale = v;
        applyHallGeometryLabTransforms();
        runHallAnalysis(ctx);
      },
      onToggleSparksFrozen: (enabled) => {
        sparksFrozen = enabled;
        const fx = ctx.goldenPlatform?.footprintSparksFx;
        if (fx) {
          setFootprintLavaSparksFrozen(fx, enabled);
        }
      },
      onToggleSparkEmitters: (enabled) => {
        sparksEmittersVisible = enabled;
        const fx = ctx.goldenPlatform?.footprintSparksFx;
        if (fx) {
          setFootprintLavaSparksEmittersVisible(fx, enabled);
        }
      },
      onStepSparksOneFrame: () => {
        const fx = ctx.goldenPlatform?.footprintSparksFx;
        if (fx) {
          requestFootprintLavaSparksStepOnce(fx);
        }
      },
      onCopySparksReport: () => copyFootprintSparksReport(ctx),
    });
    hallGeometryPanel.setSparksFrozen(sparksFrozen);
    hallGeometryPanel.setShowSparkEmitters(sparksEmittersVisible);
  };
  const ensureHallRadiiOverlay = (state: VisualControlState) => {
    if (!state.showHallRadii) {
      disposeHallRadiiOverlay();
      return;
    }
    if (!hallOverlay) {
      hallOverlay = createHallRadiiOverlay(renderCtx.hallLayout, renderCtx.towerBounds.center);
      renderCtx.scene.add(hallOverlay.group);
    } else {
      hallOverlay.group.visible = true;
    }
    hallOverlay.update(renderCtx.hallLayout, renderCtx.towerBounds.center);
    validateHallOrdering(renderCtx.hallLayout);
  };

  function measureHallFloorTop(hall: GoldenHallInstance): number | null {
    let box: THREE.Box3 | null = null;
    hall.baseGroup.updateMatrixWorld(true);
    hall.baseGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const tag = (mesh as any).userData?.debugTag;
      const name = mesh.name ?? '';
      const parentName = mesh.parent?.name ?? '';
      const isFloorTagged = tag?.kind === 'hallFloor';
      const isFloorByName =
        name.includes('step') ||
        name.includes('center') ||
        parentName.includes('hall-base');
      if (!isFloorTagged && !isFloorByName) return;
      const b = new THREE.Box3().setFromObject(mesh);
      box = box ? box.union(b) : b;
    });
    return box ? box.max.y : null;
  }

  function alignHallInLab(platformLayout: PlatformLayout, hall: GoldenHallInstance, platformOffset: number): void {
    const ringATop = platformLayout.baseY + platformLayout.ringA.height + platformOffset;
    hall.baseGroup.position.y = ringATop;
    hall.hallGroup.position.y = ringATop;
    hall.fxGroup.position.y = ringATop;
    const hallFloorTop = measureHallFloorTop(hall);
    if (hallFloorTop === null) {
      return;
    }
    const blockSize = hall.layout.footprint.blockSize;
    const grooveD = THREE.MathUtils.clamp(blockSize * 0.08, blockSize * 0.04, blockSize * 0.08);
    const desiredTop = ringATop - grooveD - 0.002;
    const delta = hallFloorTop - desiredTop;
    if (Math.abs(delta) > 1e-6) {
      hall.baseGroup.position.y -= delta;
      hall.hallGroup.position.y -= delta;
      hall.fxGroup.position.y -= delta;
      hall.baseGroup.updateMatrixWorld(true);
    }
  }

  function applyHallGeometryLabTransforms(): void {
    if (!hallGeometryLab) {
      return;
    }
    if (renderCtx.goldenPlatform?.mesh) {
      renderCtx.goldenPlatform.mesh.position.y = labPlatformOffset;
    }
    if (renderCtx.footprintDecor) {
      renderCtx.footprintDecor.position.y = labFootprintOffset;
      renderCtx.footprintDecor.scale.set(labFootprintScale, 1, labFootprintScale);
    }
    if (renderCtx.goldenPlatform?.layout && renderCtx.goldenHall) {
      alignHallInLab(renderCtx.goldenPlatform.layout, renderCtx.goldenHall, labPlatformOffset);
    }
  }

  const disposeHallGeometryOverlay = () => {
    if (hallGeometryOverlay) {
      renderCtx.scene.remove(hallGeometryOverlay);
      hallGeometryOverlay.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat?.dispose();
          }
        }
        if ((obj as THREE.LineSegments).isLine) {
          (obj as THREE.LineSegments).geometry?.dispose();
          (obj as THREE.LineSegments).material?.dispose?.();
        }
      });
      hallGeometryOverlay = null;
    }
  };

  const rebuildHallGeometryOverlay = (ctx: RenderContext, snap: ReturnType<typeof collectHallSnapshot> | null = lastHallSnapshot) => {
    disposeHallGeometryOverlay();
    if (!snap || !controlState.showHallGeometryOverlay) {
      return;
    }
    const group = new THREE.Group();
    group.name = 'hall-geometry-debug-overlay';
    group.userData.debugSelectable = false;

    const addCircle = (radius: number, y: number, color: number, name: string) => {
      const segments = Math.max(48, Math.round(radius * 16));
      const pts: number[] = [];
      for (let i = 0; i <= segments; i += 1) {
        const t = (i / segments) * Math.PI * 2;
        pts.push(Math.cos(t) * radius, 0, Math.sin(t) * radius);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({ color, depthWrite: false, transparent: true, opacity: 0.5 });
      const line = new THREE.LineLoop(geom, mat);
      line.position.y = y;
      line.name = name;
      line.userData.debugSelectable = false;
      (line as any).raycast = () => undefined;
      group.add(line);
    };

    const floorY = -ctx.renderConfig.board.blockSize * 0.5;
    const towerHeight = ctx.renderConfig.boardDimensions.height * ctx.renderConfig.board.verticalSpacing;
    addCircle(ctx.renderConfig.board.towerRadius, floorY + towerHeight * 0.5, 0x3498db, 'tower-cylinder');
    const footprintRadius =
      snap.footprints.length > 0
        ? Math.max(...snap.footprints.map((f) => f.approxRadiusXZ ?? 0))
        : ctx.renderConfig.board.towerRadius;
    addCircle(footprintRadius, floorY + 0.001, 0xf39c12, 'footprint-outline');
    addCircle(ctx.hallLayout.hallInnerRadius, floorY + 0.002, 0xe67e22, 'hall-inner-outline');
    addCircle(ctx.goldenPlatform?.layout.ringA.outer ?? ctx.hallLayout.platformOuterRadius, ctx.goldenPlatform?.layout.baseY ?? floorY, 0x2ecc71, 'ringA-outline');
    addCircle(ctx.goldenPlatform?.layout.ringB.outer ?? ctx.hallLayout.platformOuterRadius, ctx.goldenPlatform?.layout.baseY ?? floorY, 0x9b59b6, 'ringB-outline');
    addCircle(ctx.goldenPlatform?.layout.ringC.outer ?? ctx.hallLayout.platformOuterRadius, ctx.goldenPlatform?.layout.baseY ?? floorY, 0xe74c3c, 'ringC-outline');

    const boxColor = (v: HallGeometryViolation) => (v.severity === 'error' ? 0xff4d62 : 0xf1c40f);
    const snapMap = new Map<string, ReturnType<typeof collectHallSnapshot>['towerCells'][number]>();
    [...snap.towerCells, ...snap.platformRings, ...snap.platformSides, ...snap.footprints, ...snap.hallFloor, ...snap.hallShells, ...snap.hallColumns, ...snap.others].forEach(
      (obj) => snapMap.set(obj.name || obj.id, obj)
    );

    hallViolations.forEach((v) => {
      v.objectsInvolved.forEach((name) => {
        const entry = snapMap.get(name);
        if (!entry) {
          return;
        }
        const b = new THREE.Box3();
        b.min.set(entry.bbox.min[0], entry.bbox.min[1], entry.bbox.min[2]);
        b.max.set(entry.bbox.max[0], entry.bbox.max[1], entry.bbox.max[2]);
        const helper = new THREE.Box3Helper(b, boxColor(v));
        helper.userData.debugSelectable = false;
        (helper as any).raycast = () => undefined;
        helper.visible = !selectedViolation || selectedViolation === v;
        group.add(helper);
      });
    });

    hallGeometryOverlay = group;
    ctx.scene.add(group);
  };

  const runHallAnalysis = (ctx: RenderContext) => {
    ensureHallGeometryPanel(ctx);
    lastHallSnapshot = collectHallSnapshot(ctx.scene);
    const platformLayout = ctx.goldenPlatform?.layout;
    if (!platformLayout) {
      hallViolations = [];
      hallGeometryPanel?.setViolations(hallViolations);
      disposeHallGeometryOverlay();
      return;
    }
    const result = analyzeHallGeometry({
      snapshot: lastHallSnapshot,
      hallLayout: ctx.hallLayout,
      platformLayout,
      columns: ctx.renderConfig.boardDimensions.width,
      footprintAngleOffsetRad: computeFootprintAngleOffsetRad(ctx.renderConfig.boardDimensions.width),
    });
    hallViolations = result.violations;
    hallGeometryPanel?.setViolations(hallViolations);
    hallGeometryPanel?.setLog(
      hallViolations.length
        ? hallViolations.map((v) => `${v.invariant} (${v.severity}): ${v.message}`)
        : ['No violations']
    );
    rebuildHallGeometryOverlay(ctx, lastHallSnapshot);
    hallLastAnalyzeMs = performance.now();
  };

  const copyHallGeometryReport = (ctx: RenderContext) => {
    const lines: string[] = [];
    lines.push('HALL_GEOMETRY_REPORT_BEGIN');
    lines.push(`Scenario: ${hallGeometryLab ? 'hallGeometryLab' : 'visualDebug'}`);
    lines.push(`HallLayout:`);
    lines.push(
      `  towerRadius: ${ctx.hallLayout.towerOuterRadius.toFixed(3)} | hallInner: ${ctx.hallLayout.hallInnerRadius.toFixed(
        3
      )} | platformOuter: ${ctx.hallLayout.platformOuterRadius.toFixed(3)}`
    );
    if (ctx.goldenPlatform?.layout) {
      const l = ctx.goldenPlatform.layout;
      lines.push(
        `  ringA.outer: ${l.ringA.outer.toFixed(3)} yTop: ${(l.baseY + l.ringA.height).toFixed(3)}`
      );
      lines.push(
        `  ringB.outer: ${l.ringB.outer.toFixed(3)} yTop: ${(l.baseY + l.ringB.height).toFixed(3)}`
      );
      lines.push(
        `  ringC.outer: ${l.ringC.outer.toFixed(3)} yTop: ${(l.baseY + l.ringC.height).toFixed(3)}`
      );
    }
    lines.push('Violations:');
    if (!hallViolations.length) {
      lines.push('- none');
    } else {
      hallViolations.forEach((v) => {
        lines.push(`- ${v.invariant} (${v.severity})`);
        lines.push(`  message: "${v.message}"`);
        lines.push(`  objects: ${v.objectsInvolved.join(', ')}`);
        lines.push(`  details: ${JSON.stringify(v.details)}`);
      });
    }
    lines.push('HALL_GEOMETRY_REPORT_END');
    const text = lines.join('\n');
    copyToClipboardOrConsole(text, '[hallGeometry] report copy failed');
  };

  const copyFootprintInlayReport = (ctx: RenderContext) => {
    if (!ctx.goldenPlatform?.layout) {
      return;
    }
    const lines: string[] = [];
    const board = ctx.renderConfig.board;
    const layout = ctx.goldenPlatform.layout;
    const t = ctx.clock.getElapsedTime();

    const R0 = board.towerRadius - board.blockDepth * 0.5;
    const R1 = board.towerRadius + board.blockDepth * 0.5;
    const grooveW = Math.min(board.blockDepth * 0.1, Math.max(board.blockDepth * 0.06, board.blockDepth * 0.08));
    const grooveD = Math.min(board.blockSize * 0.08, Math.max(board.blockSize * 0.04, board.blockSize * 0.08));
    const microBevelHeight = grooveD * 0.12;
    const ringATopY = layout.baseY + layout.ringA.height;
    const lavaSurfaceY = ringATopY - grooveD + microBevelHeight * 0.95;

    lines.push('FOOTPRINT_INLAY_REPORT_BEGIN');
    lines.push(`Scenario: ${hallGeometryLab ? 'hallGeometryLab' : 'visualDebug'}`);
    lines.push(`Mode: inlayLava`);
    lines.push(
      `Debug: wireframe=${controlState.showFootprintInlayWireframe} lavaUV=${controlState.showFootprintLavaUV}`
    );
    lines.push(`Time: freeze=${controlState.disableFootprintLavaAnimation} t=${t.toFixed(3)}`);
    lines.push('Band:');
    lines.push(`  innerR: ${R0.toFixed(3)} | outerR: ${R1.toFixed(3)}`);
    lines.push('Channels:');
    lines.push(`  grooveW: ${grooveW.toFixed(3)} | grooveD: ${grooveD.toFixed(3)}`);
    lines.push('Y:');
    lines.push(
      `  ringATopY: ${ringATopY.toFixed(3)} | engraveDepth: ${grooveD.toFixed(3)} | lavaSurfaceY: ${lavaSurfaceY.toFixed(3)}`
    );
    lines.push('BBoxes:');
    lines.push(
      `  gold: min=${[-R1, ringATopY - grooveD, -R1].map((v) => v.toFixed(3)).join(',')} max=${[
        R1,
        ringATopY,
        R1,
      ]
        .map((v) => v.toFixed(3))
        .join(',')}`
    );
    const lavaR = Math.max(0, R1 - grooveW);
    lines.push(
      `  lava: min=${[-lavaR, lavaSurfaceY, -lavaR].map((v) => v.toFixed(3)).join(',')} max=${[
        lavaR,
        lavaSurfaceY,
        lavaR,
      ]
        .map((v) => v.toFixed(3))
        .join(',')}`
    );

    lines.push('Materials:');
    const mats = Array.isArray(ctx.goldenPlatform.mesh.material) ? ctx.goldenPlatform.mesh.material : [];
    const describeMaterial = (mat: unknown) => {
      const m = mat as any;
      const type = m?.type ?? typeof mat;
      const roughness = typeof m?.roughness === 'number' ? m.roughness.toFixed(3) : undefined;
      const metalness = typeof m?.metalness === 'number' ? m.metalness.toFixed(3) : undefined;
      const color = m?.color?.getHexString ? `#${m.color.getHexString()}` : undefined;
      const toneMapped = typeof m?.toneMapped === 'boolean' ? m.toneMapped : undefined;
      const depthTest = typeof m?.depthTest === 'boolean' ? m.depthTest : undefined;
      const depthWrite = typeof m?.depthWrite === 'boolean' ? m.depthWrite : undefined;
      const uniforms = m?.uniforms as Record<string, { value: any }> | undefined;
      const intensity =
        uniforms?.uIntensity && typeof uniforms.uIntensity.value === 'number'
          ? uniforms.uIntensity.value.toFixed(3)
          : undefined;
      const debugUv =
        uniforms?.uDebugLavaUV && typeof uniforms.uDebugLavaUV.value === 'number'
          ? uniforms.uDebugLavaUV.value
          : undefined;
      return {
        type,
        color,
        roughness,
        metalness,
        toneMapped,
        depthTest,
        depthWrite,
        intensity,
        debugUv,
      };
    };
    lines.push(`  goldTop: ${JSON.stringify(describeMaterial(mats[0] ?? null))}`);
    lines.push(`  goldCarve: ${JSON.stringify(describeMaterial(mats[1] ?? null))}`);
    lines.push(`  lavaBottom: ${JSON.stringify(describeMaterial(mats[2] ?? null))}`);

    const sparkFxObj = (() => {
      let found: THREE.Object3D | null = null;
      ctx.goldenPlatform.mesh.traverse((obj) => {
        if (!found && obj.name === 'footprintLavaSparksFx') {
          found = obj;
        }
      });
      return found;
    })();

    lines.push('Sparks:');
    if (!sparkFxObj) {
      lines.push('  - none');
    } else {
      const u = sparkFxObj.userData as any;
      const activeCount = typeof u.activeCount === 'number' ? u.activeCount : null;
      const activeEmbers = typeof u.activeEmbers === 'number' ? u.activeEmbers : null;
      const activeDroplets = typeof u.activeDroplets === 'number' ? u.activeDroplets : null;
      const substeps = typeof u.substepsLastFrame === 'number' ? u.substepsLastFrame : null;
      lines.push(
        `  active: ${activeCount ?? 'n/a'} | embers: ${activeEmbers ?? 'n/a'} | droplets: ${activeDroplets ?? 'n/a'}`
      );
      lines.push(`  substepsLastFrame: ${substeps ?? 'n/a'}`);

      const sampleCount = typeof u.debugSampleCount === 'number' ? u.debugSampleCount : 0;
      const sampleKind = u.debugSampleKind as Uint8Array | undefined;
      const samplePos = u.debugSamplePos as Float32Array | undefined;
      const sampleVel = u.debugSampleVel as Float32Array | undefined;
      const sampleTemp = u.debugSampleTemp as Float32Array | undefined;
      const sampleAge = u.debugSampleAge as Float32Array | undefined;
      if (
        sampleCount > 0 &&
        sampleKind &&
        samplePos &&
        sampleVel &&
        sampleTemp &&
        sampleAge &&
        sampleKind.length >= sampleCount &&
        samplePos.length >= sampleCount * 3 &&
        sampleVel.length >= sampleCount * 3 &&
        sampleTemp.length >= sampleCount &&
        sampleAge.length >= sampleCount
      ) {
        const n = Math.min(3, sampleCount);
        for (let i = 0; i < n; i += 1) {
          const kind = sampleKind[i] === 1 ? 'droplet' : 'ember';
          const pos = [samplePos[i * 3 + 0], samplePos[i * 3 + 1], samplePos[i * 3 + 2]]
            .map((v) => v.toFixed(3))
            .join(',');
          const vel = [sampleVel[i * 3 + 0], sampleVel[i * 3 + 1], sampleVel[i * 3 + 2]]
            .map((v) => v.toFixed(3))
            .join(',');
          lines.push(
            `  sample${i}: ${kind} pos=${pos} vel=${vel} temp=${sampleTemp[i].toFixed(3)} age=${sampleAge[i].toFixed(3)}`
          );
        }
      }
    }

    lines.push('Objects:');
    const items: string[] = [];
    ctx.goldenPlatform.mesh.traverse((obj) => {
      const name = obj.name || obj.type;
      if (!name.toLowerCase().includes('footprint')) {
        return;
      }
      const tag = readDebugTag(obj);
      items.push(`- ${name}${tag?.kind ? ` (${tag.kind})` : ''}`);
    });
    if (!items.length) {
      lines.push('- none');
    } else {
      lines.push(...items);
    }

    lines.push('FOOTPRINT_INLAY_REPORT_END');
    const text = lines.join('\n');
    copyToClipboardOrConsole(text, '[footprintInlay] report copy failed');
  };

  const copyFootprintSparksReport = (ctx: RenderContext) => {
    const fx = ctx.goldenPlatform?.footprintSparksFx;
    if (!fx) {
      return;
    }
    const report = buildFootprintLavaSparksReport(fx);
    if (!report) {
      return;
    }
    const payload = {
      scenario: hallGeometryLab ? 'hallGeometryLab' : 'visualDebug',
      ...report,
    };
    const text = JSON.stringify(payload, null, 2);
    copyToClipboardOrConsole(text, '[sparksFx] report copy failed');
  };

  const copyHallGeometrySnapshotJson = (ctx: RenderContext) => {
    if (!lastHallSnapshot || !ctx.goldenPlatform?.layout) {
      return;
    }
    const frame = buildHallGeometryFrameLog({
      hallLayout: ctx.hallLayout,
      platformLayout: ctx.goldenPlatform.layout,
      snapshot: lastHallSnapshot,
      violations: hallViolations,
      engineVersion: 'dev',
    });
    const text = JSON.stringify(frame, null, 2);
    copyToClipboardOrConsole(text, '[hallGeometry] JSON snapshot copy failed');
  };

  const copyHallBugTemplate = (ctx: RenderContext) => {
    const reportLines: string[] = [];
    reportLines.push('Violations:');
    if (!hallViolations.length) {
      reportLines.push('- none');
    } else {
      hallViolations.forEach((v) => {
        reportLines.push(`- ${v.invariant} (${v.severity}): ${v.message}`);
      });
    }
    const text = buildHallBugTemplate(reportLines.join('\n'));
    copyToClipboardOrConsole(text, '[hallGeometry] bug template copy failed');
  };

  const copyToClipboardOrConsole = (text: string, failLog: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        console.info(failLog, 'dumping to console');
        console.log(text);
      });
    } else {
      console.log(text);
    }
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

  const updateInspectorUI = (info: ObjectDebugInfo | null) => {
    if (typeof controls?.updateInspector !== 'function') {
      return;
    }
    if (!info) {
      controls.updateInspector(null);
      return;
    }
    const tag = info.debugTag;
    const detailsParts: string[] = [];
    if (tag?.kind) {
      detailsParts.push(`kind: ${tag.kind}`);
    }
    if (tag?.boardCoords) {
      detailsParts.push(
        `boardCoords: ring=${tag.boardCoords.ring}, level=${tag.boardCoords.level}, height=${tag.boardCoords.height}`
      );
    }
    if (tag?.hallSection) {
      detailsParts.push(
        `hallSection: ring=${tag.hallSection.ring}, seg=${tag.hallSection.segmentIndex}${
          tag.hallSection.levelBand ? `, band=${tag.hallSection.levelBand}` : ''
        }`
      );
    }
    const selectedLabel = `${info.objectType}${info.name ? ` "${info.name}"` : ''}`;
    controls.updateInspector({
      selectedLabel,
      summary: info.summaryForLLM,
      json: info.jsonForLLM,
      details: detailsParts.join('\n') || 'debugTag: —',
    });
  };
  const controls = createVisualDebugControls(
    controlState,
    (next) => {
      const prev = controlState;
      controlState = next;
      if (prev.materialDebugMode !== next.materialDebugMode) {
        applyMaterialDebugMode(
          renderCtx.board,
          renderCtx.activePiece,
          next.materialDebugMode,
          materialsSnapshot
        );
      }
      if (prev.envDebugMode !== next.envDebugMode) {
        applyEnvDebugMode(renderCtx, next.envDebugMode);
      }
      if (prev.hallMaterialMode !== next.hallMaterialMode) {
        const hallOnly = next.hallMaterialMode !== 'off';
        renderCtx.board.mesh.visible = !hallOnly;
        renderCtx.activePiece.mesh.visible = !hallOnly;
        renderCtx.boardPlaceholder.visible = !hallOnly;
        applyHallMaterialPreview(
          renderCtx.scene,
          next.hallMaterialMode === 'hallOnly' ? 'off' : next.hallMaterialMode
        );
      }
      // Hall runtime toggles: visibility + brightness (geometry changes force rebuild).
      const needsRebuild =
        prev.qualityLevel !== next.qualityLevel ||
        prev.goldenHallEnabled !== next.goldenHallEnabled ||
        prev.hallWallHeight !== next.hallWallHeight;
      const hallVisibilityChanged =
        prev.showHallBase !== next.showHallBase ||
        prev.showHallShell !== next.showHallShell ||
        prev.showHallFx !== next.showHallFx ||
        prev.envDebugMode !== next.envDebugMode ||
        prev.goldenHallEnabled !== next.goldenHallEnabled;
      const hallBrightnessChanged = prev.hallBrightness !== next.hallBrightness;
      const hallRadiiChanged = prev.showHallRadii !== next.showHallRadii;
      const inspectorChanged = prev.inspectorEnabled !== next.inspectorEnabled;
      if (needsRebuild) {
        pendingRebuild = true;
      } else {
        updateHallVisibility(renderCtx, controlState);
      }
      if (inspectorChanged) {
        ensureInspector();
      }
      if (hallBrightnessChanged) {
        applyHallBrightness(renderCtx, controlState.hallBrightness);
      }
      if (hallRadiiChanged) {
        if (controlState.showHallRadii) {
          ensureHallRadiiOverlay(controlState);
        } else {
          disposeHallRadiiOverlay();
        }
      }
      ensureInspector();
      // existing toggles may also imply rebuild (e.g., key/ambient) through pendingRebuild flag.
      pendingRebuild = true;
    },
    () => {
      controlState = configToControlState(renderCtx.renderConfig);
      controlState.materialDebugMode = 'none';
      controlState.envDebugMode = 'full';
      controlState.autoRotateEnabled = false;
      controlState.showFootprintInlayWireframe = false;
      controlState.showFootprintLavaUV = false;
      controlState.disableFootprintLavaAnimation = false;
      controlState.hallMaterialMode = 'off';
      controlState.goldenHallEnabled = renderCtx.renderConfig.goldenHall.enabled;
      controlState.showHallBase = true;
      controlState.showHallShell = true;
      controlState.showHallFx = true;
      controlState.hallBrightness = 1;
      controlState.showHallRadii = false;
      renderCtx.board.mesh.visible = true;
      renderCtx.activePiece.mesh.visible = true;
      renderCtx.boardPlaceholder.visible = true;
      applyHallMaterialPreview(renderCtx.scene, 'off');
      updateHallVisibility(renderCtx, controlState);
      applyHallBrightness(renderCtx, controlState.hallBrightness);
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
      if (!showLockFxBursts && templateId === -1) {
        return;
      }
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

  function onLockFxVisibilityChange(visible: boolean) {
    showLockFxBursts = visible;
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
        onLockFxVisibilityChange: (visible) => {
          onLockFxVisibilityChange(visible);
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
    disposeHallRadiiOverlay();
    disposeHallGeometryOverlay();

    disposeRenderResources(renderCtx);
    const overrides = controlStateToOverrides(controlState, cameraOrientation);
    renderCtx = createRenderContext(canvas, overrides);
    snapshot = createStaticSnapshot(renderCtx.renderConfig.boardDimensions, hallGeometryLab ? 2 : undefined);
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
    const hallOnly = controlState.hallMaterialMode !== 'off';
    renderCtx.board.mesh.visible = !hallOnly;
    renderCtx.activePiece.mesh.visible = !hallOnly;
    renderCtx.boardPlaceholder.visible = !hallOnly;
    applyHallMaterialPreview(
      renderCtx.scene,
      controlState.hallMaterialMode === 'hallOnly' ? 'off' : controlState.hallMaterialMode
    );
    updateHallVisibility(renderCtx, controlState);
    applyHallBrightness(renderCtx, controlState.hallBrightness);
    ensureHallRadiiOverlay(controlState);
    if (hallGeometryLab) {
      renderCtx.activePiece.mesh.visible = false;
      renderCtx.ghost?.mesh && (renderCtx.ghost.mesh.visible = false);
      renderCtx.fragments?.meshesByTemplate.forEach((m) => (m.visible = false));
      applyHallGeometryLabTransforms();
      hallGeometryPanel?.setPlatformOffset(labPlatformOffset);
      hallGeometryPanel?.setFootprintOffset(labFootprintOffset);
      hallGeometryPanel?.setFootprintScale(labFootprintScale);
    }
    ensureHallGeometryPanel(renderCtx);
    runHallAnalysis(renderCtx);
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
    renderScene(renderCtx, snapshot, undefined, null, dt);
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
    updateHallLayoutFromCamera(renderCtx, controlState);
    if (controlState.showHallRadii) {
      ensureHallRadiiOverlay(controlState);
    }
    if (hallGeometryLab) {
      applyHallGeometryLabTransforms();
    }
    if (hallAutoAnalyze && now - hallLastAnalyzeMs > 1000) {
      runHallAnalysis(renderCtx);
    }
    renderFrame(renderCtx, dt);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  ensureDestructionPanel(renderCtx);
  attachPanelDisposalOnUnload(() => hallGeometryPanel?.dispose());
  ensureHallGeometryPanel(renderCtx);
  runHallAnalysis(renderCtx);
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

function createStaticSnapshot(dimensions: BoardDimensions, filledLayersOverride?: number): GameState {
  const base = createInitialGameState({ board: dimensions });
  const board = buildStaticBoard(dimensions, filledLayersOverride);
  return {
    ...base,
    board,
    currentPiece: null,
    gameStatus: GameStatus.Paused,
    timing: { ...base.timing, fallProgressMs: 0 },
  };
}

function buildStaticBoard(dimensions: BoardDimensions, filledLayersOverride?: number): Board {
  const board = Board.createEmpty(dimensions);
  const defaultLayers = Math.min(dimensions.height, Math.max(4, Math.floor(dimensions.height * 0.3)));
  const filledLayers = filledLayersOverride ? Math.min(dimensions.height, filledLayersOverride) : defaultLayers;

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
    goldenHallEnabled: config.goldenHall.enabled,
    showHallBase: true,
    showHallShell: true,
    showHallFx: true,
    showHallRadii: false,
    hallWallHeight: config.goldenHall.wallHeight,
    hallBrightness: 1,
    ambientIntensity: config.lights.ambient.intensity,
    hemisphereIntensity: config.lights.hemisphere.intensity,
    keyIntensity: config.lights.key.intensity,
    autoRotateEnabled: false,
    showSceneGuides: config.renderMode.showGuides,
    showSceneDebugRing: config.renderMode.showDebugRing,
    showSceneColliders: config.renderMode.showColliders,
    showHallGeometryOverlay: false,
    showFootprintInlayWireframe: Boolean(config.showFootprintInlayWireframe),
    showFootprintLavaUV: Boolean(config.showFootprintLavaUV),
    disableFootprintLavaAnimation: Boolean(config.disableFootprintLavaAnimation),
    qualityLevel: config.quality.level,
    materialDebugMode: 'none',
    envDebugMode: 'full',
    hallMaterialMode: 'off',
    inspectorEnabled: false,
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
    goldenHall: {
      enabled: state.goldenHallEnabled,
      wallHeight: state.hallWallHeight,
    },
    renderMode: {
      ...VISUAL_DEBUG_RENDER_MODE,
      showGuides: state.showSceneGuides,
      showDebugRing: state.showSceneDebugRing,
      showColliders: state.showSceneColliders,
    },
    showFootprintInlayWireframe: state.showFootprintInlayWireframe,
    showFootprintLavaUV: state.showFootprintLavaUV,
    disableFootprintLavaAnimation: state.disableFootprintLavaAnimation,
  };
}

const HALL_LAYOUT_EPS = 1e-3;

function hallLayoutsDiffer(a: HallLayoutRadii, b: HallLayoutRadii): boolean {
  return (
    Math.abs(a.hallInnerRadius - b.hallInnerRadius) > HALL_LAYOUT_EPS ||
    Math.abs(a.hallOuterRadius - b.hallOuterRadius) > HALL_LAYOUT_EPS ||
    Math.abs(a.platformOuterRadius - b.platformOuterRadius) > HALL_LAYOUT_EPS
  );
}

function validateHallOrdering(layout: HallLayoutRadii): void {
  const okHallOverCamera = layout.hallInnerRadius > layout.cameraOrbitRadius + 1e-3;
  const okHallOverTower = layout.hallInnerRadius > layout.towerOuterRadius + 1e-3;
  if (!okHallOverCamera || !okHallOverTower) {
    console.warn('[hallLayout] ordering violated', {
      hallInnerRadius: layout.hallInnerRadius,
      hallOuterRadius: layout.hallOuterRadius,
      platformOuterRadius: layout.platformOuterRadius,
      cameraOrbitRadius: layout.cameraOrbitRadius,
      towerOuterRadius: layout.towerOuterRadius,
    });
  }
}

function rebuildHallInstance(ctx: RenderContext, state: VisualControlState): void {
  if (ctx.goldenHall) {
    ctx.scene.remove(ctx.goldenHall.baseGroup);
    ctx.scene.remove(ctx.goldenHall.hallGroup);
    ctx.scene.remove(ctx.goldenHall.fxGroup);
    ctx.goldenHall.dispose();
    ctx.goldenHall = null;
  }
  if (!ctx.renderConfig.goldenHall.enabled) {
    return;
  }
  const hall = createGoldenHall({
    towerBounds: ctx.towerBounds,
    dimensions: ctx.renderConfig.boardDimensions,
    board: ctx.renderConfig.board,
    goldenHall: ctx.renderConfig.goldenHall,
    quality: ctx.renderConfig.quality.level,
    envMap: ctx.environment?.environmentMap ?? null,
    hallLayout: ctx.hallLayout,
  });
  ctx.goldenHall = hall;
  if (hall) {
    ctx.scene.add(hall.baseGroup);
    ctx.scene.add(hall.hallGroup);
    ctx.scene.add(hall.fxGroup);
  }
  updateHallVisibility(ctx, state);
  applyHallBrightness(ctx, state.hallBrightness);
}

function updateHallLayoutFromCamera(ctx: RenderContext, state: VisualControlState): void {
  if (!ctx.renderConfig.goldenHall.enabled) {
    return;
  }
  const layoutConfig = createDefaultHallLayoutConfig(ctx.renderConfig.board.blockSize);
  const tower = deriveTowerRadii(ctx.renderConfig.board, ctx.towerBounds.center);
  const cameraOrbit = measureCameraOrbit(ctx.camera.position, ctx.towerBounds.center);
  const nextLayout = computeHallLayout(
    {
      towerOuterRadius: tower.outerRadius,
      cameraOrbitRadius: cameraOrbit.radius,
    },
    layoutConfig
  );
  if (hallLayoutsDiffer(ctx.hallLayout, nextLayout)) {
    ctx.hallLayout = nextLayout;
    rebuildHallInstance(ctx, state);
    validateHallOrdering(ctx.hallLayout);
  }
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

function updateHallVisibility(ctx: RenderContext, state: VisualControlState): void {
  const hallMode = state.envDebugMode;
  const hallEnabled = !!ctx.goldenHall && state.goldenHallEnabled && hallMode !== 'noHall';
  if (ctx.goldenHall) {
    ctx.goldenHall.baseGroup.visible = hallEnabled && state.showHallBase;
    ctx.goldenHall.hallGroup.visible = hallEnabled && state.showHallShell;
    ctx.goldenHall.fxGroup.visible = hallEnabled && state.showHallFx;
  }
  if (hallMode === 'hallOnly') {
    ctx.board.mesh.visible = false;
    ctx.activePiece.mesh.visible = false;
    ctx.boardPlaceholder.visible = false;
  } else {
    // leave board visibility as set by hallMaterialMode handler
  }
}

function applyHallBrightness(ctx: RenderContext, factor: number): void {
  if (!ctx.goldenHall) return;
  const rim = ctx.goldenHall.materials.wallEmissiveRim;
  const base = (rim.userData.baseEmissiveIntensity as number | undefined) ?? rim.emissiveIntensity;
  rim.userData.baseEmissiveIntensity = base;
  rim.emissiveIntensity = base * factor;

  ctx.scene.traverse((obj) => {
    const light = obj as THREE.Light;
    if (!light.isLight || !(light.name?.startsWith('main-0'))) return;
    const baseIntensity =
      (light.userData.baseIntensity as number | undefined) ?? (light as any).intensity ?? 1;
    light.userData.baseIntensity = baseIntensity;
    (light as any).intensity = baseIntensity * factor;
  });
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
