/**
 * Catálogo, navegación y presentación de productos de Catania.
 * Este módulo genera las escenas y tarjetas, coordina el movimiento de la página
 * y reutiliza un único diálogo para consultar las fotografías de cada bebida.
 */
'use strict';
// El generador de SVG se carga antes de este archivo mediante scripts con defer.
const icon = window.CataniaIcon;
/**
 * Fichas de las siete bebidas con fotografías disponibles.
 * Los id son estables: conectan escenas, tarjetas y productos del pedido.
 * gallery contiene identificadores de fotos originales; cutout se añade después.
 * Un volumen vacío significa que no está confirmado y no debe mostrarse.
 */
const products = [
  {
    id: 'sangria',
    category: 'sangria',
    categoryLabel: 'Sangría artesanal',
    name: 'Sangría de frutos rojos',
    short: 'Sangría',
    flavor: 'frutos rojos',
    word: 'Sangría',
    volume: '1000 ml',
    alcohol: true,
    image: '6928',
    card: '6930',
    gallery: ['6928', '6930', '6929'],
    bg: '#eee5d5',
    ink: '#5b2830',
    blend: 'soft-blend',
    tags: ['Frutal', 'Para compartir'],
    description:
      'Nuestra mezcla de fresas, manzana, uvas e infusión de frutos rojos. Una sangría artesanal perfecta para compartir y alargar la sobremesa.',
    mini: 'El sabor de una buena sobremesa.',
    note: 'EL PRIMER BRINDIS, SIEMPRE JUNTOS.',
  },
  {
    id: 'margarita',
    category: 'coctel',
    categoryLabel: 'Cóctel artesanal',
    name: 'Margarita',
    short: 'Margarita',
    flavor: 'puro carácter',
    word: 'Margarita',
    volume: '',
    alcohol: true,
    image: '6944',
    card: '6945',
    gallery: ['6944', '6945', '6946'],
    bg: '#050606',
    ink: '#e9e8bd',
    blend: 'dark-blend',
    tags: ['Cítrica', 'Con tequila'],
    description:
      'Tequila, triple sec y limón. Un clásico con personalidad, de esos que convierten un encuentro cualquiera en un buen recuerdo.',
    mini: 'Un clásico. Mil buenos planes.',
    note: 'UN TOQUE CÍTRICO. TODA LA ACTITUD.',
  },
  {
    id: 'mojito',
    category: 'coctel',
    categoryLabel: 'Cóctel artesanal',
    name: 'Mojito',
    short: 'Mojito',
    flavor: 'aire fresco',
    word: 'Mojito',
    volume: '750 ml',
    alcohol: true,
    image: '6938',
    card: '6939',
    gallery: ['6938', '6939', '6937'],
    bg: '#050706',
    ink: '#d6e6b0',
    blend: 'dark-blend',
    tags: ['Limón', 'Hierbabuena'],
    description:
      'Limón, hierbabuena, ron blanco y soda. Frescura que invita a bajar el ritmo y dejar que la conversación siga.',
    mini: 'Una pausa que sabe a frescura.',
    note: 'QUE EL MOMENTO DURE UN POCO MÁS.',
  },
  {
    id: 'daiquiri',
    category: 'coctel',
    categoryLabel: 'Cóctel artesanal',
    name: 'Daiquirí de fresa',
    short: 'Daiquirí',
    flavor: 'de fresa',
    word: 'Daiquirí',
    volume: '750 ml',
    alcohol: true,
    image: '6936',
    card: '6936',
    gallery: ['6936'],
    bg: '#e6c7b5',
    ink: '#743128',
    blend: 'gold-blend',
    tags: ['Fresa', 'Frutal'],
    description:
      'La fresa pone el color; tú pones el plan. Un cóctel de espíritu alegre para acompañar tus ganas de celebrar.',
    mini: 'El lado más alegre del brindis.',
    note: 'MÁS COLOR EN TU PRÓXIMO PLAN.',
  },
  {
    id: 'maracuya',
    category: 'soda',
    categoryLabel: 'Soda sin alcohol',
    name: 'Soda de maracuyá',
    short: 'Maracuyá',
    flavor: 'con burbujas',
    word: 'Tropical',
    volume: '400 ml',
    alcohol: false,
    image: '6940',
    card: '6940',
    gallery: ['6940', '6943'],
    bg: '#e6bf56',
    ink: '#44391b',
    blend: 'gold-blend',
    tags: ['Sin alcohol', 'Tropical'],
    description:
      'Un sabor tropical con espíritu de verano. La maracuyá y las burbujas se encuentran en una soda para disfrutar a tu manera.',
    mini: 'Un pequeño escape tropical.',
    note: 'TODO EL PLAN. SIN ALCOHOL.',
  },
  {
    id: 'soda-rojos',
    category: 'soda',
    categoryLabel: 'Soda sin alcohol',
    name: 'Soda de frutos rojos',
    short: 'Frutos rojos',
    flavor: 'en otra versión',
    word: 'Frutal',
    volume: '400 ml',
    alcohol: false,
    image: '6941',
    card: '6941',
    gallery: ['6941', '6943'],
    bg: '#ebcda1',
    ink: '#783c32',
    blend: 'gold-blend',
    tags: ['Sin alcohol', 'Frutal'],
    description:
      'El color de los frutos rojos y la alegría de las burbujas. Una versión sin alcohol que también merece su propio brindis.',
    mini: 'Las burbujas también celebran.',
    note: 'UN BRINDIS A TU MANERA.',
  },
  {
    id: 'mango',
    category: 'soda',
    categoryLabel: 'Soda sin alcohol',
    name: 'Soda de mango biche',
    short: 'Mango biche',
    flavor: 'sin reglas',
    word: 'Vibrante',
    volume: '400 ml',
    alcohol: false,
    image: '6942',
    card: '6942',
    gallery: ['6942'],
    bg: '#b9c75a',
    ink: '#2e481c',
    blend: 'gold-blend',
    tags: ['Sin alcohol', 'Mango biche'],
    description:
      'Un sabor que se sale de la rutina. Mango biche, burbujas y esa chispa que convierte cualquier pausa en tu parte favorita del día.',
    mini: 'Para los planes con un giro.',
    note: 'LO INESPERADO TAMBIÉN SABE BIEN.',
  },
];
// Estas dos listas conservan el mismo orden de products para asociar color y recorte.
const accents = ['#ff4777', '#efdf8c', '#b5e870', '#ff6179', '#ffd22d', '#ff5279', '#afe455'];
const cutoutIds = ['6928', '6945', '6939', '6936', '6940', '6941', '6942'];
products.forEach((p, i) => {
  p.accent = accents[i];
  p.cutout = `assets/cutout-${cutoutIds[i]}.webp`;
  p.bg = '#090b0d';
  p.ink = '#f3f1e9';
});
/** Devuelve la ruta de una fotografía original, distinta del recorte transparente. */
const asset = (id) => `assets/product-${id}.webp`;
/** Muestra una etiqueta de presentación solo cuando el volumen está confirmado. */
function volumeBadge(product) {
  return product.volume ? /* HTML */ `<span>${product.volume}</span>` : '';
}
const journey = document.querySelector('#product-journey');
const grid = document.querySelector('#product-grid');
// Cada escena comparte la ficha del producto y entrega su acento a las capas visuales.
// Las plantillas usan exclusivamente datos del catálogo definido en este archivo.
journey.innerHTML = products
  .map(
    (p, i) =>
      /* HTML */ `<section
        class="product-scene"
        id="${p.id}"
        data-accent="${p.accent}"
        style="--accent:${p.accent}"
        aria-labelledby="title-${p.id}"
      >
        <div class="scene-sticky">
          <span class="scene-bg-word" aria-hidden="true">${p.word}</span
          ><span class="scene-glass-ring" aria-hidden="true"></span>
          <div class="scene-copy">
            <p class="eyebrow">${String(i + 1).padStart(2, '0')} / 07 — ${p.categoryLabel}</p>
            <h2 id="title-${p.id}">${p.short}<br /><em>${p.flavor}</em></h2>
            <p class="scene-description">${p.description}</p>
            <div class="scene-tags">
              ${p.tags.map((t) => /* HTML */ `<span>${t}</span>`).join('')}${volumeBadge(p)}
            </div>
            <button class="scene-link" data-product="${p.id}">
              Conoce este sabor <span>${icon('arrow-up-right')}</span>
            </button>
          </div>
          <div class="scene-photo">
            <img
              src="${p.cutout}"
              alt="${p.name} Catania"
              width="800"
              height="1400"
              loading="lazy"
            />
          </div>
          <span class="scene-side">CATANIA · COCTELERÍA ARTESANAL</span
          ><span class="scene-asterisk" aria-hidden="true">${icon('flower')}</span>
          <div class="scene-index">
            <span>${String(i + 1).padStart(2, '0')} <span aria-hidden="true">/ 07</span></span
            ><span class="scene-line"></span><span>${p.note}</span>
          </div>
        </div>
      </section>`,
  )
  .join('');
