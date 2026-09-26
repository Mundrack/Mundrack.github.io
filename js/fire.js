import * as T from './vendor/three.module.js';

// A local, procedural soft particle texture; no external effects library.
export function softParticle() {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x / (size - 1) * 2 - 1, y / (size - 1) * 2 - 1);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(Math.pow(Math.max(0, 1 - r), 2) * 255);
  }
  const texture = new T.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

export class DragonFire {
  constructor(scene) {
    this.count = 360;
    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.geometry = new T.BufferGeometry();
    this.geometry.setAttribute('position', new T.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new T.BufferAttribute(this.colors, 3));
    this.material = new T.PointsMaterial({ map: softParticle(), size: 1.25, transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: true, opacity: .85 });
    this.points = new T.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.direction = new T.Vector3(); this.side = new T.Vector3(); this.up = new T.Vector3();
  }
  update(time, origin, target) {
    this.points.visible = time >= 45 && time < 47.8;
    if (!this.points.visible) return;
    this.direction.subVectors(target, origin);
    this.side.crossVectors(this.direction, new T.Vector3(0, 1, 0)).normalize();
    this.up.crossVectors(this.side, this.direction).normalize();
    for (let i = 0; i < this.count; i++) {
      const age = ((time - 45) * 1.6 + i / this.count) % 1;
      const angle = i * 2.39996 + time * 1.8;
      const radius = (.12 + age * 1.4) * (.3 + (i % 13) / 18);
      const offset = i * 3;
      for (let k = 0; k < 3; k++) this.positions[offset + k] = origin.getComponent(k) + this.direction.getComponent(k) * age + radius * (Math.cos(angle) * this.side.getComponent(k) + Math.sin(angle) * this.up.getComponent(k));
      this.colors[offset] = 1;
      this.colors[offset + 1] = .8 * (1 - age) + .1;
      this.colors[offset + 2] = .28 * (1 - age);
    }
    this.material.opacity = .85 * Math.min(1, (time - 45) * 4, (47.8 - time) * 2);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
