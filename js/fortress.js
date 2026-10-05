import * as T from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { paving } from './ground.js';

// Static architecture is merged by material: depth and detail without hundreds
// of individual draw calls. All dimensions are in battlefield metres.
export function buildFortress(scene, maps = []) {
  const group = new T.Group();
  group.name = 'Cathedral gate';
  const stone = new T.MeshStandardMaterial({ color: 0x99928b, roughness: .94,
    map: maps[0] || null, normalMap: maps[1] || null,
    roughnessMap: maps[2] || null, normalScale: new T.Vector2(.8, .8) });
  const trim = new T.MeshStandardMaterial({ color: 0x6d6250, roughness: .73, metalness: .12 });
  const iron = new T.MeshStandardMaterial({ color: 0x262328, metalness: .72, roughness: .48 });
  const gold = new T.MeshStandardMaterial({ color: 0x9b753d, metalness: .7, roughness: .39 });
  const glass = new T.MeshStandardMaterial({ color: 0x8f351b, emissive: 0xff8e3f, emissiveIntensity: 1.7 });
  const batches = new Map();
  const matrix = new T.Matrix4(), quaternion = new T.Quaternion(), scale = new T.Vector3(1, 1, 1);
  function add(geometry, material, x, y, z, rotation = 0) {
    quaternion.setFromAxisAngle(new T.Vector3(0, 1, 0), rotation);
    matrix.compose(new T.Vector3(x, y, z), quaternion, scale);
    geometry.applyMatrix4(matrix);
    if (material === stone) {
      const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        // World-scale masonry avoids stretching one texture across an entire tower.
        uv.setXY(i, (ax > az ? p.getZ(i) : p.getX(i)) / 3,
          (ay > Math.max(ax, az) ? p.getZ(i) : p.getY(i)) / 3);
      }
    }
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(geometry);
  }
  const box = (w, h, d, material, x, y, z) => add(new T.BoxGeometry(w, h, d), material, x, y, z);
  // Broken processional paving, flush with the actors' ground plane.
  for (const tile of paving) {
    const g = new T.BoxGeometry(1.05, .075, 1.35);
    g.rotateY(tile.angle);
    add(g, stone, tile.x, -.0375, tile.z);
  }
  // A pointed Gothic opening, built as a real extruded ring, not a painted wall.
  function arch(x, y, z, width, height, thickness, material) {
    const outer = new T.Shape();
    outer.moveTo(-width / 2, 0); outer.lineTo(-width / 2, height * .56);
    outer.quadraticCurveTo(-width / 2, height * .8, 0, height);
    outer.quadraticCurveTo(width / 2, height * .8, width / 2, height * .56);
    outer.lineTo(width / 2, 0); outer.closePath();
    const hole = new T.Path(), w = width / 2 - thickness, h = height - thickness;
    hole.moveTo(-w, 0); hole.lineTo(w, 0); hole.lineTo(w, h * .56);
    hole.quadraticCurveTo(w, h * .8, 0, h);
    hole.quadraticCurveTo(-w, h * .8, -w, h * .56); hole.closePath();
    outer.holes.push(hole);
    add(new T.ExtrudeGeometry(outer, { depth: .45, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 2, steps: 1, curveSegments: 12 }), material, x, y, z);
  }
  // Central entrance and deep, stepped archivolts.
  for (const side of [-1, 1]) {
    box(5.2, 17, 4.5, stone, side * 6.6, 8.5, -39);
    box(18, 6, 2.2, stone, side * 18, 3, -39);
    for (let i = 0; i < 5; i++) {
      const x = side * (11.2 + i * 3.3);
      box(.8, 7, 3, stone, x, 3.5, -37.8);
      box(1.1, .3, 3.2, trim, x, 6.9, -37.8);
    }
    // Tower, stone string courses and slate crown.
    for (const x of [side * 8.1, side * 28]) {
      const height = Math.abs(x) < 10 ? 20 : 13;
      add(new T.CylinderGeometry(2.1, 2.5, height, 16), stone, x, height / 2, -39);
      for (const y of [1, 5, 10, height - .5]) add(new T.CylinderGeometry(2.5, 2.5, .32, 16), trim, x, y, -39);
      add(new T.ConeGeometry(2.9, 7, 16), iron, x, height + 3.1, -39);
      add(new T.ConeGeometry(.18, 2, 8), gold, x, height + 7.5, -39);
      for (let n = 0; n < 8; n++) {
        const a = n * Math.PI / 4;
        box(.6, 1.1, .6, stone, x + Math.cos(a) * 2.15, height + .35, -39 + Math.sin(a) * 2.15);
      }
      for (const y of [5, 10, 15].filter(y => y < height - 1)) {
        box(.65, 2, .1, glass, x, y, -36.85);
        arch(x, y - 1, -36.7, 1.1, 2.5, .18, trim);
        box(.09, 2.1, .16, iron, x, y, -36.55);
      }
    }
  }
  box(8.2, 5.5, 4, stone, 0, 14.25, -39);
  const gateWall = new T.Shape();
  gateWall.moveTo(-4.25, 0); gateWall.lineTo(4.25, 0);
  gateWall.lineTo(4.25, 12); gateWall.lineTo(-4.25, 12); gateWall.closePath();
  const opening = new T.Path();
  opening.moveTo(-3.4, 0); opening.lineTo(3.4, 0); opening.lineTo(3.4, 6.2);
  opening.quadraticCurveTo(3.4, 8.8, 0, 11.1);
  opening.quadraticCurveTo(-3.4, 8.8, -3.4, 6.2); opening.closePath();
  gateWall.holes.push(opening);
  add(new T.ExtrudeGeometry(gateWall, { depth: 2, bevelEnabled: false, curveSegments: 16 }), stone, 0, 0, -39);
  for (let i = 0; i < 3; i++) arch(0, 0, -36.9 - i * .5, 8.5 - i * .65, 12.5 - i * .45, .3, i === 1 ? gold : trim);
  // Portcullis remains visible in the recess.
  for (let i = -5; i <= 5; i++) box(.12, 9, .18, iron, i * .59, 4.5, -38.8);
  for (const y of [1.3, 3, 5, 7, 8.5]) box(6.4, .12, .18, iron, 0, y, -38.85);
  // Rose window, radial tracery and warm panes above the gate.
  const rose = new T.CircleGeometry(1.85, 48);
  add(rose, glass, 0, 14.25, -36.93);
  add(new T.TorusGeometry(1.9, .17, 8, 48), gold, 0, 14.25, -36.8);
  add(new T.TorusGeometry(.62, .09, 8, 32), trim, 0, 14.25, -36.65);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const spoke = new T.BoxGeometry(.075, 3.65, .12);
    spoke.rotateZ(angle); add(spoke, trim, 0, 14.25, -36.65);
  }
  // Ruined processional colonnades frame the field, outside the combat corridor.
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const x = side * 17, z = -24 + i * 9, height = 4.5 + (i % 3) * .7;
    box(1.8, .6, 1.8, stone, x, .3, z);
    add(new T.CylinderGeometry(.54, .7, height, 12), stone, x, height / 2 + .4, z);
    box(1.4, .4, 1.4, trim, x, height + .45, z);
    add(new T.ConeGeometry(.7, 1.6, 8), stone, x, height + 1.4, z);
  }
  // Four braziers provide readable warm landmarks without shadow-casting lights.
  for (const x of [-12.5, 12.5]) for (const z of [-17, 12]) {
    add(new T.CylinderGeometry(.65, .9, .7, 12), stone, x, .35, z);
    add(new T.CylinderGeometry(.16, .28, 1.5, 12), iron, x, 1.4, z);
    add(new T.CylinderGeometry(.65, .26, .45, 12), gold, x, 2.25, z);
    add(new T.IcosahedronGeometry(.37, 1), glass, x, 2.57, z);
    const light = new T.PointLight(0xff984a, 12, 7, 2);
    light.position.set(x, 2.8, z); group.add(light);
  }
  for (const [material, geometries] of batches) {
    // Extrusions have indexed and non-indexed variants; normalize attributes.
    const normalized = geometries.map(g => g.index ? g.toNonIndexed() : g);
    const merged = mergeGeometries(normalized);
    const mesh = new T.Mesh(merged, material);
    mesh.castShadow = material !== glass; mesh.receiveShadow = true;
    mesh.name = `Fortress ${material === stone ? 'masonry' : material === glass ? 'embers' : 'ornament'}`;
    group.add(mesh);
    new Set([...geometries, ...normalized]).forEach(g => g.dispose());
  }
  scene.add(group);
  return group;
}
