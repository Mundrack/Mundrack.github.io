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
