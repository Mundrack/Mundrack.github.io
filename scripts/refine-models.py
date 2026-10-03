"""Blender 4.5: refine existing licensed GLBs without replacing their animation.

blender -b --python scripts/refine-models.py -- SOURCE_DIR OUTPUT_DIR PREVIEW_DIR
SOURCE_DIR must contain the original knight/zombie/dragon GLBs (commit 7150f0f).
Geometry and procedural material detail are authored here; no external images.
"""
import bpy, sys, math, os
import numpy as np
from mathutils import Vector, kdtree

arguments = sys.argv[sys.argv.index('--') + 1:]
source, destination, previews = arguments[:3]
os.makedirs(previews, exist_ok=True)

def material(name, color, metal=0, rough=.8):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    return m

def normal_texture(name, scales=False):
    # Analytic tileable tangent normal maps: overlapping scale cells or woven cloth.
    n = 1024
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) / n
    if scales:
        row = np.floor(y * 96)
        u = ((x * 96 + (row % 2) * .5) % 1 - .5) * 2
        v = (y * 96) % 1
        h = np.clip(1 - u*u - (v-.35)**2 * 2, 0, 1)**2
        h += .035 * np.sin(x*math.tau*213) * np.sin(y*math.tau*197)
        strength = 1.4
    else:
        h = .4*np.sin(x*math.tau*128) + .4*np.sin(y*math.tau*128)
        strength = .6
    dx = (np.roll(h, -1, axis=1)-np.roll(h, 1, axis=1))*strength
    dy = (np.roll(h, -1, axis=0)-np.roll(h, 1, axis=0))*strength
    length = np.sqrt(dx*dx+dy*dy+1)
    pixels = np.stack((.5-dx/length*.5, .5-dy/length*.5, .5+.5/length, np.ones_like(x)), axis=-1)
    img = bpy.data.images.new(name, n, n, alpha=True)
    img.colorspace_settings.name = 'Non-Color'; img.pixels.foreach_set(pixels.ravel()); img.pack()
    return img

def use_normal(m, image, strength):
    nodes=m.node_tree.nodes; links=m.node_tree.links
    tex=nodes.new('ShaderNodeTexImage'); tex.image=image
    normal=nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value=strength
    links.new(tex.outputs['Color'],normal.inputs['Color'])
    links.new(normal.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])

