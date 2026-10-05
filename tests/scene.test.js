import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { RealmScene } from "../js/scene.js";
import { Combat, chapter, DURATION } from "../js/combat.js";
import { normalizeRepos } from "../js/data.js";
import { BattleWorld } from "../js/battle-world.js";
import { Vector3 } from "../js/vendor/three.module.js";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const snapshot = JSON.parse(
  (
    await readFile(new URL("../data/repos.json", import.meta.url), "utf8")
  ).replace(/^\uFEFF/, ""),
);
const repos = normalizeRepos(snapshot.repos);
function worldStub() {
  return {
    width: 1440,
    height: 880,
    cameraMode: "auto",
    setUnits() {},
    resize() {},
    hit() {},
    fall() {},
    render(sim) {
      this.activeCamera = chapter(sim.time).camera;
    },
    project(unit) {
      return { x: 180 + unit.pair * 170, y: 440, visible: true };
    },
  };
}
function setup(factory = () => worldStub()) {
  const dom = new JSDOM(html, {
    url: "https://realm.invalid/",
    pretendToBeVisual: true,
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    devicePixelRatio: 1,
    ResizeObserver: class {
      observe() {}
    },
    IntersectionObserver: class {
      observe() {}
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  });
  const scene = new RealmScene(document.querySelector("#realm"), {
    worldFactory: factory,
  });
  scene.setRepos(repos);
  return scene;
}
const run = (scene, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) scene.advance(1 / 60);
};
test("cinematic director visits distant, follow, duel and overhead views in order", () => {
  assert.deepEqual(
    [0, 8, 16, 24, 36, 45, 50].map((t) => chapter(t).camera),
    ["wide", "follow", "side", "first", "overhead", "dragon", "overhead"],
  );
});
test("pursuit accelerates gradually, brakes before contact and never strikes while advancing", () => {
  const sim = new Combat([]);
  sim.time = 30;
  sim.units = sim.units.slice(0, 2);
  const [knight, zombie] = sim.units;
  knight.z = 3; zombie.z = -3;
  knight.cooldown = zombie.cooldown = 100;
  let movingFrames = 0, brakingFrames = 0;
  for (let frame = 0; frame < 360; frame++) {
    const previous = sim.units.map(u => ({ speed: u.speed, x: u.x, z: u.z }));
    sim.step(1 / 60);
    sim.units.forEach((u, i) => {
      const delta = u.speed - previous[i].speed;
      assert.ok(delta <= 2.5 / 60 + 1e-8 && delta >= -4 / 60 - 1e-8);
      if (u.moving) movingFrames++;
      if (delta < -.001) brakingFrames++;
      assert.ok(!(u.moving && u.attack >= 0));
    });
    assert.ok(Math.hypot(knight.x - zombie.x, knight.z - zombie.z) >= 1.55 - 1e-8);
  }
  assert.ok(movingFrames > 20 && brakingFrames > 2);
  assert.equal(knight.moving, false);
  assert.equal(zombie.moving, false);
});

