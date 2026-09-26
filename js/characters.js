import * as T from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone } from './vendor/SkeletonUtils.js';

export async function loadCharacters() {
  const loader = new GLTFLoader();
  const entries = await Promise.all(['knight', 'zombie', 'dragon'].map(async name => {
    const url = new URL(`../assets/models/${name}.glb`, import.meta.url);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Character ${name}: ${response.status}`);
    const gltf = await loader.parseAsync(await response.arrayBuffer(), url.href);
    return [name, gltf];
  }));
  const library = Object.fromEntries(entries);
  const textureLoader = new T.TextureLoader();
  library.ground = await Promise.all(['diffuse', 'nor_gl', 'rough'].map(async name => {
    const texture = await textureLoader.loadAsync(new URL(`../assets/textures/ground-${name}.jpg`, import.meta.url).href);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(70, 90);
    texture.anisotropy = 4;
    if (name === 'diffuse') texture.colorSpace = T.SRGBColorSpace;
    return texture;
  }));
  return library;
}

// Keep only arm-weighted triangles for the first-person view, using the same
// detailed armor and animation as the external camera.
function armsOnly(mesh) {
  const geo = mesh.geometry.clone();
  const joints = geo.attributes.skinIndex, weights = geo.attributes.skinWeight;
  const armBones = new Set(mesh.skeleton.bones.map((b, i) => /Arm|Forearm|Hand/.test(b.name) ? i : -1));
  const isArm = v => {
    let weight = 0;
    for (let k = 0; k < 4; k++) if (armBones.has(joints.array[v * 4 + k])) weight += weights.array[v * 4 + k];
    return weight > .5;
  };
  const src = geo.index ? geo.index.array : Array.from({ length: geo.attributes.position.count }, (_, i) => i);
  const indices = [];
  for (let i = 0; i < src.length; i += 3) {
    if (isArm(src[i]) && isArm(src[i + 1]) && isArm(src[i + 2])) indices.push(src[i], src[i + 1], src[i + 2]);
  }
  geo.setIndex(indices);
  geo.clearGroups();
  mesh.geometry = geo;
}

export class Character {
  constructor(asset, team, { firstPerson = false } = {}) {
    this.team = team;
    this.root = new T.Group();
    this.visual = clone(asset.scene);
    this.visual.rotation.y = Math.PI;
    this.root.add(this.visual);
    this.visual.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = !firstPerson;
      o.receiveShadow = true;
      // Animated bounds vary considerably during strikes and deaths.
      o.frustumCulled = false;
      if (firstPerson && o.isSkinnedMesh) armsOnly(o);
    });
    this.mixer = new T.AnimationMixer(this.visual);
    this.actions = new Map();
    for (const clip of asset.animations) {
      const action = this.mixer.clipAction(clip);
      action.play(); action.weight = 0;
      this.actions.set(clip.name, action);
    }
    this.previousTime = null;
  }
  pose(unit, time) {
    const dead = unit.deadAt !== null;
    const state = dead ? 'death' : unit.attack >= 0 ? 'attack' : unit.guard && this.team === 'knight' ? 'guard' : unit.moving ? (this.team === 'knight' ? 'run' : 'walk') : (this.team === 'knight' ? 'idle' : 'walk');
    const dt = this.previousTime === null ? 0 : Math.max(0, time - this.previousTime);
    const reset = this.previousTime === null || time < this.previousTime;
    const blend = reset ? 1 : 1 - Math.exp(-dt * (dead ? 14 : 10));
    // Keep the outgoing strike at its recovery pose while it fades. Rewinding
    // it to frame zero here made every completed swing visibly snap backwards.
    if (reset) { this.travelTime = 0; this.lastPosition = { x: unit.x, z: unit.z }; }
    const travelled = Math.hypot(unit.x - this.lastPosition.x, unit.z - this.lastPosition.z);
    this.travelTime += travelled / (this.team === 'knight' ? 3.5 : 1.7);
    if (!reset && this.team === 'zombie' && !unit.moving) this.travelTime += dt * .13;
    for (const [name, action] of this.actions) {
      action.weight += ((name === state ? 1 : 0) - action.weight) * blend;
      const duration = action.getClip().duration;
      if (name === 'death') action.time = Math.min(Math.max(0, time - (unit.deadAt ?? time)), duration - 1e-5);
      else if (name === 'attack') {
        if (unit.attack >= 0) action.time = unit.attack * (duration - 1e-5);
        else if (reset) action.time = 0;
        else action.time = Math.min(action.time + dt, duration - 1e-5);
      }
      else if (name === 'run' || name === 'walk') action.time = (this.travelTime + unit.pair * .17) % duration;
      else action.time = (time + unit.pair * .17) % duration;
    }
    this.mixer.update(0);
    this.root.position.set(unit.x, 0, unit.z);
    this.root.rotation.set(0, unit.yaw, 0);
    this.visual.rotation.x = dead ? 0 : -(unit.recoil || 0) * .09;
    this.visual.position.z = !dead && this.team === 'knight' && unit.attack >= 0
      ? -.35 * Math.sin(Math.min(1, unit.attack) * Math.PI) : 0;
    this.previousTime = time;
    this.lastPosition = { x: unit.x, z: unit.z };
  }
  reset() { this.previousTime = null; }
}

export class Dragon {
  constructor(asset) {
    this.root = new T.Group();
    this.visual = clone(asset.scene);
    this.visual.rotation.y = Math.PI;
    this.root.add(this.visual);
    this.root.scale.setScalar(10);
    this.visual.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.mouth = this.visual.getObjectByName('FlameMouth');
    this.mixer = new T.AnimationMixer(this.visual);
    this.flight = this.mixer.clipAction(asset.animations.find(a => a.name === 'fly'));
    this.flight.play();
  }
  pose(time) {
    this.flight.time = Math.max(0, time - 43) % this.flight.getClip().duration;
    this.mixer.update(0);
  }
  mouthPosition(target) {
    this.root.updateMatrixWorld(true);
    return this.mouth ? this.mouth.getWorldPosition(target) : this.root.getWorldPosition(target);
  }
}