// Las tarjetas ofrecen el acceso compacto al mismo detalle mostrado en las escenas.
grid.innerHTML = products
  .map(
    (p, i) =>
      /* HTML */ `<article
        class="product-card reveal"
        data-category="${p.category}"
        style="--accent:${p.accent};animation-delay:${(i % 4) * 0.07}s"
      >
        <button
          class="card-image-button"
          data-product="${p.id}"
          aria-label="Ver detalles de ${p.name}"
        >
          <span class="card-badge">${p.alcohol ? 'ARTESANAL' : 'SIN ALCOHOL'}</span
          ><img
            src="${p.cutout}"
            alt="${p.name} Catania${p.volume ? `, botella de ${p.volume}` : ''}"
            width="800"
            height="1400"
            loading="lazy"
          /><span class="card-plus" aria-hidden="true">${icon('arrow-up-right')}</span>
        </button>
        <div class="card-meta">
          <h3>
            ${p.id === 'sangria' ? 'Sangría de frutos rojos' : p.name.replace('Soda de ', '')}
          </h3>
          ${volumeBadge(p)}
        </div>
        <p class="card-category">${p.categoryLabel}</p>
      </article>`,
  )
  .join('');
// contact.js escucha data-order-product para abrir el pedido con esta bebida elegida.
grid.querySelectorAll('.product-card').forEach((card, i) => {
  card.querySelector('.card-plus').innerHTML = icon('arrow-up-right');
  const button = document.createElement('button');
  button.className = 'card-order';
  button.dataset.orderProduct = products[i].id;
  button.setAttribute('aria-label', `Elegir ${products[i].name} para mi pedido`);
  button.innerHTML = /* HTML */ `Elegir <span aria-hidden="true">${icon('plus')}</span>`;
  card.append(button);
});
// Las opciones sin fotografía se representan con composiciones tipográficas.
// Se conservan sus id de pedido y se invita a consultar la presentación disponible.
grid.insertAdjacentHTML(
  'beforeend',
  /* HTML */ `<article
      class="product-card extra-product reveal"
      data-category="coctel"
      style="--accent:#d4b2ff"
    >
      <button
        class="extra-product-art"
        data-order-product="lychee"
        aria-label="Elegir Cóctel de lychee para mi pedido"
      >
        <span class="card-badge">CÓCTEL ARTESANAL</span
        ><span class="extra-orbit" aria-hidden="true"></span
        ><span class="extra-flower" aria-hidden="true">${icon('flower')}</span
        ><span class="extra-word">Lychee<em>otro giro.</em></span
        ><span class="extra-cta">Elige algo diferente ${icon('arrow-up-right')}</span>
      </button>
      <div class="card-meta"><h3>Cóctel de lychee</h3></div>
      <p class="card-category">Cóctel artesanal · Consulta presentación</p>
      <button
        class="card-order"
        data-order-product="lychee"
        aria-label="Elegir Cóctel de lychee para mi pedido"
      >
        Elegir <span aria-hidden="true">${icon('plus')}</span>
      </button>
    </article>
    <article
      class="product-card extra-product reveal"
      data-category="sangria soda"
      style="--accent:#c596ff"
    >
      <button
        class="extra-product-art"
        data-order-product="sangria-sin-alcohol"
        aria-label="Elegir Sangría sin alcohol para mi pedido"
      >
        <span class="card-badge">SIN ALCOHOL</span
        ><span class="extra-orbit" aria-hidden="true"></span
        ><span class="extra-flower" aria-hidden="true">${icon('flower')}</span
        ><span class="extra-word">Sangría<em>a tu manera.</em></span
        ><span class="extra-cta">Todo el momento ${icon('arrow-up-right')}</span>
      </button>
      <div class="card-meta"><h3>Sangría sin alcohol</h3></div>
      <p class="card-category">Sin alcohol · Consulta presentación</p>
      <button
        class="card-order"
        data-order-product="sangria-sin-alcohol"
        aria-label="Elegir Sangría sin alcohol para mi pedido"
      >
        Elegir <span aria-hidden="true">${icon('plus')}</span>
      </button>
    </article>`,
);