test("combat only damages opponents at a contact window and blocking reduces damage", () => {
  const sim = new Combat(repos),
    hits = [];
  sim.onHit = (e) => hits.push(e);
  for (let i = 0; i < 12 * 60; i++) sim.step(1 / 60);
  assert.equal(hits.length, 0);
  for (let i = 0; i < 3 * 60; i++) sim.step(1 / 60);
  assert.ok(hits.length > 0);
  assert.ok(hits.every((e) => e.time >= 13));
  const a = new Combat(repos),
    b = new Combat(repos);
  a.damage(a.player, 17, null, false);
  b.damage(b.player, 3, null, true);
  assert.ok(b.player.hp > a.player.hp);
});
test("full battle has deaths on both sides, finite positions and unique small corpse labels", async () => {
  const scene = setup(),
    revealed = [];
  scene.onReveal = (r) => revealed.push(r.name);
  await scene.start();
  run(scene, DURATION + 1);
  assert.equal(scene.running, false);
  assert.equal(scene.finale.hidden, false);
  assert.equal(document.activeElement, scene.finale.querySelector("a"));
  assert.ok(
    scene.simulation.units.some(
      (u) => u.team === "knight" && u.deadAt !== null,
    ),
  );
  assert.ok(
    scene.simulation.units.some(
      (u) => u.team === "zombie" && u.deadAt !== null,
    ),
  );
  assert.equal(new Set(revealed).size, revealed.length);
  assert.ok(revealed.length >= 3);
  assert.equal(
    document.querySelectorAll(".fallen-label").length,
    revealed.length,
  );
  assert.equal(document.querySelector("#reveal"), null);
  assert.ok(
    scene.simulation.units.every(
      (u) => Number.isFinite(u.x) && Number.isFinite(u.z) && u.hp >= 0,
    ),
  );
});
test("pause holds the clock and replay resets health, labels and manual controls", async () => {
  const scene = setup();
  await scene.start();
  run(scene, 20);
  scene.setPaused(true);
  const before = scene.elapsed;
  run(scene, 3);
  assert.equal(scene.elapsed, before);
  scene.setPaused(false);
  run(scene, 1);
  assert.ok(scene.elapsed > before);
  await scene.start();
  assert.equal(scene.elapsed, 0);
  assert.equal(scene.labels.size, 0);
  assert.equal(scene.simulation.player.hp, scene.simulation.player.maxHp);
  assert.equal(scene.simulation.manual, false);
});
test("manual attack obeys cooldown and held guard clears when paused", async () => {
  const scene = setup();
  await scene.start();
  run(scene, 14);
  scene.setManual(true);
  scene.simulation.player.attack = -1;
  scene.simulation.player.cooldown = 0;
  assert.equal(scene.attack(), true);
  assert.equal(scene.attack(), false);
  scene.buttonBlocking = true;
  scene.updateBlock();
  assert.equal(scene.simulation.blocking, true);
  scene.setPaused(true);
  assert.equal(scene.simulation.blocking, false);
  assert.equal(scene.attack(), false);
});
test("reduced motion skips WebGL initialization and WebGL failures leave the portfolio available", async () => {
  let calls = 0;
  const scene = setup(() => {
    calls++;
    throw new Error("GPU unavailable");
  });
  scene.setReduced(true);
  await scene.start();
  assert.equal(calls, 0);
  assert.equal(scene.finale.hidden, false);
  const broken = setup(() => {
    throw new Error("GPU unavailable");
  });
  await broken.start();
  assert.equal(broken.running, false);
  assert.equal(broken.root.dataset.phase, "idle");
  assert.match(document.querySelector("#battle-feedback").textContent, /WebGL/);
  assert.equal(document.querySelector("#start-battle").disabled, false);
});
test("3D rigs have moving sword joints and all camera projections remain finite (no GPU)", () => {
  setup();
  const renderer = {
    shadowMap: {},
    setPixelRatio() {},
    setSize() {},
    render(scene, camera) {
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld();
    },
    dispose() {},
  };
  const world = new BattleWorld(document.querySelector("#battle-canvas"), {
      rendererFactory: () => renderer,
    }),
    sim = new Combat(repos);
  world.resize(1440, 880);
  world.setUnits(sim.units);
  const sword = world.rigs[0].weapon.blade;
  const samples = [];
  for (let i = 0; i < 50 * 60; i++) {
    sim.step(1 / 60);
    if (i % 30 === 0) {
      world.render(sim, 0.5);
      const p = world.project(sim.player);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      if (sim.time > 13 && sim.time < 15)
        samples.push(sword.getWorldPosition(new Vector3()).toArray());
    }
  }
  assert.ok(samples.some((p) => Math.abs(p[1] - samples[0][1]) > 0.2));
  world.cameraMode = "overhead";
  world.resize(390, 844);
  world.render(sim, 0);
  assert.equal(world.activeCamera, "overhead");
  assert.equal(world.rigs.length, 16);
  world.setUnits(sim.units);
  assert.equal(world.rigs.length, 16);
  world.dispose();
});
test("app still renders searchable repository cards independently of the 3D engine", async () => {
  setup();
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => snapshot.repos,
  });
  await import("../js/app.js");
  assert.equal(document.querySelectorAll(".project-card").length, repos.length);
  const input = document.querySelector("#search");
  input.value = "Accidentes";
  input.dispatchEvent(new window.Event("input"));
  assert.equal(document.querySelectorAll(".project-card").length, 1);
});
