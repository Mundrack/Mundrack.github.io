import * as T from "./vendor/three.module.js";
const material = (color, metalness = 0.0, roughness = 0.7) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
export const palette = {
  steel: material(0x48515a, 0.8, 0.36),
  edge: material(0x9da9af, 0.85, 0.27),
  gold: material(0x967544, 0.75, 0.45),
  dark: material(0x13191e, 0.55, 0.7),
  leather: material(0x261e19),
  red: material(0x551f24),
  skin: material(0x6b7660),
  bone: material(0x97947a),
  rust: material(0x42372c, 0.45, 0.8),
  ground: material(0x252a24),
  wing: material(0x381d20, 0.1, 0.85),
};
const sphere = new T.SphereGeometry(1, 12, 8),
  box = new T.BoxGeometry(1, 1, 1),
  cylinder = new T.CylinderGeometry(1, 1, 1, 10),
  cone = new T.ConeGeometry(1, 1, 10);
export function mesh(parent, geo, mat, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new T.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function group(parent, pos) {
  const g = new T.Group();
  g.position.set(...pos);
  parent.add(g);
  return g;
}
export function sword(parent, zombie = false) {
  const g = group(parent, [0, -0.36, -0.03]);
  mesh(g, cylinder, palette.leather, [0, -0.13, 0], [0.046, 0.3, 0.046]);
  mesh(g, sphere, palette.gold, [0, -0.3, 0], [0.065, 0.065, 0.065]);
  mesh(
    g,
    box,
    zombie ? palette.rust : palette.gold,
    [0, 0.035, 0],
    [0.42, 0.055, 0.075],
  );
  const blade = mesh(
    g,
    box,
    zombie ? palette.rust : palette.edge,
    [0, 0.65, 0],
    [0.105, 1.17, 0.035],
  );
  mesh(
    g,
    cone,
    zombie ? palette.rust : palette.edge,
    [0, 1.3, 0],
    [0.07, 0.21, 0.032],
  );
  mesh(g, box, palette.dark, [0, 0.64, 0.019], [0.017, 1.1, 0.006]);
  return { group: g, blade };
}
export function knightModel(zombie = false) {
  const root = new T.Group(),
    body = group(root, [0, 1.1, 0]);
  const armor = zombie ? palette.rust : palette.steel,
    cloth = zombie ? palette.leather : palette.red;
  const torso = mesh(body, sphere, armor, [0, 0.42, 0], [0.36, 0.48, 0.22]);
  mesh(body, box, palette.leather, [0, 0.01, 0], [0.52, 0.14, 0.33]);
  mesh(body, box, palette.gold, [0, 0.02, -0.18], [0.11, 0.11, 0.04]);
  for (let i = 0; i < 3; i++)
    mesh(
      body,
      box,
      armor,
      [0, 0.11 + i * 0.1, -0.17],
      [0.47 - i * 0.025, 0.085, 0.08],
    );
  if (!zombie) {
    mesh(body, box, palette.gold, [0, 0.46, -0.212], [0.035, 0.49, 0.018]);
    mesh(body, box, palette.gold, [0, 0.53, -0.213], [0.37, 0.035, 0.018]);
  }
  const head = group(body, [0, 0.92, 0]);
  mesh(
    head,
    sphere,
    zombie ? palette.skin : armor,
    [0, 0.1, 0],
    [0.2, 0.255, 0.2],
  );
  if (zombie) {
    mesh(head, sphere, palette.bone, [0, 0.05, -0.1], [0.175, 0.17, 0.13]);
    mesh(head, box, palette.dark, [0, 0.07, -0.217], [0.27, 0.07, 0.02]);
    const eyeMat = new T.MeshStandardMaterial({
      color: 0xd79835,
      emissive: 0xec851b,
      emissiveIntensity: 2,
    });
    for (const x of [-0.075, 0.075])
      mesh(head, sphere, eyeMat, [x, 0.08, -0.236], [0.025, 0.019, 0.012]);
    mesh(head, box, palette.dark, [0, -0.025, -0.219], [0.18, 0.025, 0.01]);
  } else {
    mesh(head, box, palette.dark, [0, 0.12, -0.19], [0.31, 0.04, 0.035]);
    mesh(head, box, palette.edge, [0, -0.035, -0.19], [0.29, 0.19, 0.05]);
    for (let x = -2; x <= 2; x++)
      mesh(
        head,
        box,
        palette.dark,
        [x * 0.045, -0.035, -0.22],
        [0.013, 0.085, 0.008],
      );
    mesh(head, box, palette.gold, [0, 0.27, 0], [0.035, 0.08, 0.34]);
  }
  const limbs = {};
  for (const [name, side] of [
    ["left", -1],
    ["right", 1],
  ]) {
    const shoulder = group(body, [side * 0.43, 0.66, 0]);
    mesh(shoulder, sphere, armor, [0, -0.03, 0], [0.245, 0.2, 0.235]);
    mesh(
      shoulder,
      cylinder,
      zombie ? palette.skin : armor,
      [0, -0.23, 0],
      [0.105, 0.38, 0.105],
    );
    const elbow = group(shoulder, [0, -0.43, 0]);
    mesh(elbow, sphere, palette.dark, [0, 0, 0], [0.105, 0.11, 0.1]);
    mesh(elbow, cylinder, armor, [0, -0.18, 0], [0.095, 0.31, 0.095]);
    mesh(
      elbow,
      sphere,
      zombie ? palette.skin : palette.leather,
      [0, -0.38, 0],
      [0.095, 0.105, 0.08],
    );
    const hip = group(root, [side * 0.18, 1.09, 0]);
    mesh(hip, cylinder, armor, [0, -0.24, 0], [0.14, 0.44, 0.145]);
    const knee = group(hip, [0, -0.49, 0]);
    mesh(knee, sphere, armor, [0, 0, -0.035], [0.16, 0.14, 0.14]);
    mesh(knee, cylinder, armor, [0, -0.22, 0], [0.1, 0.4, 0.11]);
    mesh(knee, box, palette.dark, [0, -0.43, -0.09], [0.22, 0.16, 0.38]);
    limbs[name] = { shoulder, elbow, hip, knee };
  }
  const weapon = sword(limbs.right.elbow, zombie);
  weapon.group.rotation.z = Math.PI;
  let shield;
  if (!zombie) {
    const shape = new T.Shape();
    shape.moveTo(-0.27, 0.36);
    shape.lineTo(0.27, 0.36);
    shape.lineTo(0.28, -0.1);
    shape.lineTo(0, -0.44);
    shape.lineTo(-0.28, -0.1);
    shape.closePath();
    shield = mesh(
      limbs.left.elbow,
      new T.ExtrudeGeometry(shape, {
        depth: 0.05,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.018,
        bevelThickness: 0.01,
      }),
      palette.steel,
      [0, -0.2, -0.18],
    );
    mesh(shield, box, palette.gold, [0, 0.0, -0.013], [0.032, 0.63, 0.015]);
    mesh(shield, box, palette.gold, [0, 0.14, -0.014], [0.47, 0.032, 0.015]);
    for (const x of [-0.22, 0.22])
      for (const y of [-0.03, 0.28])
        mesh(
          shield,
          sphere,
          palette.gold,
          [x, y, -0.026],
          [0.025, 0.025, 0.02],
        );
  }
  const capeGeometry = new T.PlaneGeometry(0.7, 1.2, 5, 8);
  const capeMat = cloth.clone();
  capeMat.side = T.DoubleSide;
  const cape = mesh(body, capeGeometry, capeMat, [0, 0.15, 0.25]);
  cape.rotation.x = -0.1;
  root.traverse((o) => {
    if (o.isMesh) o.frustumCulled = true;
  });
  return { root, body, torso, head, limbs, weapon, shield, cape, zombie };
}
export function pose(model, unit, time) {
  const dead = unit.deadAt !== null,
    fall = dead ? Math.min(1, (time - unit.deadAt) / 0.9) : 0;
  model.root.position.set(unit.x, dead ? 0.1 : 0, unit.z);
  model.root.rotation.set(
    fall * 1.38,
    unit.yaw ?? (unit.team === "zombie" ? Math.PI : 0),
    fall * 0.28,
  );
  const run = unit.moving && !dead,
    cycle = time * 11 + unit.pair * 0.8;
  model.body.position.y =
    1.1 +
    (run
      ? Math.abs(Math.sin(cycle)) * 0.07
      : Math.sin(time * 2 + unit.pair) * 0.008) -
    fall * 0.08;
  model.body.rotation.set(run ? -0.14 : unit.recoil * 0.1, 0, 0);
  model.head.rotation.x = unit.recoil * -0.17;
  for (const [side, sign] of [
    ["left", 1],
    ["right", -1],
  ]) {
    const l = model.limbs[side];
    l.hip.rotation.x = run
      ? Math.sin(cycle) * 0.68 * sign
      : dead
        ? 0.25 * sign
        : 0.08 * sign;
    l.knee.rotation.x = run
      ? Math.max(0, -Math.sin(cycle) * sign) * 1.05
      : dead
        ? 0.4
        : 0.12;
    l.shoulder.rotation.set(
      run
        ? (side === "right" ? 1.15 : 0) - Math.sin(cycle) * 0.35 * sign
        : side === "right"
          ? 1.0
          : 0.25,
      0,
      side === "left" ? 0.12 : -0.12,
    );
    l.elbow.rotation.set(-0.1, 0, 0);
  }
  if (unit.guard && !dead) {
    model.limbs.left.shoulder.rotation.x = 1.1;
    model.limbs.left.elbow.rotation.x = 0.5;
  }
  if (unit.attack >= 0 && !dead) {
    const p = unit.attack,
      wind = Math.min(1, p / 0.34),
      strike = Math.min(1, Math.max(0, (p - 0.34) / 0.24)),
      recover = Math.min(1, Math.max(0, (p - 0.58) / 0.42));
    const a = 1.0 + wind * 1.65 - strike * 1.75 + recover * 0.1;
    model.limbs.right.shoulder.rotation.set(
      a,
      -0.2 + strike * 0.5,
      -0.28 + strike * 0.7,
    );
    model.limbs.right.elbow.rotation.x = -0.3;
    model.body.rotation.y = -wind * 0.2 + strike * 0.4 - recover * 0.2;
  }
  if (dead) {
    model.limbs.right.shoulder.rotation.z = -0.7;
    model.limbs.left.shoulder.rotation.z = 0.6;
  }
  const vertices = model.cape.geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const y = vertices.getY(i);
    vertices.setZ(
      i,
      Math.sin(time * (run ? 9 : 3) + y * 6 + unit.pair) * (0.6 - y) * 0.045 +
        (run ? 0.15 : 0),
    );
  }
  vertices.needsUpdate = true;
}