// La clase js solo se activa si existen observadores de intersección.
// Así, el contenido sigue visible cuando el navegador no admite las revelaciones.
if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('js');
  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          reveal.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -20px 0px' },
  );
  document.querySelectorAll('.reveal').forEach((el) => reveal.observe(el));
  // Las escenas pueden entrar y salir de la vista; las revelaciones anteriores solo ocurren una vez.
  const scenes = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle('in-view', e.isIntersecting)),
    { threshold: 0.1 },
  );
  document.querySelectorAll('.product-scene').forEach((el) => scenes.observe(el));
}

// Estas clases globales también las consultan el fondo líquido y la galería de momentos.
// La preferencia del sistema fija el estado inicial; el botón permite cambiarlo.
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = motionQuery.matches;
const motionToggle = document.querySelector('.motion-toggle');
/** Sincroniza el estado visual global, el icono y las etiquetas accesibles del control. */
function updateMotion() {
  document.documentElement.classList.toggle('motion-paused', motionPaused);
  document.documentElement.classList.toggle('motion-enabled', !motionPaused);
  motionToggle.setAttribute('aria-pressed', String(motionPaused));
  motionToggle.querySelector('span:first-child').innerHTML = icon(motionPaused ? 'play' : 'pause');
  motionToggle.setAttribute(
    'aria-label',
    motionPaused ? 'Activar animaciones' : 'Pausar animaciones',
  );
  document.querySelector('.motion-label').textContent = motionPaused
    ? 'Activar movimiento'
    : 'Pausar movimiento';
}
updateMotion();
// Los cambios manuales y los del sistema terminan en la misma actualización de estado.
motionToggle.addEventListener('click', () => {
  motionPaused = !motionPaused;
  updateMotion();
  requestScroll();
});
const reading = document.querySelector('.reading-progress');
const scenes = [...document.querySelectorAll('.product-scene')];
const parallax = [...document.querySelectorAll('.parallax')];
let tickRequested = false;
let smoothScroll = scrollY;
/** Limita una magnitud al intervalo permitido para evitar desplazamientos excesivos. */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
/**
 * Actualiza el progreso y los desplazamientos decorativos en un solo fotograma.
 * El scroll nativo permanece intacto: solo se modifican transformaciones visuales.
 */
