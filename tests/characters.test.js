import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from '../js/vendor/GLTFLoader.js';
import { Box3, Vector3 } from '../js/vendor/three.module.js';
import { Character, Dragon, loadCharacters } from '../js/characters.js';
import { DragonFire } from '../js/fire.js';
import { Scene } from '../js/vendor/three.module.js';
import { BattleWorld } from '../js/battle-world.js';
import { Combat } from '../js/combat.js';
import { groundHeight } from '../js/ground.js';
import { CONTACT, strikeTime, strikeLunge } from '../js/fight-motion.js';
import { WING_PERIOD, dragonFlight } from '../js/dragon-flight.js';

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };

async function asset(name) {
  const data = await readFile(new URL(`../assets/models/${name}.glb`, import.meta.url));
  const length = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + length));
  assert.ok(json.images.length >= (name === 'dragon' ? 1 : 2), 'model retains embedded maps');
  assert.ok(json.images.every(image => image.bufferView !== undefined));
  assert.ok(json.skins.length > 0);
  const offset = 20 + length;
  const binary = data.subarray(offset + 8, offset + 8 + data.readUInt32LE(offset));
  json.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
  // CPU-only inspection of actual shipped geometry and animation. Texture
  // decoding and GPU rendering require the browser and are not tested here.
  json.materials = json.materials.map(() => ({ pbrMetallicRoughness: { baseColorFactor: [.5, .5, .5, 1] } }));
  json.images = []; json.textures = [];
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
function bounds(actor) {
  actor.root.updateMatrixWorld(true);
  actor.root.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); } });
  return new Box3().setFromObject(actor.root);
}
const unit = { x: 0, z: 0, yaw: 0, attack: -1, deadAt: null, pair: 0, recoil: 0, moving: false };

test('strike timing preserves contact and torso reactions recover without accumulating', async () => {
  assert.equal(strikeTime(CONTACT), CONTACT);
  assert.equal(strikeLunge(CONTACT), 1);
  assert.equal(strikeLunge(1), 0);
  let previous = -1;
  for (let i = 0; i <= 100; i++) {
    const value = strikeTime(i / 100);
    assert.ok(value >= previous && value <= 1); previous = value;
  }
  for (const team of ['knight', 'zombie']) {
    const actor = new Character(await asset(team), team);
    assert.ok(actor.chest, `${team} has the actual chest joint`);
    actor.pose(unit, 0);
    const original = actor.chest.quaternion.clone();
    actor.pose({ ...unit, hitAt: 0, hitDirection: { x: 0, z: 1 } }, .045);
    assert.ok(actor.chest.quaternion.angleTo(original) > .1);
    actor.pose({ ...unit, hitAt: 0 }, 1);
    const clean = new Character(await asset(team), team); clean.pose(unit, 1);
    assert.ok(actor.chest.quaternion.angleTo(clean.chest.quaternion) < 1e-5);
    actor.reset(); actor.pose(unit, 0);
    assert.ok(actor.chest.quaternion.angleTo(original) < 1e-5);
  }
});

test('support feet stay horizontally planted during actual forward strides and release for attacks', async t => {
  for (const team of ['knight', 'zombie']) {
    const actor = new Character(await asset(team), team);
    let supported = 0, error = 0;
    for (let frame = 0; frame < 180; frame++) {
      const time = frame / 60;
      actor.pose({ ...unit, z: -time * 1.4, moving: true }, time);
      actor.root.updateMatrixWorld(true);
      for (const leg of actor.planting.legs) if (leg.anchor) {
        const foot = leg.foot.getWorldPosition(new Vector3());
        error = Math.max(error, Math.hypot(foot.x - leg.anchor.x, foot.z - leg.anchor.z));
        supported++;
      }
    }
    t.diagnostic(`${team}: stride ${actor.gait.distance.toFixed(3)}m; ${supported} planted samples; max horizontal error ${error.toFixed(6)}m`);
    assert.ok(supported > 30, 'stance detection must actually engage on the shipped clip');
    assert.ok(error < .005, 'support ankle stays within 5mm of its world anchor');
    actor.pose({ ...unit, z: -4.2, attack: .1 }, 3);
    assert.ok(actor.planting.legs.every(leg => leg.anchor === null));
    actor.reset(); actor.pose(unit, 0);
    assert.ok(actor.planting.legs.every(leg => leg.anchor === null));
  }
});

