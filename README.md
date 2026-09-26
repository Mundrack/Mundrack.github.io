# Mundrack — The Kingdom of Code

Portfolio estático de Mateo Gabriel Puga Montesdeoca. Fantasía oscura, proyectos reales de GitHub y una batalla 3D con caballeros articulados, enemigos y dragón. El repositorio de perfil `Mundrack` es independiente y no forma parte de estos cambios.

## Ejecutar localmente

Requiere Node.js 22. No necesita compilación, cuenta de API ni secretos.

```sh
npm ci
npm run dev
```

Vista previa: http://127.0.0.1:4173. El servidor escucha solamente en esta máquina. Abrir `index.html` directamente con `file://` no es compatible con los módulos y las solicitudes de datos.

## Experiencia

- Portada, escenario original, escudo, niebla y brasas.
- Secuencia de 50 segundos: acercamiento lejano → seguimiento de la tropa desde atrás → choque → primera persona → vista aérea → dragón y fuego → final.
- 16 combatientes con modelos glTF texturizados: caballero de piacenti y zombie de Pixelhouse. Esqueletos independientes, mezcla de animaciones, espada y escudo; brazos de la misma armadura en primera persona.
- Duelo opcional: «Tomar la espada» durante el combate. F ataca; mantener G bloquea. En móvil los botones atacan y alternan el bloqueo. «Volver a la cinemática» devuelve el control automático.
- Los ataques tienen tiempo de preparación, ventana de impacto, alcance, recuperación y daño. Los rivales buscan otro enemigo al terminar un duelo. No se usa colisión por triángulos ni física de cuerpos rígidos.
- La recuperación del ataque conserva su pose al mezclarse con reposo. Los pasos se sincronizan con distancia recorrida, los giros se amortiguan y un ataque iniciado termina antes de perseguir al rival.
- El mapa incorpora relieve fuera del corredor de combate, acantilados en varias profundidades, escombros y hierba seca mediante instancias reutilizadas.
- Etiquetas pequeñas sobre los soldados caídos, proyectadas desde su posición 3D. Se ocultan si quedan fuera del encuadre o se solapan; todos los proyectos siguen disponibles en la galería.
- Cámara seleccionable: cinemática, espaldas, primera persona o aérea. La primera persona requiere un soldado vivo y la fase de combate.
- Pausa, continuación, salto, repetición y sonido sintetizado opcional, apagado inicialmente.
- Preferencia de movimiento reducido del sistema y control manual. Este modo muestra el resultado sin reproducir el combate.
- Pausa automática de la escena fuera de pantalla o en una pestaña oculta.
- Portfolio independiente de la cinemática, búsqueda, filtros, lenguajes y enlaces accesibles.

## Datos de GitHub

`js/data.js` consulta los repositorios públicos de Mundrack, con paginación de 100 resultados, sin token. Excluye forks, el README de perfil y este propio portfolio. `En campaña` significa no archivado; `Reliquias` significa archivado en GitHub. No se infiere abandono por antigüedad.

La aplicación usa una caché local de 15 minutos. Si GitHub falla, usa la última caché o `data/repos.json` e informa el origen y la fecha. Los nuevos proyectos aparecen en la próxima consulta, una vez vencida la caché; no hay actualización mientras la pestaña permanece abierta. La batalla asigna hasta ocho proyectos recientes a sus soldados; la galería muestra todos. La caída es una metáfora visual, no una indicación de que un proyecto esté abandonado.

Actualizar la copia de respaldo antes de publicar:

```sh
npm run data:refresh
```

Descripciones y nombres se insertan como texto. Los enlaces se construyen con el propietario fijo, sin confiar en URLs arbitrarias del almacenamiento.

