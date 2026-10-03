import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Raycaster, Vector3 } from '../js/vendor/three.module.js';
import { buildFortress } from '../js/fortress.js';

test('fortress stays within a static geometry budget and leaves the combat corridor clear', () => {
  const scene = new Scene(), group = buildFortress(scene);
  scene.updateMatrixWorld(true);
  let triangles = 0, draws = 0;
  group.traverse(o => {
    if (!o.isMesh) return;
    draws++;
    triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
    assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));
    assert.ok([...o.geometry.attributes.uv.array].every(Number.isFinite));
  });
  assert.ok(draws <= 5, 'static architecture merged by material');
  assert.ok(triangles < 30000, 'ornaments cannot silently explode the mesh budget');
  for (const x of [-8, 0, 8]) for (const z of [-18, 0, 18]) {
    const ray = new Raycaster(new Vector3(x, 3, z), new Vector3(0, -1, 0), 0, 2.8);
    assert.equal(ray.intersectObject(group, true).length, 0, 'no scenery protrudes into combat space');
  }
  group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
});
