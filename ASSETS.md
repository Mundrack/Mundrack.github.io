# Arte original de Mundrack

Generado con la herramienta integrada ImageGen. No se usaron recursos de Warcraft.

Los PNG originales se conservan localmente en `assets/sources/` (ignorados por Git) y en la carpeta de imágenes generadas de Codex. Las versiones WebP que usa el sitio están en `assets/` y preservan la transparencia. El fondo antiguo permanece sin cambios como referencia.

Estas ilustraciones se usan en la portada y las tarjetas. La batalla usa los modelos glTF descritos abajo. Three.js 0.186.1 y sus utilidades GLTFLoader, SkeletonUtils, BufferGeometryUtils y RoomEnvironment se incluyen en `js/vendor`, bajo la licencia MIT adjunta. Sus imports se adaptaron a rutas locales.

## Modelos animados (CC-BY 3.0)

Licencia: https://creativecommons.org/licenses/by/3.0/

- `assets/models/knight.glb`: **Knight**, por **piacenti**, https://opengameart.org/content/knight-2 . Fuente: https://opengameart.org/sites/default/files/armored%20knight.zip . Cambios: materiales PBR reconstruidos desde imágenes empaquetadas, centrado/escala, rig de 15 huesos, pesos, animaciones propias idle/run/attack/guard/death y conversión GLB con texturas JPEG. No es captura de movimiento.
- `assets/models/zombie.glb`: **Zombie**, por **Pixelhouse**, https://opengameart.org/content/zombie ; autor: http://www.pixelhouse.com.ar . Fuente: https://opengameart.org/sites/default/files/zombie.zip . Cambios: conversión de FBX 6.1 con ufbx 0.0.5, conservación de geometría/texturas/pesos y muestreo de animaciones a 30 fps, normalización, movimiento sobre el sitio y exportación GLB. Animaciones originales walk/fury/dead, denominadas walk/attack/death.

Atribución visible para visitantes en `credits.html`, enlazada desde el pie. No se usaron recursos ni animaciones de Mixamo. Archivos fuente, herramientas y scripts de conversión preservados en la carpeta local `work/character-assets` del chat de Codex; los GLB publicados son autocontenidos. Conversión con Blender 4.5.9 LTS portable y Python 3.13; la aplicación web no requiere estas herramientas.


## Dragón y terreno (CC0)

### Dragón · 7 de octubre de 2026

`scripts/refine-dragon.py` parte del GLB de `c8247ab` y produce el nuevo GLB más un render de inspección usando Blender 4.5. La textura original de 472 × 420 se conserva como una capa de color dentro del nuevo material: los detalles adicionales son escamas y variaciones de rugosidad procedurales, no detalle recuperado de una imagen de alta resolución. Albedo de piel y membranas, normales y rugosidad se exportan a 2048 × 2048. El archivo final pesa aproximadamente 7,45 MB (antes 4,52 MB), con la misma geometría y atribución CC0.

Se sustituye el aleteo anterior por un ciclo de dos segundos muestreado a 48 fps, con extremos idénticos, hombros y alas desfasados, cuello, cola y patas con movimiento secundario. Se eliminan los clips que no se usan. `js/dragon-flight.js` coordina trayectoria curva, orientación y balanceo con ese periodo; cámara y modelo usan la misma trayectoria. Se mantiene `FlameMouth` para el fuego. El render de Blender inspecciona el material y la pose; no confirma rendimiento ni aspecto final en WebGL.

- `assets/models/dragon.glb`: **Cethiel's Dragon 3D**, por **Cethiel y Drummyfish**, https://opengameart.org/content/cethiels-dragon-3d . Fuente: https://opengameart.org/sites/default/files/dragon_oga.zip . Cambios: textura oscura, reconstrucción de materiales, subdivisión y suavizado de geometría, animación propia de vuelo, pose de alas y emisor de fuego ligado a la mandíbula. Exportación GLB con Blender.
- `assets/textures/ground-*.jpg`: **Brown Mud Rocks 01**, por **Rob Tuytel / Poly Haven**, https://polyhaven.com/a/brown_mud_rocks_01 . Mapas JPEG de 1K: Diffuse, nor_gl y Rough, sin modificaciones. Licencia: https://polyhaven.com/license .

Ambos recursos se ofrecen bajo CC0: https://creativecommons.org/publicdomain/zero/1.0/ . Tras la revisión visual de octubre, los tres GLB y los mapas del terreno y fortaleza suman aproximadamente 16,5 MB, cargados al iniciar la batalla.

## Revisión visual 3D · octubre de 2026

### Vegetación y apoyo · 5 de octubre

`js/vegetation.js` genera geometría original de troncos, ramas, hojas, arbustos y césped; no incorpora recursos de terceros ni nuevas descargas. Las mismas losas definidas en `js/ground.js` se utilizan para dibujar el pavimento y apoyar los personajes.

El caballero mantiene la geometría y materiales atribuidos a piacenti. `scripts/correct-knight-grips.py` corrige los canales de brazos/manos que confundían la espada y el escudo; conserva la duración de los clips del GLB del commit `7be7c15`. Incluye una postura de guardia con el escudo frente al torso. Uso: Blender 4.5, seguido de `-- INPUT.glb OUTPUT.glb`. Ejecutar sobre el original de ese commit, no sobre una salida ya corregida. Los zombis se orientan en ejecución según el eje +X de su modelo; no se reexportan sus animaciones.