Referencias: [API de repositorios](https://docs.github.com/en/rest/repos/repos), [paginación](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api), [límites de GitHub](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Estructura

```text
index.html                contenido y navegación
css/realm.css             diseño, adaptación y transiciones
js/app.js                 interfaz y tarjetas
js/data.js                GitHub, caché y respaldo
css/battle.css            controles 3D y etiquetas ancladas
js/scene.js               ciclo de vida, controles, etiquetas y audio
js/combat.js              simulación determinista, daño y director de escenas
js/models.js              geometría auxiliar y rigs de prueba
js/characters.js          carga glTF, esqueletos y animaciones
js/fire.js                partículas de fuego desde la mandíbula
js/environment.js         relieve, acantilados, escombros y vegetación
assets/models/*.glb        personajes con texturas y animaciones
assets/textures/*.jpg      materiales del terreno
credits.html              atribución de los recursos CC-BY 3.0 y CC0
js/battle-world.js        luces, terreno, cámaras, efectos y renderizado
js/vendor/               Three.js 0.186.1 y su licencia MIT
assets/*.webp             ilustraciones optimizadas
assets/crest.svg          emblema original
data/repos.json           copia pública de respaldo
tests/                    pruebas de datos, DOM y navegador
```

## Arte y límites de esta versión

Los cuatro recursos se generaron con ImageGen. Los prompts y las ubicaciones están en `ASSETS.md`. Los WebP suman aproximadamente 1,3 MB y conservan transparencia. Los PNG originales están preservados localmente en `assets/sources/`, excluidos de Git; también permanecen en la carpeta de imágenes generadas de Codex. `npm run assets:optimize` necesita esos originales.

La batalla usa **personajes 3D texturizados con esqueletos**, publicados bajo CC-BY 3.0. Se reconstruyeron los materiales del caballero y se añadieron cinco animaciones propias (reposo, carrera, ataque, bloqueo y caída). El zombie conserva las animaciones de caminar, furia y muerte de Pixelhouse, convertidas desde FBX 6.1. Las licencias, modificaciones y fuentes están en `ASSETS.md` y en la página pública de créditos. Los dos GLB suman aproximadamente 6,6 MB y se cargan al iniciar la batalla.

El dragón usa el modelo texturizado CC0 de Cethiel y Drummyfish, con una animación de vuelo propia y fuego que sale de un punto ligado a la mandíbula. La cámara le dedica el plano final. El terreno usa mapas de color, normales y rugosidad de Brown Mud Rocks 01 (Rob Tuytel / Poly Haven, CC0). Los tres modelos y los mapas del terreno suman unos 10,4 MB.

Este paso mejora los personajes, pero no alcanza calidad de película: la animación del caballero es artesanal, el zombie tiene ropa contemporánea y el dragón es estilizado. Falta revisión visual en el navegador y pulir la coreografía. Los golpes usan partículas discretas; el sonido sigue siendo sintetizado. No se utilizó Mixamo.

Three.js se carga únicamente al iniciar la batalla y está incluido localmente, con licencia MIT. WebGL 2 es necesario para la escena; si no está disponible, se muestra un mensaje y el portfolio permanece accesible. El movimiento reducido evita cargar el motor. La simulación avanza en pasos fijos de 1/60 s y se pausa fuera de pantalla. Los modelos se reutilizan al repetir la batalla.

El fondo anterior `assets/realm-background.png` permanece como referencia; ya no se usa como fondo porque contiene interfaz dibujada. Google Fonts es opcional: hay fuentes de respaldo si falla la conexión.

## Validación

```sh
npm test
npm run test:browser
```

La primera orden prueba datos, combate, controles y proyecciones; también carga la geometría y las animaciones reales de los GLB para comprobar escala, independencia de esqueletos, alcance, repetición y brazos en primera persona. Estas pruebas omiten decodificación de texturas y sustituyen el renderizador GPU. La segunda requiere Chromium de Playwright (`npx playwright install chromium`) y acceso autorizado a la vista previa. Cubre escritorio/móvil, búsqueda, pausa, final, repetición, movimiento reducido y fallo de GitHub. Las pruebas CPU/DOM no sustituyen la revisión visual, la compilación de shaders ni una medición de rendimiento. La ejecución en navegador sigue pendiente por el permiso guardado que bloqueó la vista previa en Codex.

## Publicación

Compatible con hosting estático en GitHub Pages, con rutas relativas y el motor incluido en `js/vendor`. Debe publicarse el contenido de la raíz (HTML, CSS, JS, assets y data). No subir `node_modules`, resultados de pruebas ni `assets/sources`.

GitHub Pages publica desde `main`, en la raíz. La versión actual es un prototipo público en evolución; la revisión visual automatizada y de rendimiento sigue pendiente. El propietario autorizó publicar el avance. La próxima etapa es una cinemática medieval prerenderizada y un tráiler para el README del perfil; esos videos todavía no están incluidos.
