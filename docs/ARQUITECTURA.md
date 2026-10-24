# Arquitectura y mantenimiento

## Documento principal

`dist/index.html` define la navegación, la portada, las fotografías iniciales, el contenido de marca, el contacto y el diálogo reutilizado por el catálogo. Los scripts se cargan con `defer` en un orden intencional. `icons.js` aparece primero porque el catálogo y los controles solicitan su función de creación de SVG.

## Módulos JavaScript

| Archivo             | Responsabilidad                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `app.js`            | Datos de siete productos, tarjetas, filtros, detalles, menú móvil, progreso de lectura y transformaciones por scroll.   |
| `contact.js`        | Nueve opciones de pedido, cantidades, validación, vista previa y URL de WhatsApp.                                       |
| `interface.js`      | Horarios en `America/Bogota`, precarga de cursores y estados del puntero.                                               |
| `icons.js`          | Devuelve geometría SVG de un conjunto local de iconos.                                                                  |
| `liquid.js`         | Selección del acento visible, ondas del puntero y renderizadores WebGL o Canvas 2D.                                     |
| `moments.js`        | Control del carrusel y sustitución de sus tarjetas sin perder la pausa voluntaria o la fotografía que sigue disponible. |
| `instagram-feed.js` | Configuración, validación, consulta, precarga de imágenes y entrega de publicaciones autorizadas.                       |
| `motion-preview.js` | Demostración independiente con un contador simulado.                                                                    |

## Capas de estilo

El orden de los enlaces en el HTML forma parte de la composición:

1. `styles.css`: estructura, tipografías de base y componentes generales.
2. `liquid.css`: atmósfera oscura, reflejos y presentación de las botellas.
3. `interface.css`: componentes de interfaz, catálogo y cursores.
4. `contact.css`: botón flotante y diálogo del pedido.
5. `palette.css`: colores de la interfaz, superficies negras y tipografía editorial.
6. `product-colors.css`: halo propio de cada bebida.
7. `icons.css`: dimensiones y trazos del sistema SVG.
8. `refinements.css`: jerarquía del contacto, horarios y pie de página.
9. `moments.css`: portada actual con fotografías apiladas.

Algunas reglas de las primeras capas siguen describiendo composiciones anteriores de la portada. Las capas posteriores definen la composición vigente. Se mantienen para conservar los valores comunes y evitar una eliminación de estilos sin una revisión visual de todos los tamaños de pantalla.

`motion-preview.html` utiliza únicamente las capas que necesita y añade `motion-preview.css` para su escena independiente.

## Coordinación del movimiento

El control general añade `motion-paused` o `motion-enabled` al elemento raíz. Los módulos consultan esas clases y la preferencia `prefers-reduced-motion`. El renderizador líquido detiene los cuadros de animación cuando la pestaña está oculta. El carrusel pausa además por interacción, foco y diálogos abiertos.

El desplazamiento de la página sigue siendo nativo. El parallax modifica transformaciones de elementos concretos y no intercepta la rueda o el gesto vertical.

## Renovación del álbum

El adaptador de Instagram emite `catania:instagram-posts` en `window` después de validar y precargar una colección de imágenes. El controlador del álbum verifica el contrato, evita reconstruir conjuntos idénticos y aplaza una sustitución mientras el usuario interactúa con la galería o con el pedido.

Al aplicar un conjunto nuevo se destruyen los manejadores y temporizadores del controlador anterior, se construyen nodos con APIs del DOM y se crea una nueva instancia. El texto del proveedor se trata como texto, no como HTML.

## Pedido y datos

Las cantidades, el nombre y la nota pertenecen a la interacción actual del navegador. `contact.js` genera el mensaje y su codificación en la URL de WhatsApp. El envío final ocurre en WhatsApp por decisión del visitante.

La integración opcional utiliza caché de sesión para el feed público. No deben guardarse contraseñas, tokens de Meta ni claves privadas en `instagram.json` o en archivos que se sirvan al navegador.

## Criterio de cambios

Los archivos se conservan sin minificar. Añade comentarios cuando una función tenga condiciones, cancelación o decisiones de interacción que no sean evidentes por su nombre. Tras modificar una capa, ejecuta las comprobaciones del repositorio y revisa el resultado en escritorio y móvil.