function renderScroll() {
  tickRequested = false;
  const vh = innerHeight;
  smoothScroll += (scrollY - smoothScroll) * 0.095;
  const scrollLag = smoothScroll - scrollY;
  const range = document.documentElement.scrollHeight - vh;
  reading.style.transform = `scaleX(${range > 0 ? scrollY / range : 0})`;
  // Al pausar se recuperan posiciones estáticas, pero el indicador de lectura sigue funcionando.
  if (motionPaused) {
    smoothScroll = scrollY;
    scenes.forEach((s) => {
      s.querySelector('.scene-photo').style.transform = 'none';
      s.querySelector('.scene-bg-word').style.transform = 'none';
    });
    parallax.forEach((el) => (el.style.transform = 'none'));
    return;
  }
  // Se evitan cálculos de capas alejadas de la ventana visible.
  parallax.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.bottom > -300 && rect.top < vh + 300) {
      const offset = clamp(
        (rect.top + rect.height / 2 - vh / 2) * Number(el.dataset.speed),
        -100,
        100,
      );
      el.style.transform = `translate3d(0,${offset.toFixed(1)}px,0)`;
    }
  });
  // El progreso normalizado de cada escena controla su botella y su palabra de fondo.
  scenes.forEach((scene) => {
    const rect = scene.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) return;
    const p = clamp((vh - rect.top - scrollLag) / (rect.height + vh), 0, 1);
    const mid = (p - 0.5) * 2;
    scene.style.setProperty('--p', p.toFixed(3));
    scene.querySelector('.scene-photo').style.transform =
      `translate3d(${(mid * 18).toFixed(1)}px,${(-mid * 135).toFixed(1)}px,0) rotate(${(mid * 9 - 4).toFixed(2)}deg) scale(${(1 + Math.abs(mid) * 0.055).toFixed(3)})`;
    scene.querySelector('.scene-bg-word').style.transform =
      `translate3d(${(mid * -95).toFixed(1)}px,${(mid * 40).toFixed(1)}px,0)`;
  });
  // La interpolación continúa solo hasta alcanzar la posición real del desplazamiento.
  if (Math.abs(scrollLag) > 0.2) requestScroll();
}
/** Agrupa varios eventos de scroll o tamaño en una única solicitud de fotograma. */
function requestScroll() {
  if (!tickRequested) {
    tickRequested = true;
    requestAnimationFrame(renderScroll);
  }
}
// Los escuchadores pasivos permiten desplazar la página sin bloquear la interacción.
addEventListener('scroll', requestScroll, { passive: true });
addEventListener('resize', requestScroll);
motionQuery.addEventListener('change', () => {
  motionPaused = motionQuery.matches;
  updateMotion();
  requestScroll();
});
requestScroll();

