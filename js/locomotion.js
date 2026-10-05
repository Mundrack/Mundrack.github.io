import * as T from './vendor/three.module.js';
import { clone } from './vendor/SkeletonUtils.js';

const profiles = new WeakMap();
const SAMPLES = 80;
function feet(root, team) {
  return ['left','right'].map((side,i)=>root.getObjectByName(team==='knight' ? `${side}Foot` : `Bip01_${i?'R':'L'}_Foot`));
}

// Measure the shipped clip once per loaded asset. Stance speed determines the
// distance of a complete stride; no arbitrary playback-speed multiplier.
export function gaitProfile(asset, team) {
  if(profiles.has(asset))return profiles.get(asset);
  const clip=asset.animations.find(c=>c.name===(team==='knight'?'run':'walk'));
  const root=clone(asset.scene);root.rotation.y=team==='knight'?Math.PI:Math.PI/2;
  const bones=feet(root,team),mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);
  action.play();const positions=[[],[]];
  for(let i=0;i<SAMPLES;i++) {
    action.time=i/SAMPLES*clip.duration;mixer.update(0);root.updateMatrixWorld(true);
    bones.forEach((bone,k)=>positions[k].push(bone.getWorldPosition(new T.Vector3())));
  }
  const velocities=[],stance=positions.map(points=> {
    const minimum=Math.min(...points.map(p=>p.y));
    return points.map((p,i)=> {
      const next=points[(i+1)%SAMPLES],previous=points[(i+SAMPLES-1)%SAMPLES];
      const speed=(next.z-previous.z)/(2*clip.duration/SAMPLES);
      const planted=p.y<minimum+.16 && speed>.08;
      if(planted)velocities.push(speed);
      return planted;
    });
  });
  velocities.sort((a,b)=>a-b);
  const speed=velocities[Math.floor(velocities.length/2)] || 1;
  const profile={duration:clip.duration,distance:T.MathUtils.clamp(speed*clip.duration,.4,3.5),stance};
  mixer.stopAllAction();mixer.uncacheRoot(root);
  profiles.set(asset,profile);return profile;
}

export function stationaryClip(walk) {
  // A dedicated idle pose prevents a stationary zombie from continually stepping.
  const tracks=walk.tracks.map(track=> {
    const copy=track.clone();copy.times=new Float32Array([0]);
    copy.values=new Float32Array(track.createInterpolant().evaluate(0));return copy;
  });
  return new T.AnimationClip('idle',1,tracks);
}

export class FootPlanting {
  constructor(root,team,profile) {
    this.root=root;this.profile=profile;
    this.legs=feet(root,team).map(foot=>({foot,knee:foot.parent,hip:foot.parent.parent,anchor:null}));
    this.a=new T.Vector3();this.b=new T.Vector3();this.c=new T.Vector3();this.target=new T.Vector3();
    this.direction=new T.Vector3();this.pole=new T.Vector3();this.elbow=new T.Vector3();
    this.v1=new T.Vector3();this.v2=new T.Vector3();
    this.q=new T.Quaternion();this.world=new T.Quaternion();this.parentQ=new T.Quaternion();this.footQ=new T.Quaternion();
  }
  reset(){for(const leg of this.legs)leg.anchor=null;}
  rotate(bone,from,to) {
    this.q.setFromUnitVectors(from.normalize(),to.normalize());
    bone.getWorldQuaternion(this.world);this.world.premultiply(this.q);
    bone.parent.getWorldQuaternion(this.parentQ).invert();
    bone.quaternion.copy(this.parentQ.multiply(this.world));
    bone.updateWorldMatrix(false,true);
  }
  apply(phase,enabled,yaw) {
    if (!enabled) { this.reset(); return false; }
    let adjusted = false;
    const index=Math.floor(((phase%1)+1)%1*SAMPLES)%SAMPLES;
    this.root.updateWorldMatrix(true,true);
    this.legs.forEach((leg,i)=> {
      if(!enabled || !this.profile.stance[i][index]){leg.anchor=null;return;}
      leg.foot.getWorldPosition(this.c);
      if(!leg.anchor){leg.anchor=this.c.clone();return;}
      // Only horizontal support is locked; the sole/terrain solver handles Y.
      if(Math.hypot(leg.anchor.x-this.c.x,leg.anchor.z-this.c.z)>.38){leg.anchor=null;return;}
      leg.hip.getWorldPosition(this.a);leg.knee.getWorldPosition(this.b);
      this.target.set(leg.anchor.x,this.c.y,leg.anchor.z);
      const upper=this.a.distanceTo(this.b),lower=this.b.distanceTo(this.c);
      const distance=this.a.distanceTo(this.target);
      if(distance>=upper+lower-.001 || distance<=Math.abs(upper-lower)+.001){leg.anchor=null;return;}
      this.direction.subVectors(this.target,this.a).normalize();
      this.pole.subVectors(this.b,this.a).addScaledVector(this.direction,-this.pole.dot(this.direction));
      if(this.pole.lengthSq()<1e-8) {
        this.pole.set(-Math.sin(yaw),0,-Math.cos(yaw));
        this.pole.addScaledVector(this.direction,-this.pole.dot(this.direction));
      }
      this.pole.normalize();
      const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
      this.elbow.copy(this.a).addScaledVector(this.direction,along).addScaledVector(this.pole,Math.sqrt(Math.max(0,upper*upper-along*along)));
      leg.foot.getWorldQuaternion(this.footQ);
      this.rotate(leg.hip,this.v1.subVectors(this.b,this.a),this.v2.subVectors(this.elbow,this.a));
      leg.knee.getWorldPosition(this.b);leg.foot.getWorldPosition(this.c);
      this.rotate(leg.knee,this.v1.subVectors(this.c,this.b),this.v2.subVectors(this.target,this.b));
      leg.foot.parent.getWorldQuaternion(this.parentQ).invert();
      leg.foot.quaternion.copy(this.parentQ.multiply(this.footQ));leg.foot.updateWorldMatrix(false,true);
      adjusted = true;
    });
    return adjusted;
  }
}
