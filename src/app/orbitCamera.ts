import * as THREE from 'three';
import { CameraPlacement } from '../render/cameraSetup';

export interface OrbitCameraOptions {
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
  panSpeed?: number;
  innerDistance?: number;
  minTargetY?: number;
  floorY?: number;
}

interface PointerState {
  dragging: boolean;
  mode: 'rotate' | 'pan';
  lastX: number;
  lastY: number;
}

export class OrbitCameraController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly target: THREE.Vector3;
  private radius: number;
  private theta: number;
  private phi: number;
  private readonly options: Required<OrbitCameraOptions>;
  private pointer: PointerState = { dragging: false, mode: 'rotate', lastX: 0, lastY: 0 };
  private readonly innerDistance: number;
  private readonly minTargetY: number;
  private readonly floorY: number;
  private readonly damping: number;

  constructor(
    camera: THREE.PerspectiveCamera,
    placement: CameraPlacement,
    opts: OrbitCameraOptions = {}
  ) {
    this.camera = camera;
    this.target = placement.target.clone();

    const delta = placement.position.clone().sub(this.target);
    this.radius = delta.length();
    this.theta = Math.atan2(delta.z, delta.x);
    this.phi = Math.acos(Math.min(Math.max(delta.y / this.radius, -1), 1));

    this.options = {
      minDistance: opts.minDistance ?? this.radius * 0.4,
      maxDistance: opts.maxDistance ?? this.radius * 2.2,
      minPolarAngle: opts.minPolarAngle ?? THREE.MathUtils.degToRad(20),
      maxPolarAngle: opts.maxPolarAngle ?? THREE.MathUtils.degToRad(85),
      rotateSpeed: opts.rotateSpeed ?? 0.002,
      zoomSpeed: opts.zoomSpeed ?? 0.0025,
      panSpeed: opts.panSpeed ?? 0.005,
    };
    this.innerDistance = opts.innerDistance ?? this.options.minDistance;
    this.minTargetY = opts.minTargetY ?? 0;
    this.floorY = opts.floorY ?? 0;

    this.clampAngles();
    this.updateCamera();
  }

  attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
  }

  detach(canvas: HTMLCanvasElement): void {
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('wheel', this.onWheel);
  }

  getPlacement(): CameraPlacement {
    return {
      position: this.camera.position.clone(),
      target: this.target.clone(),
    };
  }

  update(): void {
    this.updateCamera();
  }

  private onPointerDown = (ev: PointerEvent) => {
    this.pointer.dragging = true;
    this.pointer.lastX = ev.clientX;
    this.pointer.lastY = ev.clientY;
    this.pointer.mode = ev.shiftKey || ev.button === 1 ? 'pan' : 'rotate';
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (!this.pointer.dragging) return;
    const dx = ev.clientX - this.pointer.lastX;
    const dy = ev.clientY - this.pointer.lastY;
    this.pointer.lastX = ev.clientX;
    this.pointer.lastY = ev.clientY;

    if (this.pointer.mode === 'rotate') {
      this.theta += dx * this.options.rotateSpeed;
      this.phi += dy * this.options.rotateSpeed;
      this.clampAngles();
    } else {
      const panX = -dx * this.options.panSpeed;
      const panY = dy * this.options.panSpeed;
      const pan = new THREE.Vector3(panX, panY, 0);
      pan.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.theta);
      this.target.add(pan);
      if (this.target.y < this.minTargetY) {
        this.target.y = this.minTargetY;
      }
    }
  };

  private onPointerUp = (ev: PointerEvent) => {
    this.pointer.dragging = false;
    (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
  };

  private onWheel = (ev: WheelEvent) => {
    const delta = ev.deltaY * this.options.zoomSpeed;
    this.radius = THREE.MathUtils.clamp(
      this.radius + delta,
      Math.max(this.options.minDistance, this.innerDistance),
      this.options.maxDistance
    );
  };

  private clampAngles(): void {
    const EPS = 0.0001;
    this.phi = THREE.MathUtils.clamp(
      this.phi,
      this.options.minPolarAngle,
      this.options.maxPolarAngle
    );
    // theta unbounded for full orbit
    if (this.radius < EPS) {
      this.radius = EPS;
    }
  }

  private updateCamera(): void {
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    const x = this.target.x + this.radius * sinPhi * cosTheta;
    const y = this.target.y + this.radius * cosPhi;
    const z = this.target.z + this.radius * sinPhi * sinTheta;

    const minY = this.floorY + 0.2;
    this.camera.position.set(x, Math.max(y, minY), z);
    this.camera.lookAt(this.target);
  }
}
