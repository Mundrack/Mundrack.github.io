"""Blender 4.5: input GLB, output GLB, preview PNG. Original procedural materials.
Run on the dragon from c8247ab; do not repeatedly process the output.
"""
import bpy, sys, math, os
import numpy as np
from mathutils import Vector, Quaternion
source, output, preview = sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
body=max((o for o in scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='fly')
for track in rig.animation_data.nla_tracks:track.mute=True
scene.frame_set(0);bpy.context.view_layer.update()
base={p.name:(p.location.copy(),p.rotation_quaternion.copy(),p.scale.copy()) for p in rig.pose.bones}
rig.animation_data_clear();rig.animation_data_create()
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
action=bpy.data.actions.new('fly');rig.animation_data.action=action
scene.render.fps=48
for f in range(97):
    phase=f/96*math.tau
    for p in rig.pose.bones:
        p.rotation_mode='QUATERNION';p.location,p.rotation_quaternion,p.scale=base[p.name]
    def rotate(name,axis,angle):
        p=rig.pose.bones.get(name)
        if p:
            rest=p.bone.matrix_local.to_quaternion()
            p.rotation_quaternion=base[name][1] @ rest.inverted() @ Quaternion(axis,angle) @ rest
    # Shoulder leads; outer membrane follows with a delayed, smaller fold.
    for side,sign in [('L',1),('R',-1)]:
        beat=math.sin(phase)+.16*math.sin(2*phase)
        rotate('wing_upper.'+side,(0,1,0),sign*.18*beat)
        rotate('wing_lower.'+side,(0,1,0),sign*.40*math.sin(phase-.42))
        rotate('leg_back_upper.'+side,(1,0,0),.045*math.sin(phase-.8))
        rotate('leg_front_upper.'+side,(1,0,0),.035*math.sin(phase-.5))
    for i in range(1,4):
        rotate('tail'+str(i),(0,0,1),(.025+i*.015)*math.sin(phase-i*.55))
        rotate('neck'+str(i),(1,0,0),.025*math.sin(phase-.3*i))
    for p in rig.pose.bones:
        p.keyframe_insert('location',frame=f);p.keyframe_insert('rotation_quaternion',frame=f);p.keyframe_insert('scale',frame=f)

# New 2K physically varied scale detail; original diffuse remains an undercoat.
n=2048;y,x=np.mgrid[0:n,0:n].astype(np.float32)/n
row=np.floor(y*80);u=((x*80+(row%2)*.5)%1-.5)*2;v=(y*80)%1
cell=np.clip(1-u*u-(v-.25)**2*1.7,0,1)
height=cell**1.5
grain=np.sin(x*math.tau*317)*np.sin(y*math.tau*293)
dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*2.2
dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*2.2
length=np.sqrt(dx*dx+dy*dy+1)
def image(name,pixels,color=False):
    im=bpy.data.images.new(name,n,n,alpha=True)
    im.colorspace_settings.name='sRGB' if color else 'Non-Color'
    im.pixels.foreach_set(np.asarray(pixels,dtype=np.float32).ravel());im.pack();return im
normal=image('Dragon scale relief 2K',np.stack((.5-dx/length*.5,.5-dy/length*.5,.5+.5/length,np.ones_like(x)),axis=-1))
tone=.20+.36*cell+.025*grain+.045*np.sin(x*math.tau*11)*np.sin(y*math.tau*13)
detail=image('Dragon obsidian scale color 2K',np.stack((tone*.88,tone*.94,tone,np.ones_like(x)),axis=-1),True)
veins=np.exp(-np.abs(np.sin(x*math.tau*23+.6*np.sin(y*math.tau*5)))*24)
membrane_detail=image('Dragon leather membrane 2K',np.stack((.20-.055*veins+.008*grain,.035-.012*veins+.003*grain,.045-.014*veins+.003*grain,np.ones_like(x)),axis=-1),True)
rough=.54+.25*(1-cell)+.025*grain
roughmap=image('Dragon scale roughness 2K',np.stack((rough,rough,rough,np.ones_like(x)),axis=-1))
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True;scene.render.bake.margin=12
rig.data.pose_position='REST'
for index,m in enumerate(body.data.materials):
    nodes=m.node_tree.nodes;links=m.node_tree.links;bs=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexImage');tex.image=detail if index==0 else membrane_detail
    original=bs.inputs['Base Color'].links[0].from_socket if bs.inputs['Base Color'].links else None
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[0].default_value=.55 if index==0 else 1
    if original:links.new(original,mix.inputs[1])
    else:mix.inputs[1].default_value=(.12,.025,.02,1)
    links.new(tex.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],bs.inputs['Base Color'])
    if index>0:
        mix.inputs[1].default_value=(.16,.025,.035,1)
        for link in list(mix.inputs[1].links):links.remove(link)
    roughtex=nodes.new('ShaderNodeTexImage');roughtex.image=roughmap;links.new(roughtex.outputs['Color'],bs.inputs['Roughness'])
    nt=nodes.new('ShaderNodeTexImage');nt.image=normal
    nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.4 if index==0 else .015
    links.new(nt.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    bs.inputs['Metallic'].default_value=.06 if index==0 else 0
    baked=bpy.data.images.new('Dragon '+('skin' if index==0 else 'membrane')+' albedo 2K',n,n,alpha=False)
    target=nodes.new('ShaderNodeTexImage');target.image=baked;nodes.active=target
    # All material slots need an active bake target; assign separate temporary
    # images for slots not being baked yet to avoid circular texture dependencies.
    for other in body.data.materials:
        if other==m:continue
        tmp=other.node_tree.nodes.new('ShaderNodeTexImage');tmp.image=bpy.data.images.new('Bake scratch',n,n);other.node_tree.nodes.active=tmp
    bpy.ops.object.bake(type='DIFFUSE');baked.pack()
    links.new(target.outputs['Color'],bs.inputs['Base Color'])
rig.data.pose_position='POSE';scene.frame_set(24)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type in ['MESH','ARMATURE','EMPTY']:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_image_format='AUTO')
# Render the actual resulting material, with the same camera as the earlier inspection.
scene.cycles.samples=24;scene.render.resolution_x=1100;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Dragon inspection');scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.09,.11,.15,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.5
target=Vector((0,0,.1))
bpy.ops.object.camera_add(location=(1.6,-2,1.2));cam=bpy.context.object
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.7;scene.camera=cam
for loc,power,color in [((2,-4,5),500,(1,.8,.6)),((-3,-1,3),250,(.55,.7,1)),((0,3,4),700,(1,.45,.2))]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.size=3;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
scene.view_settings.view_transform='AgX';scene.render.filepath=preview;bpy.ops.render.render(write_still=True)
print('DRAGON_DONE',os.path.getsize(output))
