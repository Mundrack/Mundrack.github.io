import { Vector3 } from './vendor/three.module.js';

// Exterior transitions use zero acceleration at either end. Time is the scene
// clock, so pausing and replaying cannot advance the camera independently.
export class CameraDirector {
  constructor() {
    this.fromEye = new Vector3();
    this.fromLook = new Vector3();
    this.reset();
  }
  reset() { this.mode = ''; this.time = null; this.transitionAt = null; }
  update(camera, target, { eye, look, fov, mode, time, dt }) {
    const initial = this.time === null || time < this.time;
    const changed = mode !== this.mode;
    const cut = mode === 'first' || this.mode === 'first';
    if (changed && !initial && !cut && dt > 0) {
      this.fromEye.copy(camera.position);
      this.fromLook.copy(target);
      this.fromFov = camera.fov;
      this.transitionAt = time;
    }
    if (initial || cut || (changed && dt === 0)) {
      camera.position.copy(eye); target.copy(look); camera.fov = fov;
      this.transitionAt = null;
    } else if (this.transitionAt !== null) {
      const p = Math.min(1, Math.max(0, (time - this.transitionAt) / 1.2));
      const blend = p*p*p*(p*(p*6-15)+10);
      camera.position.lerpVectors(this.fromEye, eye, blend);
      target.lerpVectors(this.fromLook, look, blend);
      camera.fov = this.fromFov + (fov - this.fromFov) * blend;
      if (p === 1) this.transitionAt = null;
    } else {
      const blend = 1 - Math.exp(-Math.max(0, dt) * 4);
      camera.position.lerp(eye, blend); target.lerp(look, blend);
      camera.fov += (fov - camera.fov) * blend;
    }
    camera.lookAt(target); camera.updateProjectionMatrix();
    this.mode = mode; this.time = time;
  }
}

// Widen around the subject, not around world origin, on portrait displays.
export function fitPortrait(eye, look, aspect) {
  if (aspect >= 1) return;
  eye.sub(look).multiplyScalar(Math.min(1.9, 1 / Math.sqrt(Math.max(.25, aspect)))).add(look);
}