test('guard cannot replace running and idle zombies do not keep stepping', async () => {
  const knight = new Character(await asset('knight'), 'knight');
  knight.pose({ ...unit, moving: true, guard: true }, 0);
  assert.equal(knight.actions.get('run').weight, 1);
  assert.equal(knight.actions.get('guard').weight, 0);
  const zombie = new Character(await asset('zombie'), 'zombie');
  zombie.pose(unit, 0);
  const feet = zombie.planting.legs.map(leg => leg.foot.getWorldPosition(new Vector3()));
  zombie.pose(unit, 2);
  zombie.planting.legs.forEach((leg, i) => assert.ok(leg.foot.getWorldPosition(new Vector3()).distanceTo(feet[i]) < 1e-6));
  assert.equal(zombie.actions.get('walk').weight, 0);
});

test('actual animated foot geometry contacts soil and paving through a walking cycle', async () => {
  for (const team of ['knight','zombie']) {
    const actor=new Character(await asset(team),team), point=new Vector3();
    for (const x of [0,6]) for (let frame=0;frame<12;frame++) {
      actor.pose({...unit,x,z:frame*.14,yaw:.4,moving:true},frame/12);
      actor.root.updateMatrixWorld(true);
      let minimum=Infinity;
      actor.visual.traverse(mesh=> {
        if(!mesh.isSkinnedMesh) return;
        mesh.skeleton.update();
        const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
        const feet=new Set(mesh.skeleton.bones.map((b,i)=>/foot|toe/i.test(b.name)?i:-1));
        // Inspect every foot vertex, independently of the production contact sampler.
        for(let i=0;i<indices.count;i++) {
          let weight=0;for(let k=0;k<4;k++)if(feet.has(indices.array[i*4+k]))weight+=weights.array[i*4+k];
          if(weight<.5)continue;
          mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
          minimum=Math.min(minimum,point.y-groundHeight(point.x,point.z));
        }
      });
      assert.ok(minimum>=-.035 && minimum<=.025,`${team} support gap ${minimum} at ${frame}`);
    }
  }
});

test('authored zombie front and knight front both follow combat heading',async()=> {
  for(const team of ['knight','zombie']) {
    const actor=new Character(await asset(team),team);
    for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
      actor.pose({...unit,yaw},0);actor.root.updateMatrixWorld(true);
      // Anatomical forward axis in the shipped bind mesh, not a shared placeholder axis.
      const forward=new Vector3(team==='zombie'?1:0,0,team==='knight'?1:0).transformDirection(actor.visual.matrixWorld);
      assert.ok(forward.dot(new Vector3(-Math.sin(yaw),0,-Math.cos(yaw)))>.99);
    }
  }
});

test('sword strikes while the shield stays in front during guard',async()=> {
  const actor=new Character(await asset('knight'),'knight');
  const sword=actor.visual.getObjectByName('leftHand'),shield=actor.visual.getObjectByName('rightHand');
  const points=[];
  for(const attack of [.3,.5]) {
    actor.reset();actor.pose({...unit,attack},attack);actor.root.updateMatrixWorld(true);
    points.push(sword.getWorldPosition(new Vector3()));
  }
  assert.ok(points[0].distanceTo(points[1])>.2,'authored sword hand follows the strike');
  actor.reset();actor.pose({...unit,guard:true},0);actor.root.updateMatrixWorld(true);
  const hand=shield.getWorldPosition(new Vector3());
  assert.ok(hand.z<-.3 && Math.abs(hand.x)<.5,'shield hand guards the torso rather than extending sideways');
  assert.ok(Math.abs(actor.actions.get('run').getClip().duration-19/24)<.001,'grip repair preserves the shipped walking clip timing');
});

