import * as T from './vendor/three.module.js';
import { terrainHeight } from './ground.js';
import { plantVegetation } from './vegetation.js';
export { terrainHeight } from './ground.js';

// Deterministic scenery: the combat corridor stays clear, with layered relief
// beyond it. Instances keep repeated grass and rubble inexpensive to draw.

export function dressBattlefield(scene, maps = [], terrainMaps = []) {
  const group = new T.Group(); group.name = 'Battlefield scenery'; scene.add(group);
  const stone = new T.MeshStandardMaterial({ color: 0x77706a, roughness: .94, map: maps?.[0] || null, normalMap: maps?.[1] || null, roughnessMap: maps?.[2] || null });
  const cliffMaps = terrainMaps.slice(0, 2).map(texture => {
    const copy = texture.clone(); copy.repeat.set(3, 3); return copy;
  });
  const darkStone = new T.MeshStandardMaterial({ color: 0x696d70, roughness: 1,
    map: cliffMaps[0] || null, normalMap: cliffMaps[1] || null });
  const dummy = new T.Object3D();
  const random = n => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
  // Two ridgelines, with different heights and depths, frame the fortress.
  const cliffs = new T.InstancedMesh(new T.DodecahedronGeometry(1, 1), darkStone, 42);
  for (let i = 0; i < 42; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (30 + random(i + 4) * 24), z = -65 + random(i + 51) * 90;
    const height = 5 + random(i + 97) * 13;
    dummy.position.set(x, height * .32 - 2, z);
    dummy.scale.set(5 + random(i) * 6, height, 5 + random(i + 3) * 7);
    dummy.rotation.set(.12 * random(i), random(i + 11) * 6, side * .18);
    dummy.updateMatrix(); cliffs.setMatrixAt(i, dummy.matrix);
  }
  cliffs.receiveShadow = true; group.add(cliffs);
  // Broken masonry creates a middle distance between troops and silhouettes.
  const rubble = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), stone, 120);
  for (let i = 0; i < 120; i++) {
    const x = (i % 2 ? 1 : -1) * (14 + random(i + 21) * 12), z = -26 + random(i + 45) * 49;
    dummy.scale.set(.5 + random(i) * 1.6, .3 + random(i + 1) * 1.3, .4 + random(i + 2));
    dummy.position.set(x, terrainHeight(x, z) + dummy.scale.y * .35, z);
    dummy.rotation.set(random(i + 7) * .5, random(i + 8) * 6, random(i + 9) * .6);
    dummy.updateMatrix(); rubble.setMatrixAt(i, dummy.matrix);
  }
  rubble.castShadow = true; rubble.receiveShadow = true; group.add(rubble);
  const blade = new T.BufferGeometry();
  blade.setAttribute('position', new T.Float32BufferAttribute([-.1,0,0, .1,0,0, .035,1,.12, 0,0,-.1, 0,0,.1, .12,.8,.035], 3));
  blade.computeVertexNormals();
  const grass = new T.InstancedMesh(blade, new T.MeshStandardMaterial({ color: 0x555345, side: T.DoubleSide, roughness: 1 }), 700);
  for (let i = 0; i < 700; i++) {
    const x = (i % 2 ? 1 : -1) * (10 + random(i + 19) * 24), z = -30 + random(i + 60) * 60;
    dummy.position.set(x, terrainHeight(x, z), z);
    dummy.rotation.set(0, random(i + 1) * 6, 0);
    dummy.scale.setScalar(.18 + random(i + 5) * .55);
    dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
  }
  grass.receiveShadow = true; group.add(grass);
  plantVegetation(group);
  return group;
}