- `assets/textures/castle-*.jpg`: **Castle Wall Slates**, por **Rob Tuytel / Poly Haven**, https://polyhaven.com/a/castle_wall_slates . Licencia CC0: https://polyhaven.com/license . Mapas originales Diffuse, nor_gl y Rough de 1K descargados mediante https://api.polyhaven.com/files/castle_wall_slates ; sin modificaciones.
- Caballero: acabado del metal ajustado y capa carmesí con tejido procedural y pesos ligados al pecho. No hay simulación de tela.
- Zombie: tabardo irregular con suciedad en colores de vértices, tejido y cinturón. Se conserva la base de Pixelhouse y su animación; es una adaptación de vestuario, no un modelo nuevo.
- Dragón: un nivel adicional de subdivisión de geometría, mapa normal procedural de escamas, rugosidad ajustada y material independiente de membranas carmesí. Se conserva el diseño estilizado original y las animaciones.
- `js/fortress.js`: arquitectura original por código: arcos con profundidad, rosetón, reja, torres, columnas, pavimento y braseros. Geometría estática agrupada en cinco materiales para reducir llamadas de dibujo.

Las fuentes de las tres adaptaciones conservan sus licencias y atribuciones anteriores. `scripts/refine-models.py` reproduce las modificaciones con Blender 4.5 partiendo de los GLB del commit `7150f0f`; recibe carpetas de origen, salida y vistas de inspección. `scripts/export-scenery.mjs` exporta la geometría del escenario para inspección independiente. Los renders de Blender sirven para inspeccionar geometría y materiales; no sustituyen una prueba de WebGL ni una medición de rendimiento en el navegador.

## background

Archivo: `assets/realm-cinematic.webp`

Use case: stylized-concept. Asset type: wide cinematic dark fantasy website environment background, 1536x1024 or wider landscape. Original high-end dark fantasy matte painting, sweeping ruined gothic fortress perched on jagged cliffs in the RIGHT half, huge distant eclipse moon behind smoke, ash drifting over a desolate battlefield, broken swords and tattered crimson banners, orange embers and small fires at the ground, cold desaturated teal gray fog and black obsidian architecture, subtle warm sunset at horizon. LEFT half dark misty open negative space for real HTML title. Ground visible across bottom third for animated characters. Photorealistic material detail, beautiful cinematic composition, volumetric light, epic scale, painterly realism. Environment ONLY: NO dragon, NO people, NO text, NO logos, NO letters, NO UI, NO borders. Full bleed.

## knight

Archivo: `assets/knight.webp`

Use case: stylized-concept. Asset type: isolated full-body game character for cinematic 2.5D website. One original dark fantasy knight, highly detailed blackened steel plate armor, tarnished brass filigree, closed helmet with narrow eye slit, deep burgundy torn cape, broad shoulder plates, boots. Full body head to feet entirely in frame with generous transparent margin. Three-quarter side view facing RIGHT, ready combat stance, long steel sword held diagonally forward to right, shield on left forearm, grounded anatomically convincing pose. Cinematic realistic game concept art, cold rim light left and warm fire rim light right, no ground plane, no scenery, no text, no other figures. Transparent background.

## zombie

Archivo: `assets/zombie.webp`

Use case: stylized-concept. Asset type: isolated full-body enemy character for cinematic 2.5D website. One original dark fantasy undead warrior in decayed medieval armor with ragged cloth, desiccated gray green skin, gaunt skull-like face with dim amber eyes, hunched threatening posture, broken sword. Non-graphic, no blood or exposed organs. Full body head to feet entirely in frame with generous transparent margin. Three-quarter side view facing LEFT, combat stance matching a knight duel. Extremely detailed cinematic realistic game concept art, warm orange rim lighting left, cold blue gray light right. No scenery, no ground plane, no other figures, no text. Transparent background.

## dragon

Archivo: `assets/dragon.webp`

Use case: stylized-concept. Asset type: isolated dragon cinematic 2.5D website foreground. A single immense original black obsidian dragon, full body including both enormous outstretched bat wings, curved tail, four clawed legs, long serpentine neck, crowned horned head angled downward to LEFT with mouth open and subtle glowing ember throat but NO external fire jet. Three-quarter view flying toward viewer and left, dramatic majestic pose. Charcoal armored scales, aged bronze ridges, dark burgundy translucent wing membranes, warm orange highlights from below, cold moonlight rim. Extremely detailed cinematic photoreal fantasy concept art. All wing tips and tail within frame, generous clear margin. No background, no landscape, no people, no text. True transparent background.

## Catedral del reino (octubre de 2026)

- `assets/cathedral-sanctuary.png`: ilustración original generada para esta web con ImageGen. Fondo de portada; título y controles son HTML independiente. 1672 × 941 píxeles.
- `assets/cathedral-finale.png`: ilustración original reutilizada del repositorio de perfil Mundrack, generada para el mismo proyecto. 2172 × 724 píxeles. Incluye el lema del reino y dispone de texto alternativo en HTML.

Estas ilustraciones son arte de presentación y no representan la calidad actual del motor 3D. No se modificaron los modelos ni sus animaciones en esta actualización.

Prompt de la nueva portada:

> Use case: stylized-concept. Original premium gothic medieval dark fantasy website background, wide landscape 16:9. A glorious cathedral sanctuary of black stone, ornate aged gold tracery, crimson banners, candles, dramatic golden shafts through a huge rose window. RIGHT HALF: an imposing original black and gold armored knight holding a sword downward, distant view down the vast nave, heroic solemn presence. LEFT HALF: quiet very dark shadowed architectural negative space suitable for overlaid real HTML headline, no bright highlights behind text. Intricate carved pillars and pointed arches frame both edges, embers and faint mist, cinematic painterly realism, rich crafted materials with restrained visual noise. Camera at human height, epic scale. No text, no lettering, no logos, no watermark, no UI, no border drawn across the image center. Full bleed artwork.