// El filtrado es local: no solicita datos nuevos y conserva los botones de cada tarjeta.
// Una tarjeta puede pertenecer a varias categorías separadas por espacios.
document.querySelectorAll('.filter').forEach((button) =>
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach((b) => {
      const active = b === button;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    document.querySelectorAll('.product-card').forEach((card) => {
      card.hidden =
        button.dataset.filter !== 'all' &&
        !card.dataset.category.split(' ').includes(button.dataset.filter);
      if (!card.hidden) {
        count++;
        card.classList.add('is-visible');
      }
    });
    document.querySelector('.catalog-count').textContent =
      `${count} ${count === 1 ? 'sabor para descubrir' : 'sabores para descubrir'}`;
    requestScroll();
  }),
);
// Un solo diálogo evita duplicar las galerías y facilita devolver el foco al cerrarlo.
const dialog = document.querySelector('.product-dialog');
const detailImage = document.querySelector('#detail-image');
let previousFocus;
/** Carga la ficha y sus miniaturas antes de abrir el diálogo modal nativo. */
function showProduct(id) {
  const p = products.find((product) => product.id === id);
  if (!p) return;
  previousFocus = document.activeElement;
  document.querySelector('#detail-category').textContent = p.categoryLabel;
  document.querySelector('#detail-name').textContent = p.name;
  document.querySelector('#detail-description').textContent = p.description;
  document.querySelector('.detail-order').dataset.orderProduct = p.id;
  document.querySelector('#detail-meta').innerHTML = /* HTML */ ` ${volumeBadge(p)}<span
      >${p.alcohol ? 'Con alcohol · Mayores de edad' : 'Sin alcohol'}</span
    >`;
  dialog.style.setProperty('--accent', p.accent);
  detailImage.src = p.cutout;
  detailImage.alt = p.name + ' Catania';
  const thumbs = document.querySelector('#detail-thumbs');
  const gallery = [p.cutout, ...p.gallery.map(asset)];
  thumbs.innerHTML = gallery
    .map(
      (image, i) =>
        /* HTML */ `<button
          aria-label="Ver fotografía ${i + 1} de ${p.name}"
          aria-pressed="${i === 0}"
          data-image="${image}"
        >
          <img src="${image}" alt="" />
        </button>`,
    )
    .join('');
  // Las miniaturas alternan entre el recorte transparente y las fotografías originales.
  thumbs.querySelectorAll('button').forEach((button) =>
    button.addEventListener('click', () => {
      detailImage.src = button.dataset.image;
      detailImage.classList.toggle(
        'original-photo',
        button.dataset.image.startsWith('assets/product-'),
      );
      thumbs
        .querySelectorAll('button')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    }),
  );
  detailImage.classList.remove('original-photo');
  dialog.showModal();
  document.body.classList.add('modal-open');
}
// Los disparadores de detalle son distintos de los botones para añadir al pedido.
document
  .querySelectorAll('[data-product]')
  .forEach((button) => button.addEventListener('click', () => showProduct(button.dataset.product)));
/** Cierra el modal; el evento close centraliza la restauración de foco y scroll. */
function closeDialog() {
  dialog.close();
}
document.querySelector('.dialog-close').addEventListener('click', closeDialog);
document.querySelector('.dialog-back').addEventListener('click', closeDialog);
dialog.addEventListener('click', (e) => {
  // El clic debe pertenecer al fondo: un clic de teclado en una miniatura usa coordenadas cero.
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    closeDialog();
});
// Si ya se abrió el pedido, se conserva el bloqueo de fondo y se evita robarle el foco.
dialog.addEventListener('close', () => {
  document.body.classList.toggle('modal-open', !!document.querySelector('dialog[open]'));
  if (!document.querySelector('dialog[open]')) previousFocus?.focus({ preventScroll: true });
  requestScroll();
});
// Navegación móvil: el atributo hidden y aria-expanded siempre se actualizan juntos.
const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
/** Abre o cierra el menú móvil y anuncia su estado a las tecnologías de asistencia. */
function setMenu(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  mobileNav.hidden = !open;
}
// Se cierra al elegir un destino, pulsar Escape o interactuar fuera de la cabecera.
menuToggle.addEventListener('click', () =>
  setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'),
);
mobileNav
  .querySelectorAll('a')
  .forEach((link) => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setMenu(false);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.site-header')) setMenu(false);
});
// Los cursores gráficos y el horario comercial se gestionan en interface.js.