for name in arguments[3:] or ['knight','zombie','dragon']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(source,name+'.glb'))
    scene=bpy.context.scene
    rig=next(o for o in scene.objects if o.type=='ARMATURE')
    body=max((o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)),key=lambda o:len(o.data.vertices))
    # Work in bind pose so new wardrobe takes the same skin weights as the body.
    rig.data.pose_position='REST'; bpy.context.view_layer.update()
    tree=kdtree.KDTree(len(body.data.vertices))
    for v in body.data.vertices: tree.insert(body.matrix_world@v.co,v.index)
    tree.balance()
    def garment(label, verts, faces, mat):
        data=bpy.data.meshes.new(label);data.from_pydata(verts,[],faces);data.update()
        o=bpy.data.objects.new(label,data);scene.collection.objects.link(o);o.data.materials.append(mat)
        groups={g.index:o.vertex_groups.new(name=g.name) for g in body.vertex_groups}
        for v in data.vertices:
            _,idx,_=tree.find(v.co)
            for g in body.data.vertices[idx].groups:
                if g.weight:groups[g.group].add([v.index],g.weight,'REPLACE')
        if label == 'Crimson mantle':
            o.vertex_groups.clear()
            g=o.vertex_groups.new(name='chest')
            g.add(list(range(len(data.vertices))),1,'REPLACE')
        mod=o.modifiers.new('Existing skeleton','ARMATURE');mod.object=rig
        for p in data.polygons:p.use_smooth=True
        # Cylindrical UVs give woven normals a consistent density.
        uv=data.uv_layers.new(name='UVMap')
        for p in data.polygons:
            for li in p.loop_indices:
                co=data.vertices[data.loops[li].vertex_index].co
                uv.data[li].uv=(math.atan2(co.y,co.x)/math.tau+.5,co.z)
        return o
    if name=='knight':
        for m in body.data.materials:
            bs=m.node_tree.nodes.get('Principled BSDF')
            bs.inputs['Roughness'].default_value=.65
            bs.inputs['Metallic'].default_value=.88
        cloth=material('Mundrack crimson mantle',(.19,.013,.023),0,.92)
        use_normal(cloth,normal_texture('Mantle weave'),.35)
        verts=[];faces=[];cols=20;rows=16
        for j in range(rows+1):
            t=j/rows
            for i in range(cols+1):
                u=i/cols*2-1
                verts.append((u*(.34+.14*t),.20+.12*t+.035*math.cos(u*math.pi*6),1.94-1.28*t+.04*math.cos(u*math.pi*5)*t**6))
        for j in range(rows):
            for i in range(cols):
                a=j*(cols+1)+i;faces.append((a,a+1,a+cols+2,a+cols+1))
        garment('Crimson mantle',verts,faces,cloth)
    elif name=='zombie':
        cloth=material('Graveguard weathered tabard',(.105,.082,.049),0,.96)
        use_normal(cloth,normal_texture('Rough grave cloth'),.22)
        verts=[];faces=[];segments=48
        # Body faces along X in this source's bind pose; width lies along Y.
        rings=[(.77,.255,.35),(1.05,.24,.30),(1.28,.205,.275),(1.50,.23,.32),(1.72,.235,.34),(1.86,.16,.22)]
        for r,(z,depth,width) in enumerate(rings):
            for i in range(segments):
                a=i/segments*math.tau
                rag=(.07*math.sin(i*2.7)+.03*math.sin(i*5.3)) if r==0 else 0
                verts.append((.007+math.cos(a)*(depth+.009*math.cos(i*1.7)),math.sin(a)*width,z+rag))
        for r in range(len(rings)-1):
            for i in range(segments):
                a=r*segments+i;b=r*segments+(i+1)%segments
                faces.append((a,b,b+segments,a+segments))
        tabard=garment('Tattered medieval tabard',verts,faces,cloth)
        colors=tabard.data.color_attributes.new(name='Weathering',type='FLOAT_COLOR',domain='POINT')
        for v,c in zip(tabard.data.vertices,colors.data):
            dirt=.25+.5*max(0,min(1,(v.co.z-.75)/.8))
            mottle=.8+.2*math.sin(v.co.x*33+v.co.z*29)*math.sin(v.co.y*41)
            c.color=(dirt*mottle*.12,dirt*mottle*.09,dirt*mottle*.055,1)
        vertex=cloth.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Weathering'
        cloth.node_tree.links.new(vertex.outputs['Color'],cloth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        leather=material('Graveguard leather belt',(.035,.019,.011),0,.87)
        beltverts=[];beltfaces=[]
        for z in [1.27,1.35]:
            for i in range(segments):
                a=i/segments*math.tau;beltverts.append((.007+math.cos(a)*.217,math.sin(a)*.293,z))
        for i in range(segments):beltfaces.append((i,(i+1)%segments,(i+1)%segments+segments,i+segments))
        garment('Weathered belt',beltverts,beltfaces,leather)
    else:
        # Extra subdivision refines silhouette; tangent detail adds scales without
        # millions of triangles or altering the existing flight clip.
        bpy.context.view_layer.objects.active=body
        mod=body.modifiers.new('Refined dragon silhouette','SUBSURF');mod.levels=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        scale_map=normal_texture('Obsidian scale normal',True)
        for m in body.data.materials:
            use_normal(m,scale_map,.28)
            bs=m.node_tree.nodes.get('Principled BSDF')
            bs.inputs['Roughness'].default_value=.62
            bs.inputs['Metallic'].default_value=.08
        membrane=body.data.materials[0].copy();membrane.name='Dragon burgundy wing membrane'
        nodes=membrane.node_tree.nodes;links=membrane.node_tree.links;bs=nodes.get('Principled BSDF')
        for link in list(bs.inputs['Normal'].links):links.remove(link)
        bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.8
        original=bs.inputs['Base Color'].links[0].from_socket
        tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1
        tint.inputs[2].default_value=(.5,.09,.06,1);links.new(original,tint.inputs[1]);links.new(tint.outputs[0],bs.inputs['Base Color'])
        body.data.materials.append(membrane)
        wing_groups={g.index for g in body.vertex_groups if 'wing' in g.name.lower()}
        for polygon in body.data.polygons:
            weight=sum(sum(g.weight for g in body.data.vertices[vi].groups if g.group in wing_groups) for vi in polygon.vertices)/len(polygon.vertices)
            if weight>.65:polygon.material_index=len(body.data.materials)-1
    rig.data.pose_position='POSE'
    # Export mesh and skeleton only. Imported helper cameras/lights stay out.
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type in ['ARMATURE','EMPTY'] or (o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(destination,name+'.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_image_format='AUTO')
    # Inspection render of the actual exported asset, not generated concept art.
    if name == 'dragon':
        rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='fly')
        for track in rig.animation_data.nla_tracks:track.mute=True
    scene.frame_set(12 if name=='dragon' else 0)
    scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.09,.11,.15,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.5
    target=Vector((0,0,1.2 if name!='dragon' else .1))
    camloc=(3,-5,2.7) if name!='dragon' else (1.6,-2,1.2)
    bpy.ops.object.camera_add(location=camloc);cam=bpy.context.object
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.3 if name!='dragon' else 2.2;scene.camera=cam
    for loc,power,color in [((2,-4,5),500,(1,.8,.6)),((-3,-1,3),250,(.55,.7,1)),((0,3,4),700,(1,.45,.2))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.size=3;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    scene.view_settings.view_transform='AgX'
    scene.render.filepath=os.path.join(previews,name+'-refined.png');bpy.ops.render.render(write_still=True)
