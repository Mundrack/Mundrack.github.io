import * as T from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { terrainHeight } from './ground.js';

const random = n => { const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v); };
// Original mesh vegetation, instanced in batches. No alpha cards, downloads,
// collision obstacles in the fighting corridor, or per-frame allocations.
export function plantVegetation(parent) {
  const group=new T.Group();group.name='Woodland and undergrowth';parent.add(group);
  const bark=new T.MeshStandardMaterial({color:0x443d30,roughness:.97});
  const foliage=new T.MeshStandardMaterial({color:0x607042,roughness:.92,side:T.DoubleSide});
  const grassMaterial=new T.MeshStandardMaterial({color:0x53643b,roughness:1,side:T.DoubleSide});
  const dummy=new T.Object3D(), color=new T.Color();
  function instances(name,geometry,material,count,place,shadow=false) {
    const mesh=new T.InstancedMesh(geometry,material,count);mesh.name=name;
    for(let i=0;i<count;i++) {
      dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);
      place(dummy,i);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      color.setRGB(.65+random(i+3)*.35,.7+random(i+7)*.3,.6+random(i+13)*.35);
      mesh.setColorAt(i,color);
    }
    mesh.castShadow=shadow;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  function branch(a,b,bottom,top) {
    const delta=b.clone().sub(a),g=new T.CylinderGeometry(top,bottom,delta.length(),8,3);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
    g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());return g;
  }
  const limbs=[branch(new T.Vector3(),new T.Vector3(.12,5,0),.33,.12)];
  for(let i=0;i<9;i++) {
    const a=i*2.4,start=new T.Vector3(.08,2.7+i*.27,0);
    const end=new T.Vector3(Math.cos(a)*(1.4+random(i)),5.1+random(i+2)*1.9,Math.sin(a)*(1.4+random(i)));
    limbs.push(branch(start,end,.11,.025));
    limbs.push(branch(end,end.clone().add(new T.Vector3(Math.cos(a+.6)*.65,.65,Math.sin(a+.6)*.65)),.035,.008));
  }
  const trunk=mergeGeometries(limbs);limbs.forEach(g=>g.dispose());
  const leafPositions=[];
  // Small folded diamond leaves, distributed through an irregular canopy.
  for(let i=0;i<1000;i++) {
    const a=random(i+31)*Math.PI*2,r=Math.sqrt(random(i+41))*2.7;
    const x=Math.cos(a)*r,z=Math.sin(a)*r,y=5.5+(random(i+57)-.5)*2.8+.3*Math.sin(a*3);
    const size=.14+random(i+71)*.16,turn=random(i+91)*Math.PI*2;
    const dx=Math.cos(turn)*size,dz=Math.sin(turn)*size;
    leafPositions.push(x-dx,y,z-dz, x-dz*.6,y+.035,z+dx*.6, x+dx,y+.09,z+dz,
      x-dx,y,z-dz, x+dx,y+.09,z+dz, x+dz*.6,y-.025,z-dx*.6);
  }
  const leaves=new T.BufferGeometry();leaves.setAttribute('position',new T.Float32BufferAttribute(leafPositions,3));leaves.computeVertexNormals();
  const treePlace=(d,i)=> {
    const x=(i%2?1:-1)*(21+random(i+102)*8),z=-29+random(i+110)*60;
    d.position.set(x,terrainHeight(x,z)-.06,z);d.rotation.y=random(i+114)*6.28;
    d.scale.setScalar(.85+random(i+121)*.65);
  };
  instances('Tree trunks and branches',trunk,bark,28,treePlace,true);
  instances('Tree leaf canopies',leaves,foliage,28,treePlace,true);
  instances('Low shrubs',leaves,foliage,110,(d,i)=> {
    const x=(i%2?1:-1)*(11.5+random(i+201)*16),z=-28+random(i+217)*54;
    const scale=.13+random(i+224)*.08;
    d.position.set(x,terrainHeight(x,z)-4.2*scale,z);d.rotation.y=random(i+232)*6.28;d.scale.setScalar(scale);
  });
  const blades=[];
  for(let i=0;i<7;i++) {
    const a=i*2.4,x=Math.cos(a)*.09,z=Math.sin(a)*.09,h=.22+random(i+280)*.33,w=.022;
    const dx=Math.cos(a)*w,dz=Math.sin(a)*w,bx=Math.sin(a)*.1,bz=Math.cos(a)*.1;
    blades.push(x-dx,0,z-dz,x+dx,0,z+dz,x+dx+bx*.4,h*.55,z+dz+bz*.4,
      x-dx,0,z-dz,x+dx+bx*.4,h*.55,z+dz+bz*.4,x-dx+bx*.4,h*.55,z-dz+bz*.4,
      x-dx+bx*.4,h*.55,z-dz+bz*.4,x+dx+bx*.4,h*.55,z+dz+bz*.4,x+bx,h,z+bz);
  }
  const tuft=new T.BufferGeometry();tuft.setAttribute('position',new T.Float32BufferAttribute(blades,3));tuft.computeVertexNormals();
  instances('Meadow grass',tuft,grassMaterial,4800,(d,i)=> {
    // Dense grass at the flanks; short sparse shoots inside the clearing.
    const edge=i<4300,x=(i%2?1:-1)*(edge?9+random(i+340)*22:4.1+random(i+340)*4.5),z=-30+random(i+370)*61;
    d.position.set(x,terrainHeight(x,z),z);d.rotation.y=random(i+399)*6.28;d.scale.setScalar(edge?.65+random(i+411)*.75:.3);
  });
  return group;
}
