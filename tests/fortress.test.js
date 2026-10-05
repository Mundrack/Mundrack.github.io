import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Raycaster, Vector3 } from '../js/vendor/three.module.js';
import { buildFortress } from '../js/fortress.js';
import { plantVegetation } from '../js/vegetation.js';
import { terrainHeight, groundHeight, paving } from '../js/ground.js';
import { Matrix4 } from '../js/vendor/three.module.js';

test('vegetation is instanced, rooted in terrain and leaves the central fighting space open',()=> {
  const group=plantVegetation(new Scene()),matrix=new Matrix4(),point=new Vector3();
  let draws=0,triangles=0;
  group.traverse(o=> {
    if(!o.isMesh)return;
    assert.ok(o.isInstancedMesh);draws++;
    triangles+=(o.geometry.index?.count || o.geometry.attributes.position.count)/3*o.count;
    for(let i=0;i<o.count;i++) {
      o.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);
      assert.ok(Math.abs(point.x)>4,'keep central approach clear');
      if(o.name==='Tree trunks and branches') {
        assert.ok(Math.abs(point.x)>20,'trees cannot obscure close combat');
        assert.ok(Math.abs(point.y-(terrainHeight(point.x,point.z)-.06))<.0001);
      }
    }
  });
  assert.equal(draws,4);assert.ok(triangles<450000);
  const tile=paving[10];assert.equal(groundHeight(tile.x,tile.z),0);
  assert.equal(groundHeight(7,0),terrainHeight(7,0));
  group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

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
