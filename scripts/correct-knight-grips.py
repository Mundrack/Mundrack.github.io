"""Blender 4.5: correct the authored hand/weapon mismatch in commit 7be7c15.
Usage: blender -b --python scripts/correct-knight-grips.py -- INPUT.glb OUTPUT.glb
The source has the sword on negative X (leftHand) and shield on positive X
(rightHand). The old clips attacked with the shield and guarded with the sword.
"""
import bpy,sys,math
from mathutils import Matrix,Quaternion,Vector
source,destination=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=source)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
scene=bpy.context.scene  # Preserve the importer's frame rate and clip durations.
reflection=Matrix.Diagonal(Vector((-1,1,1,1)))
arms=[side+part for side in ['left','right'] for part in ['UpperArm','Forearm','Hand']]
actions=list(bpy.data.actions)
# Cache the original world-space arm transforms before changing any channels.
clips={}
for action in actions:
    rig.animation_data.action=action
    for track in rig.animation_data.nla_tracks:track.mute=True
    frames={}
    frame_times=list(range(math.floor(action.frame_range[0]),math.ceil(action.frame_range[1])))+[float(action.frame_range[1])]
    for frame in frame_times:
        scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update()
        frames[frame]={n:rig.pose.bones[n].matrix.copy() for n in arms}
    clips[action.name]=frames

# Principal axes of the actual shield surface in bind space. Positive local
# normal points out of its face; its long axis should be vertical during guard.
normal=Vector((.5294475,.8478048,-.0302038)).normalized()
up=Vector((.3630209,-.1942375,.911311)).normalized()
across=up.cross(normal).normalized()
source_basis=Matrix((normal,across,up)).transposed()
target_basis=Matrix((Vector((0,-1,0)),Vector((1,0,0)),Vector((0,0,1)))).transposed()
shield_rotation=(target_basis@source_basis.transposed()).to_quaternion()
def guard_arm():
    upper=rig.pose.bones['rightUpperArm'];fore=rig.pose.bones['rightForearm'];hand=rig.pose.bones['rightHand']
    rest_upper=fore.bone.head_local-upper.bone.head_local
    rest_fore=hand.bone.head_local-fore.bone.head_local
    start=upper.matrix.translation.copy();target=Vector((.30,-.45,1.58))
    delta=target-start;distance=min(delta.length,rest_upper.length+rest_fore.length-.001);direction=delta.normalized()
    along=(rest_upper.length_squared-rest_fore.length_squared+distance*distance)/(2*distance)
    bend=(Vector((1,0,0))-direction*direction.x).normalized()
    elbow=start+direction*along+bend*math.sqrt(max(0,rest_upper.length_squared-along*along))
    for pb,origin,rest,aim in [(upper,start,rest_upper,elbow-start),(fore,elbow,rest_fore,target-elbow)]:
        rotation=rest.rotation_difference(aim)@pb.bone.matrix_local.to_quaternion()
        pb.matrix=Matrix.LocRotScale(origin,rotation,Vector((1,1,1)));bpy.context.view_layer.update()
    hand.matrix=Matrix.LocRotScale(target,shield_rotation,Vector((1,1,1)))
    bpy.context.view_layer.update()
for action in actions:
    rig.animation_data.action=action
    frames=clips[action.name];last=max(frames)
    for frame,poses in frames.items():
        scene.frame_set(math.floor(frame),subframe=frame%1)
        for part in ['UpperArm','Forearm','Hand']:
            for side,other in [('left','right'),('right','left')]:
                pb=rig.pose.bones[side+part]
                pb.matrix=reflection@poses[other+part]@reflection
                bpy.context.view_layer.update()
        if action.name!='death':
            pitch=-.1
            if action.name=='attack':
                p=frame/max(last,1)
                keys=[(0,0),(.3,-.7),(.42,.6),(.49,1.6),(.66,2.1),(1,0)]
                for (a,va),(b,vb) in zip(keys,keys[1:]):
                    if a<=p<=b:
                        q=(p-a)/(b-a);q=q*q*(3-2*q);pitch=va+(vb-va)*q;break
            for hand,rotation in [('leftHand',Quaternion((1,0,0),pitch-1.10)),('rightHand',shield_rotation)]:
                pb=rig.pose.bones[hand]
                # Rotation around the wrist preserves the existing grip position.
                pb.matrix=Matrix.LocRotScale(pb.matrix.translation.copy(),rotation,Vector((1,1,1)))
                bpy.context.view_layer.update()
            if action.name=='guard':guard_arm()
        for name in arms:
            pb=rig.pose.bones[name];pb.rotation_mode='QUATERNION'
            pb.keyframe_insert('rotation_quaternion',frame=frame)
            pb.keyframe_insert('location',frame=frame)
    print('Corrected',action.name,len(frames),'frames')
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type in ['ARMATURE','EMPTY'] or (o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=destination,export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_image_format='AUTO')
