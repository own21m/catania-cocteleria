# Catania · Coctelería artesanal

Sitio web de una sola página para presentar las bebidas artesanales de Catania y convertir la exploración del catálogo en un pedido para WhatsApp. La experiencia combina una estética oscura, colores asociados a cada bebida, fotografías apiladas, parallax y reflejos que simulan luz atravesando un líquido.

[Ver el sitio publicado](https://catania-bebidas-artesanales-juann.a22733321.chatgpt.site/)

![Portada de Catania con fotografías apiladas](portada.jpg)

## Funciones principales

- Portada con cinco fotografías apiladas, rotación automática y navegación mediante botones, teclado y deslizamiento horizontal.
- Siete escenas de producto con parallax y un color de acento propio: sangría de frutos rojos, margarita, mojito, daiquirí de fresa y sodas de maracuyá, frutos rojos y mango biche.
- Catálogo de nueve bebidas, con filtros por categoría. Incluye también cóctel de lychee y sangría sin alcohol.
- Diálogo de producto con descripción, presentación disponible y galería de fotografías.
- Botón fijo de contacto, centrado en la parte inferior, con burbujas y contador de bebidas seleccionadas.
- Selector de cantidades entre 0 y 99, nombre y nota opcionales, vista previa del mensaje y apertura de WhatsApp con el pedido preparado.
- Horarios destacados y estado de apertura calculado en la zona `America/Bogota`.
- Tres cursores ilustrados para explorar, señalar elementos interactivos y acompañar el clic o el scroll.
- Menú móvil, navegación por teclado, iconos SVG y respeto por la preferencia de movimiento reducido.
- Vista auxiliar en `motion-preview.html` para observar los cursores y el botón de contacto.

## Tecnologías

| Tecnología   | Aplicación en el proyecto                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| HTML5        | Estructura semántica, enlaces, formularios y diálogos nativos.                                                              |
| CSS          | Grid, Flexbox, variables, máscaras, gradientes, transformaciones, animaciones y adaptación a distintos tamaños de pantalla. |
| JavaScript   | Catálogo, filtros, navegación, cantidades, validación, carrusel, horarios y coordinación de la experiencia visual.          |
| WebGL y GLSL | Reflejos, ondas y luz ambiental a través de un shader sobre un lienzo de pantalla completa.                                 |
| Canvas 2D    | Alternativa visual cuando el navegador no puede utilizar WebGL.                                                             |
| SVG          | Iconos vectoriales definidos en el proyecto, sin depender de la representación de caracteres del sistema.                   |
| WebP y PNG   | Fotografías optimizadas, recortes de productos y sprites de cursor con transparencia.                                       |
| Google Fonts | Cormorant Garamond, Manrope y Outfit, con fuentes de respaldo del sistema.                                                  |
| Behold JSON  | Integración opcional para recibir publicaciones autorizadas de Instagram.                                                   |
| Node.js      | Servidor local, comprobaciones de archivos y pruebas con herramientas nativas.                                              |
| Prettier     | Formato consistente del código durante el desarrollo.                                                                       |

El navegador recibe los archivos fuente legibles. No hay un proceso de empaquetado o minificación. El sitio se puede servir como contenido estático; las herramientas de Node.js son auxiliares para trabajar en el repositorio.

## Ejecutar en local

Requisitos: Node.js 20 o superior. Para instalar la herramienta de formato y ejecutar las pruebas, utiliza pnpm.

```bash
git clone https://github.com/own21m/catania-cocteleria.git
cd catania-cocteleria
node scripts/serve.mjs
```

Abre `http://127.0.0.1:4173`. Puedes elegir otro puerto:

```bash
node scripts/serve.mjs --port 8080
```

También puedes servir directamente `dist/` con otro servidor estático. Conviene usar HTTP local para que la configuración de Instagram pueda leerse mediante `fetch`.

## Estructura

```text
catania-cocteleria/
|-- dist/
|   |-- assets/                 Fotografías, sprites e identidad vectorial
|   |-- index.html              Página principal
|   |-- app.js                  Productos, catálogo, filtros, diálogos y parallax
|   |-- contact.js              Selector de bebidas y mensaje para WhatsApp
|   |-- interface.js            Horarios y estados del cursor
|   |-- icons.js                Vocabulario de iconos SVG
|   |-- liquid.js               Atmósfera WebGL y alternativa Canvas 2D
|   |-- moments.js              Carrusel de fotografías y renovación segura
|   |-- instagram-feed.js       Lectura y validación del feed externo
|   |-- instagram.json          Configuración pública de la integración
|   |-- *.css                   Estilos comentados por componente y capa
|   |-- motion-preview.html     Demostración aislada de movimiento
|   |-- motion-preview.css      Estilos de la demostración
|   `-- motion-preview.js       Recorrido y controles de la demostración
|-- docs/
|   |-- ARQUITECTURA.md          Flujo de los módulos y mantenimiento
|   `-- INSTAGRAM.md             Requisitos y pasos para autorizar el feed
|-- scripts/
|   |-- serve.mjs               Servidor local sin transformar los archivos
|   `-- check.mjs               Comprobaciones de sintaxis y recursos
|-- tests/                      Pruebas del pedido y los horarios
|-- source-assets/              Recursos gráficos de origen
|-- portada.jpg                 Vista previa del proyecto
|-- package.json                Comandos y dependencia de desarrollo
`-- pnpm-lock.yaml              Versión resuelta de la herramienta de formato
```

## Cómo se organiza la experiencia

`index.html` contiene la estructura editorial y las cinco fotografías de respaldo. `app.js` construye las escenas y el catálogo a partir de datos de producto. `contact.js` mantiene las cantidades y compone el mensaje utilizando el texto que introduce el visitante.

`liquid.js` adapta su color al producto visible y reacciona al puntero. Usa un único ciclo de renderizado, limita la resolución en dispositivos pequeños y deja de dibujar cuando corresponde pausar. `moments.js` coordina la rotación de fotografías, las entradas manuales y las renovaciones del feed sin sustituir la pila durante una interacción o un diálogo abierto.

Las hojas de estilo se cargan en un orden explícito: base, atmósfera, interfaz, contacto, paleta, colores de producto, iconos, ajustes de contacto y álbum de fotografías. Los comentarios indican la responsabilidad de cada bloque. Consulta [la arquitectura](docs/ARQUITECTURA.md) para modificar un componente sin alterar otra capa.

## Personalización

| Cambio                                                   | Archivo o ubicación                                   |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Nombres, categorías, descripciones y acentos de producto | Arreglo `products` de `dist/app.js`.                  |
| Bebidas, presentaciones y número de WhatsApp del pedido  | `dist/contact.js`.                                    |
| Horarios y cálculo del estado de apertura                | `dist/index.html` y `dist/interface.js`.              |
| Texto editorial y enlaces sociales                       | `dist/index.html`.                                    |
| Fotografías de respaldo de la portada                    | Figuras `.moment-card` en `dist/index.html`.          |
| Intensidad y comportamiento de la luz líquida            | `dist/liquid.js` y `dist/liquid.css`.                 |
| Apariencia de la pila y controles de fotografías         | `dist/moments.css`.                                   |
| Colores de cada escena                                   | Acentos de `dist/app.js` y `dist/product-colors.css`. |

Si cambias un producto, actualiza también su entrada en el selector de pedido para mantener nombres y presentaciones consistentes. Las fotografías deben conservar un texto alternativo útil y sus dimensiones. El número comercial configurado es `+57 320 665 6100` y la cuenta social es `@cataniacocteleria`.

## Instagram: estado de la integración

El adaptador está implementado y probado con datos controlados. **La sincronización real está pendiente de autorización de la cuenta.** Actualmente `feedUrl` está vacío en `dist/instagram.json`, por lo que la portada utiliza las cinco fotografías incluidas en el proyecto.

Para activarla, la persona que administra la cuenta debe autorizar una conexión en Behold y proporcionar su URL pública de feed JSON. El adaptador comprueba la cuenta, valida las direcciones de imágenes y publicaciones, ordena por fecha y selecciona hasta cinco entradas. Los vídeos se representan mediante su imagen de previsualización. Ante una respuesta inválida o un fallo de carga se mantienen las fotografías disponibles.

La frecuencia de publicación de datos y los límites de uso dependen del proveedor; el intervalo de revisión del navegador no acelera su sincronización. Consulta [la guía de conexión](docs/INSTAGRAM.md) y [la documentación de Behold](https://behold.so/docs/json-feeds/).

## Comprobaciones y formato

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run format:check
```

Para aplicar el formato:

```bash
pnpm run format
```

Las comprobaciones revisan sintaxis, referencias locales y configuración. Las pruebas cubren la composición del mensaje, las cantidades seleccionadas y los límites de apertura de los horarios en Colombia. La revisión visual debe incluir escritorio, móvil, navegación por teclado y la opción de pausar las animaciones.

## Publicación

Publica el contenido completo de `dist/` en un alojamiento estático compatible con HTTPS, manteniendo la estructura de archivos. `index.html` es la entrada principal. No se necesita compilar el sitio ni instalar dependencias de producción.

## Alcance y contenido

El pedido abre WhatsApp con un mensaje preparado; el visitante decide cuándo enviarlo. La tienda confirma disponibilidad, presentación y valor. No hay cobro, envío automático del mensaje, inventario conectado, reserva ni base de datos de clientes.

Las fotografías, logotipos y marcas se incluyen como material del proyecto; su reutilización requiere autorización de sus titulares. No se incluye una licencia abierta para esos recursos.

## Herramientas de apoyo

La IA se utilizó como herramienta de aceleración de procesos durante el desarrollo, la documentación y la revisión del proyecto.
