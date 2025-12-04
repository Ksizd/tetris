import { STANDARD_GRAVITY_MS2, DEFAULT_LINEAR_DRAG, DEFAULT_ANGULAR_DRAG } from './fragmentSimulation';

export interface Range {
  min: number;
  max: number;
}

export interface DestructionPreset {
  fragmentCount: Range;
  lifetimeMs: Range;
  radialSpeed: Range; // units per second
  tangentialSpeed: Range; // units per second
  verticalSpeed: Range; // units per second
  fullPhysics: boolean;
  linearDrag?: number; // per-second linear damping
  angularDrag?: number; // per-second angular damping
  gravityScale?: number;
  floorRestitution?: number;
  wallRestitution?: number;
  floorFriction?: number;
  wallFriction?: number;
}

// PHYSICS_UNITS: 1 world unit ~ 1 cube side (~1 meter). Base gravity = STANDARD_GRAVITY_MS2 (9.81 m/s^2).
// Drag defaults originate from fragmentSimulation (DEFAULT_LINEAR_DRAG, DEFAULT_ANGULAR_DRAG) and are tuned per preset.
export const PHYSICS_DEFAULTS = {
  gravityMs2: STANDARD_GRAVITY_MS2,
  gravityScale: 1,
  linearDrag: DEFAULT_LINEAR_DRAG,
  angularDrag: DEFAULT_ANGULAR_DRAG,
  floorRestitution: 0.35,
  wallRestitution: 0.3,
  floorFriction: 0.7,
  wallFriction: 0.85,
};

// Ultra preset: richer physics and full simulation.
export const ULTRA_DESTRUCTION_PRESET: DestructionPreset = {
  fragmentCount: { min: 16, max: 32 },
  lifetimeMs: { min: 2200, max: 3600 },
  radialSpeed: { min: 6, max: 14 },
  tangentialSpeed: { min: 2, max: 8 },
  verticalSpeed: { min: -2, max: 6 },
  fullPhysics: true,
  linearDrag: PHYSICS_DEFAULTS.linearDrag,
  angularDrag: PHYSICS_DEFAULTS.angularDrag,
  gravityScale: PHYSICS_DEFAULTS.gravityScale,
  floorRestitution: PHYSICS_DEFAULTS.floorRestitution,
  wallRestitution: PHYSICS_DEFAULTS.wallRestitution,
  floorFriction: PHYSICS_DEFAULTS.floorFriction,
  wallFriction: PHYSICS_DEFAULTS.wallFriction,
};

// Low preset: lighter simulation, minimal rebounds.
export const LOW_DESTRUCTION_PRESET: DestructionPreset = {
  fragmentCount: { min: 4, max: 8 },
  lifetimeMs: { min: 700, max: 1200 },
  radialSpeed: { min: 3, max: 7 },
  tangentialSpeed: { min: 1, max: 4 },
  verticalSpeed: { min: -1, max: 3 },
  fullPhysics: false,
  linearDrag: PHYSICS_DEFAULTS.linearDrag,
  angularDrag: PHYSICS_DEFAULTS.angularDrag,
  gravityScale: PHYSICS_DEFAULTS.gravityScale,
  floorRestitution: PHYSICS_DEFAULTS.floorRestitution,
  wallRestitution: PHYSICS_DEFAULTS.wallRestitution,
  floorFriction: PHYSICS_DEFAULTS.floorFriction,
  wallFriction: PHYSICS_DEFAULTS.wallFriction,
};
