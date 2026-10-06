import * as T from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone } from './vendor/SkeletonUtils.js';
import { groundHeight } from './ground.js';
import { gaitProfile, stationaryClip, FootPlanting } from './locomotion.js';
import { strikeTime, strikeLunge, reactionWeight } from './fight-motion.js';

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
  library.castle = await Promise.all(['diffuse', 'nor_gl', 'rough'].map(async name => {
    const texture = await textureLoader.loadAsync(new URL(`../assets/textures/castle-${name}.jpg`, import.meta.url).href);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
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
    this.firstPerson = firstPerson;
    this.root = new T.Group();
    this.visual = clone(asset.scene);
    // Knight is authored facing +Z; the zombie is authored facing +X.
    // Combat yaw zero always faces -Z.
    this.visual.rotation.y = team === 'zombie' ? Math.PI / 2 : Math.PI;
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
    const clips = [...asset.animations];
    if (!clips.some(clip => clip.name === 'idle')) clips.push(stationaryClip(clips.find(clip => clip.name === 'walk')));
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      action.play(); action.weight = 0;
      this.actions.set(clip.name, action);
    }
    this.previousTime = null;
    this.chest = this.visual.getObjectByName(team === 'knight' ? 'chest' : 'Bip01_Spine2');
    this.chestBase = this.chest?.quaternion.clone();
    this.reactionAxis = new T.Vector3();
    this.reactionRotation = new T.Quaternion();
    this.chestWorld = new T.Quaternion();
    this.chestParent = new T.Quaternion();
    this.gait = gaitProfile(asset, team);
    this.planting = new FootPlanting(this.visual, team, this.gait);
    this.contactSamples = [];
    this.bodySamples = [];
    this.contactPoint = new T.Vector3();
    if (!firstPerson) {
      this.root.updateMatrixWorld(true);
      this.visual.traverse(mesh => {
        if (!mesh.isSkinnedMesh) return;
        const indices=mesh.geometry.attributes.skinIndex, weights=mesh.geometry.attributes.skinWeight;
        const bodyIndices=[];
        for(let i=0;i<indices.count;i+=Math.max(1,Math.floor(indices.count/256))) bodyIndices.push(i);
        this.bodySamples.push({mesh,indices:bodyIndices});
        const feet=new Set(mesh.skeleton.bones.map((b,i)=> /foot|toe/i.test(b.name) ? i : -1));
        const candidates=[];
        mesh.skeleton.update();
        for (let i=0;i<indices.count;i++) {
          let weight=0;
          for(let k=0;k<4;k++) if(feet.has(indices.array[i*4+k])) weight+=weights.array[i*4+k];
          if(weight>=.5) {
            mesh.getVertexPosition(i,this.contactPoint).applyMatrix4(mesh.matrixWorld);
            candidates.push({index:i,key:this.contactPoint.toArray().map(v=>v.toFixed(5)).join(',')});
          }
        }
        // UV/normal seams duplicate positions; keep every distinct foot surface
        // point so heels and toes remain supported while the ankle rolls.
        const soles=[...new Map(candidates.map(v=>[v.key,v.index])).values()];
        if(soles.length) this.contactSamples.push({mesh,indices:soles});
      });
    }
  }
  pose(unit, time) {
    const dead = unit.deadAt !== null;
    const state = dead ? 'death' : unit.attack >= 0 ? 'attack' : unit.moving ? (this.team === 'knight' ? 'run' : 'walk') : unit.guard && this.team === 'knight' ? 'guard' : 'idle';
    const dt = this.previousTime === null ? 0 : Math.max(0, time - this.previousTime);
    const reset = this.previousTime === null || time < this.previousTime;
    const blend = reset ? 1 : 1 - Math.exp(-dt * (dead ? 14 : 10));
    // Keep the outgoing strike at its recovery pose while it fades. Rewinding
    // it to frame zero here made every completed swing visibly snap backwards.
    if (reset) { this.travelTime = 0; this.lastPosition = { x: unit.x, z: unit.z }; this.planting.reset(); }
    const travelled = Math.hypot(unit.x - this.lastPosition.x, unit.z - this.lastPosition.z);
    this.travelTime += travelled * this.gait.duration / this.gait.distance;
    for (const [name, action] of this.actions) {
      action.weight += ((name === state ? 1 : 0) - action.weight) * blend;
      const duration = action.getClip().duration;
      if (name === 'death') action.time = Math.min(Math.max(0, time - (unit.deadAt ?? time)), duration - 1e-5);
      else if (name === 'attack') {
        if (unit.attack >= 0) action.time = strikeTime(unit.attack) * (duration - 1e-5);
        else if (reset) action.time = 0;
        else action.time = Math.min(action.time + dt, duration - 1e-5);
      }
      else if (name === 'run' || name === 'walk') action.time = (this.travelTime + unit.pair * .17) % duration;
      else action.time = (time + unit.pair * .17) % duration;
    }
    if (this.chest) this.chest.quaternion.copy(this.chestBase);
    this.mixer.update(0);
    if (this.chest) this.chestBase.copy(this.chest.quaternion);
    this.root.position.set(unit.x, 0, unit.z);
    this.root.rotation.set(0, unit.yaw, 0);
    this.visual.rotation.x = 0;
    this.visual.position.z = !dead && unit.attack >= 0
      ? -(this.team === 'knight' ? .35 : .18) * strikeLunge(unit.attack) : 0;
    // Rotate the upper body in world space so both differently authored rigs
    // recoil away from the source. Hips and grounded feet remain stable.
    const reaction = dead ? 0 : reactionWeight(time - (unit.hitAt ?? -Infinity), unit.blockedHit);
    if (this.chest && reaction > 0) {
      const direction = unit.hitDirection || { x: 0, z: 1 };
      this.root.updateMatrixWorld(true);
      this.reactionAxis.set(direction.z, 0, -direction.x).normalize();
      this.reactionRotation.setFromAxisAngle(this.reactionAxis, reaction * (unit.blockedHit ? .07 : .23));
      this.chest.getWorldQuaternion(this.chestWorld).premultiply(this.reactionRotation);
      this.chest.parent.getWorldQuaternion(this.chestParent).invert();
      this.chest.quaternion.copy(this.chestParent.multiply(this.chestWorld));
    }
    if (!this.firstPerson) {
      this.ground(dead);
      const locomotion = this.actions.get(this.team === 'knight' ? 'run' : 'walk');
      const adjusted = this.planting.apply((this.travelTime + unit.pair * .17) / this.gait.duration,
        !dead && unit.attack < 0 && unit.moving && locomotion.weight > .65 && dt > 0 && dt < .1 && travelled < .3, unit.yaw);
      if (adjusted) this.ground(dead);
    }
    this.previousTime = time;
    this.lastPosition = { x: unit.x, z: unit.z };
  }
  ground(dead) {
    if (!this.firstPerson) {
      this.root.position.y = groundHeight(this.root.position.x,this.root.position.z);
      const samples=dead ? this.bodySamples : this.contactSamples;
      if (samples.length) {
        this.root.updateMatrixWorld(true);
        let lift=-Infinity;
        for(const {mesh,indices} of samples) {
          mesh.skeleton.update();
          for(const i of indices) {
            mesh.getVertexPosition(i,this.contactPoint).applyMatrix4(mesh.matrixWorld);
            lift=Math.max(lift,groundHeight(this.contactPoint.x,this.contactPoint.z)-this.contactPoint.y);
          }
        }
        // Both foot meshes participate: the lower supporting sole touches the
        // actual soil/paving. No cumulative offset and no hand-driven bounds.
        if(Number.isFinite(lift)) this.root.position.y+=lift+.004;
      }
    }
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
