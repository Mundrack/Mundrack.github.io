import * as T from "./vendor/three.module.js";
import { knightModel, dragonModel, pose, mesh, palette } from "./models.js";
import { chapter, smooth, clamp } from "./combat.js";
import { Character, Dragon } from "./characters.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";
import { buildFortress } from "./fortress.js";
import { DragonFire } from "./fire.js";
import { terrainHeight, dressBattlefield } from "./environment.js";

export class BattleWorld {
  constructor(
    canvas,
    {
      onContextLost = () => {},
      rendererFactory = (options) => new T.WebGLRenderer(options),
      characters = null,
    } = {},
  ) {
    this.canvas = canvas;
    this.characters = characters;
    this.renderer = rendererFactory({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(globalThis.devicePixelRatio || 1, 1.5),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x202d32);
    this.scene.fog = new T.FogExp2(0x33343b, 0.012);
    if (this.renderer.isWebGLRenderer) {
      const room = new RoomEnvironment();
      const pmrem = new T.PMREMGenerator(this.renderer);
      this.environment = pmrem.fromScene(room, .06);
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = .48;
      room.dispose();
      pmrem.dispose();
    }
    this.camera = new T.PerspectiveCamera(52, 1, 0.08, 200);
    this.scene.add(this.camera);
    this.cameraMode = "auto";
    this.effects = [];
    this.rigs = [];
    this.lastCamera = "";
    this.target = new T.Vector3();
    this.contextLost = (e) => {
      e.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", this.contextLost);
    this.lighting();
    this.sky();
    this.terrain();
    dressBattlefield(this.scene, this.characters?.castle, this.characters?.ground);
    buildFortress(this.scene, this.characters?.castle);
    this.buildDragon();
    this.fire = new DragonFire(this.scene);
    this.fireOrigin = new T.Vector3();
    this.fireTarget = new T.Vector3();
    this.firstPerson();
  }
  lighting() {
    this.scene.add(new T.HemisphereLight(0xb0c0d5, 0x3c3023, 1.3));
    const sun = new T.DirectionalLight(0xf5c28b, 3.2);
    sun.position.set(-15, 23, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -21,
      right: 21,
      top: 25,
      bottom: -23,
      near: 1,
      far: 75,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = .035;
    this.scene.add(sun);
    const rim = new T.DirectionalLight(0x80a6cf, 1.35);
    rim.position.set(10, 9, 14);
    this.scene.add(rim);
    this.fireLight = new T.PointLight(0xff7628, 0, 32, 2);
    this.scene.add(this.fireLight);
  }
  sky() {
    const geometry = new T.SphereGeometry(145, 64, 32);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const horizon = new T.Color(0x48525a), zenith = new T.Color(0x0c1622), color = new T.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) / 145, y = positions.getY(i) / 145, z = positions.getZ(i) / 145;
      const cloud = Math.sin(x * 17 + z * 9) * Math.sin(z * 23 - y * 15) * .07;
      color.copy(horizon).lerp(zenith, Math.min(1, Math.max(0, y * 1.6 + cloud)));
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    const dome = new T.Mesh(geometry, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10;
    this.scene.add(dome);
  }
  terrain() {
    const geo = new T.PlaneGeometry(140, 180, 70, 90);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position,
      colors = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
      const f =
        0.12 + (((Math.sin(x * 3.7 + z * 7.1) * 437.2) % 1) + 1) * 0.025;
      colors.push(.48 + f, .48 + f, .48 + f);
    }
    geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = mesh(
      this.scene,
      geo,
      new T.MeshStandardMaterial({
        vertexColors: true, roughness: .97,
        map: this.characters?.ground?.[0] || null,
        normalMap: this.characters?.ground?.[1] || null,
        roughnessMap: this.characters?.ground?.[2] || null,
        normalScale: new T.Vector2(.7, .7),
      }),
    );
    ground.castShadow = false;
    const rocks = new T.InstancedMesh(
        new T.DodecahedronGeometry(1, 0),
        palette.ground,
        140,
      ),
      dummy = new T.Object3D();
    for (let i = 0; i < 140; i++) {
      const x = Math.sin(i * 73.13) * 37,
        z = Math.cos(i * 33.51) * 42;
      dummy.position.set(
        x,
        terrainHeight(x, z) + (Math.abs(x) < 12 && Math.abs(z) < 18 ? -.25 : .06),
        z,
      );
      dummy.scale.set(
        0.3 + (i % 5) * 0.14,
        0.22 + (i % 3) * 0.15,
        0.4 + (i % 7) * 0.1,
      );
      dummy.rotation.set(i, i * 0.7, i * 0.3);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.receiveShadow = true;
    this.scene.add(rocks);
    this.flags = [];
    for (const x of [-12, 12])
      for (const z of [-10, 7]) {
        mesh(
          this.scene,
          new T.CylinderGeometry(0.04, 0.055, 5, 6),
          palette.dark,
          [x, 2.5, z],
        );
        const flag = mesh(
          this.scene,
          new T.PlaneGeometry(1.1, 1.7, 5, 8),
          new T.MeshStandardMaterial({ color: 0x501d23, side: T.DoubleSide }),
          [x + 0.55, 3.8, z],
        );
        flag.castShadow = false;
        this.flags.push(flag);
      }
    const emberGeometry = new T.BufferGeometry(),
      points = [];
    for (let i = 0; i < 100; i++)
      points.push(
        Math.sin(i * 7.1) * 22,
        (i % 17) * 0.4,
        Math.cos(i * 3.3) * 24,
      );
    emberGeometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(points, 3),
    );
    this.embers = new T.Points(
      emberGeometry,
      new T.PointsMaterial({
        color: 0xe5a05d,
        size: 0.065,
        transparent: true,
        opacity: 0.6,
      }),
    );
    this.scene.add(this.embers);
    // A pale eclipse rather than a flat image behind moving cameras.
    const moon = mesh(
      this.scene,
      new T.SphereGeometry(5, 24, 16),
      new T.MeshBasicMaterial({ color: 0xd6b28a }),
      [-17, 27, -85],
    );
    moon.castShadow = false;
    mesh(
      this.scene,
      new T.SphereGeometry(4.85, 24, 16),
      new T.MeshBasicMaterial({ color: 0x202d32 }),
      [-16.8, 27.2, -84.4],
    ).castShadow = false;
  }
  buildDragon() {
    this.dragon = this.characters?.dragon ? new Dragon(this.characters.dragon) : dragonModel();
    if (!this.characters?.dragon) this.dragon.root.scale.setScalar(2.2);
    this.dragon.root.visible = false;
    this.scene.add(this.dragon.root);
  }
  firstPerson() {
    if (this.characters) {
      this.viewRig = new Character(this.characters.knight, 'knight', { firstPerson: true });
      this.camera.add(this.viewRig.root);
      this.viewRig.root.visible = false;
      return;
    }
    this.viewRig = knightModel(false);
    this.viewRig.root.position.set(0, -1.85, -0.18);
    this.camera.add(this.viewRig.root);
    this.viewRig.body.children.forEach((child) => {
      child.visible =
        child === this.viewRig.limbs.right.shoulder ||
        child === this.viewRig.limbs.left.shoulder;
    });
    this.viewRig.limbs.left.hip.visible = false;
    this.viewRig.limbs.right.hip.visible = false;
    this.viewRig.root.visible = false;
  }
  setUnits(units) {
    if (!this.rigs.length)
      this.rigs = units.map((unit) => {
        const rig = this.characters ? new Character(this.characters[unit.team], unit.team) : knightModel(unit.team === "zombie");
        this.scene.add(rig.root);
        return rig;
      });
    this.rigs.forEach(rig => rig.reset?.());
    this.viewRig.reset?.();
    for (const effect of this.effects) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      effect.mesh.material.dispose();
    }
    this.effects = [];
  }
  resize(width, height) {
    this.width = Math.max(width, 1);
    this.height = Math.max(height, 1);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }
  hit({ target, blocked, time, attacker }) {
    // Restrained stylized red motes; no anatomical damage or graphic gore.
    const color = blocked ? 0xf2c176 : 0x772c2a;
    for (let i = 0; i < 6; i++) {
      const m = new T.Mesh(
        new T.IcosahedronGeometry(0.035, 0),
        new T.MeshBasicMaterial({ color }),
      );
      m.position.set(target.x, 1.3, target.z);
      this.scene.add(m);
      this.effects.push({
        mesh: m,
        start: time,
        life: 0.45,
        origin: m.position.clone(),
        velocity: new T.Vector3(
          Math.sin(i * 4) * 1.5,
          1 + i * 0.14,
          Math.cos(i * 3) * 1.4,
        ),
      });
    }
  }
  fall(unit) {
    if (!unit.repo) return;
    const ring = new T.Mesh(
      new T.RingGeometry(0.46, 0.5, 24),
      new T.MeshBasicMaterial({
        color: 0xc7a56a,
        transparent: true,
        opacity: 0.6,
        side: T.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(unit.x, 0.012, unit.z);
    this.scene.add(ring);
    this.effects.push({ mesh: ring, start: unit.deadAt, life: Infinity });
  }
  render(combat, dt) {
    const t = combat.time;
    combat.units.forEach((u, i) => {
      const rig = this.rigs[i];
      if (rig) {
        if (rig.pose) rig.pose(u, t);
        else pose(rig, u, t);
        rig.root.visible = true;
      }
    });
    const mode =
      this.cameraMode === "auto" ? chapter(t).camera : this.cameraMode;
    this.cameraShot(mode, combat, dt);
    for (const flag of this.flags) {
      const p = flag.geometry.attributes.position;
      for (let i = 0; i < p.count; i++)
        p.setZ(i, Math.sin(t * 3 + p.getX(i) * 4 + p.getY(i) * 2) * 0.09);
      p.needsUpdate = true;
    }
    this.embers.rotation.y = t * 0.006;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i],
        age = t - e.start;
      if (age > e.life) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      } else if (e.velocity) {
        e.mesh.position.copy(e.origin).addScaledVector(e.velocity, age);
        e.mesh.position.y -= age * age * 2;
      }
    }
    const fly = clamp((t - 43) / 7);
    this.dragon.root.visible = t >= 43;
    if (t >= 43) {
      this.dragon.root.position.set(
        -10 + fly * 18,
        12 + Math.sin(t) * 0.3,
        -8 + fly * 10,
      );
      this.dragon.root.rotation.y = -2.08;
      this.dragon.pose?.(t);
      this.dragon.wings?.forEach(
        (w, i) =>
          (w.rotation.z = Math.sin(t * 3.8) * 0.36 * (i === 0 ? 1 : -1)),
      );
    }
    this.fireLight.intensity = t >= 45 && t < 48 ? 65 : 0;
    if (this.dragon.mouthPosition) this.dragon.mouthPosition(this.fireOrigin);
    else this.fireOrigin.copy(this.dragon.root.position).add(new T.Vector3(0, -1, -4));
    this.fireTarget.set(this.dragon.root.position.x + 2, .15, 0);
    this.fireLight.position.lerpVectors(this.fireOrigin, this.fireTarget, .65);
    this.fire.update(t, this.fireOrigin, this.fireTarget);
    this.renderer.render(this.scene, this.camera);
  }
  cameraShot(mode, combat, dt) {
    const t = combat.time,
      lead = combat.player,
      dead = lead.deadAt !== null,
      first = mode === "first" && !dead && t >= 13 && t < 43;
    const eye = new T.Vector3(),
      look = new T.Vector3();
    let fov = 52;
    if (mode === "wide") {
      const p = smooth(t / 6);
      eye.set(23 * (1 - p), 18 - 13 * p, 40 - 16 * p);
      look.set(0, 1, -2);
    } else if (first) {
      eye.set(lead.x, 2.15 + Math.sin(t * 3) * 0.012, lead.z - 0.04);
      look.set(
        lead.x - Math.sin(lead.yaw) * 6,
        1.7,
        lead.z - Math.cos(lead.yaw) * 6,
      );
      fov = 68;
    } else if (mode === "follow") {
      eye.set(
        lead.x + Math.sin(lead.yaw) * 5 + 1.15,
        3.0,
        lead.z + Math.cos(lead.yaw) * 5,
      );
      look.set(
        lead.x - Math.sin(lead.yaw) * 5,
        1.55,
        lead.z - Math.cos(lead.yaw) * 5,
      );
    } else if (mode === "side") {
      const push = smooth((t - 13) / 9);
      eye.set(lead.x + 3.8 - push * .7, 2.25, lead.z + 2.2 - push * .5);
      look.set(lead.x, 1.45, lead.z - .7);
      fov = 46;
    } else if (mode === "dragon") {
      const fly = clamp((t - 43) / 7);
      const x = -10 + fly * 18, z = -8 + fly * 10;
      eye.set(x + 15, 15, z + 19);
      look.set(x, 9, z);
      fov = 56;
    } else {
      const angle = (t - 32) * 0.015;
      eye.set(Math.sin(angle) * 10, 22, 13 + Math.cos(angle) * 2);
      look.set(0, 0, -1.8);
      fov = 50;
    }
    if (this.width < 650 && !first) {
      eye.x *= 1.15;
      eye.y *= 1.3;
      eye.z *= 1.3;
      fov += 7;
    }
    // First-person is an intentional camera cut; exterior shots use damped travel.
    const snap =
      first || this.lastCamera === "first" || !this.lastCamera || dt === 0;
    const blend = snap ? 1 : 1 - Math.exp(-dt * 2.8);
    this.camera.position.lerp(eye, blend);
    this.target.lerp(look, blend);
    this.camera.lookAt(this.target);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.lastCamera = first ? "first" : mode;
    this.viewRig.root.visible = first;
    if (first) {
      const rig = this.viewRig;
      if (rig.pose) rig.pose({ ...lead, x: 0, z: 0, yaw: 0, pair: 0, deadAt: null }, t);
      else pose(rig, { ...lead, x: 0, z: 0, pair: 0, deadAt: null }, t);
      rig.root.position.set(0, -1.94, -0.34);
      rig.root.rotation.set(0, 0, 0);
      this.rigs[0].root.visible = false;
    }
    this.activeCamera = first ? "first" : mode;
    this.camera.updateMatrixWorld();
  }
  project(unit) {
    const p = new T.Vector3(unit.x, 0.5, unit.z).project(this.camera);
    return {
      x: (p.x * 0.5 + 0.5) * this.width,
      y: (-0.5 * p.y + 0.5) * this.height,
      visible:
        p.z > -1 && p.z < 1 && Math.abs(p.x) < 0.94 && Math.abs(p.y) < 0.85,
    };
  }
  disposeUnique(root) {
    root.traverse((obj) => {
      if (obj.isMesh && obj.geometry.type === "PlaneGeometry")
        obj.geometry.dispose();
    });
  }
  dispose() {
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    const geometries = new Set(),
      materials = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    const textures = new Set();
    materials.forEach(m => { for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); });
    textures.forEach(texture => texture.dispose());
    this.environment?.dispose();
    this.renderer.dispose();
  }
}