export function dragonModel() {
  const root = new T.Group();
  mesh(root, sphere, palette.dark, [0, 0, 0], [0.72, 0.6, 2]);
  for (let i = 0; i < 6; i++) {
    const m = mesh(
      root,
      cone,
      palette.gold,
      [0, 0.6 - i * 0.025, 0.9 - i * 0.48],
      [0.16, 0.45, 0.16],
    );
    m.rotation.x = -0.3;
  }
  const neck = mesh(
    root,
    cylinder,
    palette.dark,
    [0, 0.5, -1.9],
    [0.3, 1.3, 0.3],
  );
  neck.rotation.x = -0.65;
  const head = group(root, [0, 0.8, -2.45]);
  mesh(head, sphere, palette.dark, [0, 0, 0], [0.38, 0.31, 0.7]);
  mesh(head, box, palette.rust, [0, -0.15, -0.4], [0.47, 0.14, 0.8]);
  const hot = new T.MeshStandardMaterial({
    color: 0xff8927,
    emissive: 0xff4d05,
    emissiveIntensity: 3,
  });
  for (const s of [-1, 1]) {
    mesh(head, sphere, hot, [s * 0.3, 0.11, -0.27], [0.055, 0.045, 0.1]);
    const horn = mesh(
      head,
      cone,
      palette.gold,
      [s * 0.3, 0.35, 0.1],
      [0.1, 0.72, 0.1],
    );
    horn.rotation.z = -s * 0.45;
  }
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = group(root, [side * 0.5, 0.15, -0.35]);
    const points = [
      0,
      0,
      0,
      side * 2.3,
      0.65,
      -1.1,
      side * 4.8,
      0.1,
      0.5,
      side * 3.1,
      -0.12,
      1.2,
      side * 1.7,
      -0.05,
      1.6,
      0,
      0,
      0.8,
    ];
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(points, 3));
    g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
    g.computeVertexNormals();
    const mat = palette.wing.clone();
    mat.side = T.DoubleSide;
    mesh(wing, g, mat);
    for (const end of [
      [side * 2.3, 0.65, -1.1],
      [side * 4.8, 0.1, 0.5],
      [side * 3.1, -0.12, 1.2],
    ]) {
      const v = new T.Vector3(...end);
      const bone = mesh(
        wing,
        cylinder,
        palette.dark,
        v.clone().multiplyScalar(0.5).toArray(),
        [0.05, v.length(), 0.05],
      );
      bone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    }
    wings.push(wing);
    for (const z of [-0.6, 0.9]) {
      const leg = mesh(
        root,
        cylinder,
        palette.dark,
        [side * 0.62, -0.65, z],
        [0.12, 0.8, 0.12],
      );
      leg.rotation.z = side * 0.45;
      mesh(
        root,
        cone,
        palette.bone,
        [side * 0.78, -1, z - 0.2],
        [0.12, 0.28, 0.1],
      ).rotation.x = Math.PI;
    }
  }
  const tail = mesh(root, cone, palette.dark, [0, 0, 3.2], [0.3, 3, 0.3]);
  tail.rotation.x = Math.PI / 2;
  return { root, wings, head };
}
