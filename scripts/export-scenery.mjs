// Export static scenery geometry for independent Blender inspection (not WebGL QA).
// Usage: node scripts/export-scenery.mjs output.json
import fs from 'node:fs';
import * as T from '../js/vendor/three.module.js';
import { buildFortress } from '../js/fortress.js';
import { dressBattlefield, terrainHeight } from '../js/environment.js';

if (!process.argv[2]) throw new Error('Provide an output JSON path');
const scene = new T.Scene();
buildFortress(scene);
dressBattlefield(scene);
const terrain = new T.PlaneGeometry(140, 180, 70, 90);
terrain.rotateX(-Math.PI / 2);
const p = terrain.attributes.position;
for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
terrain.computeVertexNormals();
const ground = new T.Mesh(terrain, new T.MeshStandardMaterial({ color: 0x545049 }));
ground.name = 'ground'; scene.add(ground); scene.updateMatrixWorld(true);
const meshes = [];
scene.traverse(o => {
  if (!o.isMesh) return;
  const g = o.geometry, count = o.isInstancedMesh ? o.count : 1;
  for (let k = 0; k < count; k++) {
    const matrix = o.matrixWorld.clone();
    if (o.isInstancedMesh) { const m = new T.Matrix4(); o.getMatrixAt(k, m); matrix.multiply(m); }
    meshes.push({ name: o.name, positions: Array.from(g.attributes.position.array),
      normals: Array.from(g.attributes.normal.array),
      uv: g.attributes.uv ? Array.from(g.attributes.uv.array) : null,
      index: g.index ? Array.from(g.index.array) : null, matrix: matrix.elements,
      color: o.material.color.toArray(), metal: o.material.metalness,
      rough: o.material.roughness, emissive: o.material.emissive?.toArray() });
  }
});
fs.writeFileSync(process.argv[2], JSON.stringify(meshes));
console.log(`Exported ${meshes.length} scenery objects`);