test('shipped characters animate at human scale, preserve maps and keep independent skeletons', async () => {
  for (const team of ['knight', 'zombie']) {
    const gltf = await asset(team);
    const a = new Character(gltf, team), b = new Character(gltf, team);
    a.pose(unit, 0); b.pose(unit, 0);
    const initial = bounds(a);
    assert.ok(initial.getSize(new Vector3()).y > 2 && initial.getSize(new Vector3()).y < 2.6);
    let am, bm;
    a.root.traverse(o => { if (o.isSkinnedMesh) am = o; });
    b.root.traverse(o => { if (o.isSkinnedMesh) bm = o; });
    assert.notEqual(am.skeleton.bones[0], bm.skeleton.bones[0]);
    a.pose({ ...unit, attack: .47 }, 1);
    assert.ok(bounds(a).min.distanceTo(initial.min) > .1, 'actual mesh changes during attack');
    assert.ok(bounds(b).min.distanceTo(initial.min) < 1e-5, 'other instance does not animate');
    if (team === 'knight') assert.ok(bounds(a).min.z < -1.2, 'sword and lunge reach toward opponent');
    a.pose({ ...unit, deadAt: 1 }, 8);
    const fallen = bounds(a);
    assert.ok(fallen.min.y > -.12, 'corpse does not disappear below the ground');
    assert.ok(fallen.getSize(new Vector3()).y < 1.7, 'death lowers the silhouette');
    a.reset(); a.pose(unit, 0);
    assert.ok(bounds(a).min.distanceTo(initial.min) < 1e-5, 'replay restores initial pose');
  }
});

test('first-person armor contains only arm triangles and shares animation without sharing bones', async () => {
  const gltf = await asset('knight');
  const full = new Character(gltf, 'knight'), arms = new Character(gltf, 'knight', { firstPerson: true });
  let fullMesh, armMesh;
  full.root.traverse(o => { if (o.isSkinnedMesh && (!fullMesh || o.geometry.attributes.position.count > fullMesh.geometry.attributes.position.count)) fullMesh = o; });
  arms.root.traverse(o => { if (o.isSkinnedMesh && (!armMesh || o.geometry.attributes.position.count > armMesh.geometry.attributes.position.count)) armMesh = o; });
  assert.ok(armMesh.geometry.index.count > 100);
  assert.ok(armMesh.geometry.index.count < fullMesh.geometry.index.count * .6);
  assert.notEqual(armMesh.geometry, fullMesh.geometry);
  for (const t of [0, .2, .47, .8]) {
    arms.pose({ ...unit, attack: t }, t);
    const box = bounds(arms);
    assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
  }
});

test('failed model downloads reject rather than starting a placeholder battle', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  try { await assert.rejects(loadCharacters(), /Character .*404/); }
  finally { globalThis.fetch = original; }
});

test('strike recovery does not rewind while fading and locomotion follows distance', async () => {
  const actor = new Character(await asset('knight'), 'knight');
  actor.pose({ ...unit, attack: .96 }, 1);
  const attack = actor.actions.get('attack');
  const strikeTime = attack.time;
  actor.pose(unit, 1.016);
  assert.ok(attack.weight > 0, 'outgoing strike is still blended');
  assert.ok(attack.time >= strikeTime, 'recovery stays at the end of the strike');
  actor.pose({ ...unit, moving: true }, 2);
  const still = actor.actions.get('run').time;
  actor.pose({ ...unit, moving: true }, 2.1);
  assert.equal(actor.actions.get('run').time, still, 'no foot cycling without displacement');
  actor.pose({ ...unit, moving: true, z: -.35 }, 2.2);
  assert.ok(actor.actions.get('run').time > still);
});

test('dragon flight deforms wings and fire emitter follows the actual jaw', async () => {
  const dragon = new Dragon(await asset('dragon'));
  assert.ok(dragon.mouth, 'authored jaw emitter is exported');
  dragon.pose(43);
  const before = bounds(dragon);
  const mouth = dragon.mouthPosition(new Vector3());
  assert.ok(mouth.toArray().every(Number.isFinite));
  dragon.pose(43.4);
  const after = bounds(dragon);
  assert.ok(after.max.distanceTo(before.max) > .1, 'wing animation changes silhouette');
  dragon.root.position.set(8, 12, 4);
  const shifted = dragon.mouthPosition(new Vector3());
  dragon.root.position.set(0, 0, 0);
  assert.ok(shifted.sub(dragon.mouthPosition(new Vector3())).distanceTo(new Vector3(8, 12, 4)) < 1e-5);
  const fire = new DragonFire(new Scene());
  fire.update(46, mouth, new Vector3(0, .1, 0));
  assert.equal(fire.points.visible, true);
  assert.ok(fire.positions.every(Number.isFinite));
  fire.update(49, mouth, new Vector3());
  assert.equal(fire.points.visible, false);
});

test('dragon flight closes its loop and articulates shoulders, wing tips, neck and tail', async () => {
  const gltf = await asset('dragon'), dragon = new Dragon(gltf);
  const clip = dragon.flight.getClip();
  assert.ok(Math.abs(clip.duration - WING_PERIOD) < 1e-6);
  for (const track of clip.tracks) {
    const size = track.getValueSize();
    for (let i = 0; i < size; i++) assert.ok(Math.abs(track.values[i] - track.values[track.values.length - size + i]) < 1e-5, `${track.name} loops cleanly`);
  }
  const names = ['wing_upperL', 'wing_lowerL', 'neck1', 'tail3'];
  // GLTFLoader strips dots from node names when making animation bindings.
  const joints = names.map(name => dragon.visual.getObjectByName(name));
  assert.ok(joints.every(Boolean));
  dragon.pose(43); const before = joints.map(j => j.quaternion.clone());
  dragon.pose(43.5);
  joints.forEach((j,i) => assert.ok(j.quaternion.angleTo(before[i]) > .005, names[i]));
  const a = dragonFlight(44), b = dragonFlight(44.001);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z) < .01);
  assert.ok(Math.abs(a.yaw-b.yaw) < .01);
});

test('dragon includes 2K albedo, normal and roughness maps within the download budget', async () => {
  const data = await readFile(new URL('../assets/models/dragon.glb', import.meta.url));
  const length = data.readUInt32LE(12), json = JSON.parse(data.subarray(20,20+length));
  assert.ok(data.length < 12 * 1024 * 1024);
  assert.ok(json.materials.every(m => m.normalTexture && m.pbrMetallicRoughness.baseColorTexture && m.pbrMetallicRoughness.metallicRoughnessTexture));
  for (const im of json.images) {
    const view = json.bufferViews[im.bufferView];
    const png = data.subarray(28+length+view.byteOffset);
    assert.equal(im.mimeType, 'image/png');
    assert.equal(png.readUInt32BE(16), 2048);
    assert.equal(png.readUInt32BE(20), 2048);
  }
});

test('full world runs shipped characters through every cinematic phase and replay (CPU only)', async () => {
  const characters = Object.fromEntries(await Promise.all(['knight', 'zombie', 'dragon'].map(async name => [name, await asset(name)])));
  const renderer = { shadowMap: {}, setPixelRatio() {}, setSize() {}, dispose() {}, render(scene, camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(); } };
  const world = new BattleWorld({ addEventListener() {}, removeEventListener() {} }, { characters, rendererFactory: () => renderer });
  const sim = new Combat([]), phases = new Set();
  world.resize(1440, 880); world.setUnits(sim.units);
  assert.ok(world.rigs.every(rig => rig instanceof Character));
  assert.ok(world.dragon instanceof Dragon);
  for (let i = 0; i < 3000; i++) {
    sim.step(1 / 60);
    if (i % 30 === 0) {
      world.render(sim, .5);
      phases.add(world.activeCamera);
      assert.ok(world.camera.position.toArray().every(Number.isFinite));
      const projected = world.project(sim.player);
      assert.ok(Number.isFinite(projected.x) && Number.isFinite(projected.y));
    }
  }
  for (const phase of ['wide', 'follow', 'side', 'first', 'overhead', 'dragon']) assert.ok(phases.has(phase), phase);
  sim.reset(); world.setUnits(sim.units); world.render(sim, 0);
  assert.equal(world.rigs.length, 16);
  assert.equal(world.fire.points.visible, false);
  world.dispose();
});
