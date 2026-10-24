/**
 * Pila de fotografías del encabezado.
 * Un controlador administra el orden, los gestos y dos temporizadores exclusivos:
 * uno de reproducción y otro para finalizar la transición visual.
 * El feed puede proponer nuevas fotos mediante catania:instagram-posts. La sustitución
 * espera a que termine la interacción, desmonta el controlador y conserva su pausa.
 */
(() => {
  'use strict';
  const gallery = document.querySelector('.moments-gallery');
  const deck = gallery?.querySelector('.moments-deck');
  if (!gallery || !deck) return;
  const root = document.documentElement;
  const expectedUsername = (gallery.dataset.instagramUsername || 'cataniacocteleria')
    .toLowerCase()
    .replace(/^@/, '');
  let controller = null;
  // Solo se retiene la propuesta más reciente; una microtarea agrupa comprobaciones repetidas.
  let pendingReplacement = null;
  let replacementCheckQueued = false;
  if (!gallery.dataset.source) gallery.dataset.source = 'manual';

  // Normaliza texto externo y limita su longitud; se inserta mediante textContent.
  function plainText(value, max) {
    return typeof value === 'string'
      ? value
          .replace(/[\u0000-\u001f\u007f]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, max)
      : '';
  }

  // Rechaza protocolos activos y credenciales incluidas en la dirección.
  function httpsUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  // Permite imágenes HTTPS y las rutas locales HTTP que necesita la vista previa.
  function imageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, location.href);
      const safeProtocol =
        url.protocol === 'https:' || (url.origin === location.origin && url.protocol === 'http:');
      return safeProtocol && !url.username && !url.password ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  // El enlace de cada fotografía solo puede dirigir a una publicación de Instagram.
  function instagramPermalink(value) {
    const valid = httpsUrl(value);
    if (!valid) return '';
    const url = new URL(valid);
    return ['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) &&
      /^\/(p|reel|tv)\/[^/]+\/?$/.test(url.pathname)
      ? url.href
      : '';
  }

  // La firma ignora el orden: una respuesta equivalente no reconstruye la pila.
  function fingerprint(posts) {
    return posts
      .map((post) => JSON.stringify([post.id, post.image]))
      .sort()
      .join('|');
  }

  // Segunda validación en la frontera del componente: cuenta, propietario, IDs y metadatos.
  // Nunca se acepta HTML del proveedor; las dimensiones y fechas se normalizan por separado.
  function normalizeReplacement(detail) {
    if (
      !detail ||
      !Array.isArray(detail.posts) ||
      detail.posts.length < 1 ||
      detail.posts.length > 5
    )
      return null;
    const username = plainText(detail.username, 40).replace(/^@/, '').toLowerCase();
    if (username !== expectedUsername) return null;
    const ids = new Set();
    const posts = [];
    for (const item of detail.posts) {
      if (!item || typeof item !== 'object') return null;
      if (!['string', 'number'].includes(typeof item.id)) return null;
      const id = plainText(String(item.id), 160);
      const image = imageUrl(item.image);
      if (!id || !image || ids.has(id)) return null;
      ids.add(id);
      const title = plainText(item.title, 100) || 'Un momento Catania';
      const alt = plainText(item.alt, 500) || title;
      // Un tamaño inválido deja que la figura use sus dimensiones predeterminadas.
      const dimension = (value) =>
        Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 12000
          ? Number(value)
          : null;
      const timestamp =
        typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp))
          ? new Date(item.timestamp).toISOString()
          : '';
      posts.push({
        id,
        image,
        title,
        alt,
        permalink: instagramPermalink(item.permalink),
        timestamp,
        width: dimension(item.width),
        height: dimension(item.height),
      });
    }
    const fetchedAt =
      typeof detail.fetchedAt === 'string' && Number.isFinite(Date.parse(detail.fetchedAt))
        ? new Date(detail.fetchedAt).toISOString()
        : '';
    return { posts, username, fetchedAt };
  }

  // Construye una tarjeta fuera del DOM visible para insertarla junto a las demás de una vez.
  function createFigure(post, index) {
    const figure = document.createElement('figure');
    figure.className = 'moment-card is-resetting';
    figure.dataset.slot = String(index);
    figure.dataset.postId = post.id;
    figure.dataset.title = post.title;
    if (post.permalink) figure.dataset.postUrl = post.permalink;
    if (post.timestamp) figure.dataset.timestamp = post.timestamp;
    const image = document.createElement('img');
    image.src = post.image;
    image.alt = post.alt;
    image.width = post.width || 800;
    image.height = post.height || 1000;
    image.loading = index === 0 ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.draggable = false;
    const caption = document.createElement('figcaption');
    const brand = document.createElement('span');
    brand.textContent = 'CATANIA';
    const label = document.createElement('span');
    label.textContent = post.title;
    // Un título largo se recorta visualmente para respetar el ancho fijo de la tarjeta.
    label.style.minWidth = '0';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    const number = document.createElement('span');
    number.className = 'moment-mark';
    number.textContent = String(index + 1).padStart(2, '0');
    caption.append(brand, label, number);
    figure.append(image, caption);
    return figure;
  }

  // Recibe una propuesta del feed y la deja pendiente si el usuario está interactuando.
  function requestReplacement(detail) {
    const normalized = normalizeReplacement(detail);
    if (!normalized) return false;
    // Con IDs e imágenes iguales, se conserva íntegra la pila aunque cambie el orden recibido.
    if (controller?.signature() === fingerprint(normalized.posts)) {
      pendingReplacement = null;
      return true;
    }
    pendingReplacement = normalized;
    requestReplacementCheck();
    return true;
  }

  // El reemplazo es atómico: guardar estado, construir fragmento, liberar recursos y reiniciar.
  // Si todavía no es seguro, syncPlayback volverá a comprobar la propuesta cuando cambie el estado.
  function requestReplacementCheck() {
    if (!pendingReplacement || replacementCheckQueued) return;
    replacementCheckQueued = true;
    queueMicrotask(() => {
      replacementCheckQueued = false;
      if (!pendingReplacement || (controller && !controller.canReplace())) return;
      const incoming = pendingReplacement;
      pendingReplacement = null;
      const saved = controller?.snapshot() || {};
      const fragment = document.createDocumentFragment();
      incoming.posts.forEach((post, index) => fragment.append(createFigure(post, index)));
      controller?.destroy();
      deck.replaceChildren(fragment);
      gallery.dataset.source = 'instagram';
      gallery.dataset.instagramUsername = incoming.username;
      if (incoming.fetchedAt) gallery.dataset.fetchedAt = incoming.fetchedAt;
      controller = createController(saved);
    });
  }

  // Cada instancia solo administra las tarjetas con las que fue creada.
  // Al reconstruirse, recupera la pausa voluntaria y la foto frontal si aún existe.
  function createController(saved = {}) {
    const cards = [...deck.querySelectorAll('.moment-card')];
    if (!cards.length) return null;
    const canonical = cards
      .slice()
      .sort((a, b) => Number(a.dataset.slot || 0) - Number(b.dataset.slot || 0));
    const prev = gallery.querySelector('.moments-prev');
    const next = gallery.querySelector('.moments-next');
    const toggle = gallery.querySelector('.moments-toggle');
    const position = gallery.querySelector('.moments-position');
    const title = gallery.querySelector('.moments-title');
    const announcement = gallery.querySelector('.moments-announcement');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const AUTOPLAY_MS = 5500;
    const TRANSITION_MS = 800;
    // canonical conserva la numeración; order representa el orden actual de profundidad.
    const preferred = canonical.findIndex(
      (card) => card.dataset.postId === saved.frontId && saved.frontId,
    );
    let order =
      preferred > 0
        ? [...canonical.slice(preferred), ...canonical.slice(0, preferred)]
        : canonical.slice();
    let userPaused = Boolean(saved.userPaused);
    // Estado de interacción y reproducción. Los identificadores cero indican ausencia de temporizador.
    let hovered = matchMedia('(hover: hover)').matches && gallery.matches(':hover');
    let focused = gallery.contains(document.activeElement);
    let touching = null;
    let animating = false;
    let leaving = null;
    let queuedDirection = null;
    let autoTimer = 0;
    let transitionTimer = 0;
    let lastAdvance = 0;
    let destroyed = false;
    let dialogOpen = Boolean(document.querySelector('dialog[open]'));
    let externalPaused = externalMotionPaused();
    const initialRect = deck.getBoundingClientRect();
    let visible =
      initialRect.bottom > 0 &&
      initialRect.top < innerHeight &&
      initialRect.right > 0 &&
      initialRect.left < innerWidth;
    const cleanups = [];

    // Registrar cada escucha junto a su limpieza permite destruir la instancia sin duplicar eventos.
    function listen(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      cleanups.push(() => target.removeEventListener(name, handler, options));
    }

    // Comparte la preferencia global de app.js y permite la activación explícita del usuario.
    function externalMotionPaused() {
      return (
        root.classList.contains('motion-paused') ||
        (reduced.matches && !root.classList.contains('motion-enabled'))
      );
    }

    // Cancelar antes de programar garantiza como máximo un avance automático pendiente.
    function clearAuto() {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = 0;
    }

    // La galería solo avanza si es visible y no compite con foco, hover, tacto o diálogos.
    function canAutoplay() {
      return (
        !destroyed &&
        cards.length > 1 &&
        !userPaused &&
        !externalPaused &&
        !hovered &&
        !focused &&
        !touching &&
        visible &&
        !document.hidden &&
        !dialogOpen
      );
    }

    // El título editorial tiene prioridad; alt y un texto neutro completan los casos restantes.
    function cardTitle(card) {
      return card.dataset.title || card.querySelector('img')?.alt || 'Un momento Catania';
    }

    // Mantiene texto, icono y estado accesible del control de reproducción sincronizados.
    function updateToggle() {
      if (!toggle) return;
      const stopped = userPaused || externalPaused || cards.length < 2;
      toggle.disabled = externalPaused || cards.length < 2;
      toggle.setAttribute('aria-pressed', String(stopped));
      toggle.setAttribute(
        'aria-label',
        externalPaused
          ? 'Activa el movimiento de la página para reproducir la galería. Puedes avanzar foto por foto.'
          : stopped
            ? 'Reproducir galería de momentos'
            : 'Pausar galería de momentos',
      );
      const symbol = toggle.querySelector('.moments-toggle-icon');
      if (symbol && typeof window.CataniaIcon === 'function')
        symbol.innerHTML = window.CataniaIcon(stopped ? 'play' : 'pause');
      const label = toggle.querySelector('.moments-toggle-label');
      if (label) label.textContent = stopped ? 'Reproducir' : 'Pausar';
    }

    // Asigna profundidad visual y accesibilidad: únicamente la tarjeta frontal deja de ser inert.
    // Los cambios automáticos no generan anuncios; las acciones manuales sí usan la región viva.
    function updateCards(manual = false) {
      const front = order[0];
      order.forEach((card, slot) => {
        card.dataset.slot = String(slot);
        card.classList.toggle('is-active', slot === 0);
        card.inert = slot !== 0;
        if (slot === 0) card.removeAttribute('aria-hidden');
        else card.setAttribute('aria-hidden', 'true');
      });
      const number = canonical.indexOf(front) + 1;
      if (position)
        position.textContent = `${String(number).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
      if (title) title.textContent = cardTitle(front);
      const postLink = gallery.querySelector('.moments-post-link');
      const postUrl = instagramPermalink(front.dataset.postUrl);
      if (postUrl) gallery.dataset.postUrl = postUrl;
      else delete gallery.dataset.postUrl;
      if (postLink) {
        postLink.hidden = !postUrl;
        if (postUrl) {
          postLink.href = postUrl;
          postLink.target = '_blank';
          postLink.rel = 'noopener noreferrer';
          postLink.setAttribute('aria-label', 'Ver esta publicación en Instagram');
        } else postLink.removeAttribute('href');
      }
      if (manual && announcement)
        announcement.textContent = `Foto ${number} de ${cards.length}. ${cardTitle(front)}.`;
    }

    // El temporizador se crea de nuevo tras cada cambio de estado y vuelve a validar al ejecutarse.
    function scheduleAuto(delay = AUTOPLAY_MS) {
      clearAuto();
      if (!canAutoplay() || animating) return;
      autoTimer = setTimeout(() => {
        autoTimer = 0;
        // Consultar el DOM evita depender del momento en que se ejecuten los observadores.
        externalPaused = externalMotionPaused();
        dialogOpen = Boolean(document.querySelector('dialog[open]'));
        if (canAutoplay()) advance(1, false);
        else syncPlayback();
      }, delay);
    }

    // Punto central para reflejar la pausa, reprogramar el avance e intentar una sustitución pendiente.
    function syncPlayback(delay = AUTOPLAY_MS) {
      if (destroyed) return;
      gallery.dataset.playback = canAutoplay() ? 'playing' : 'paused';
      gallery.classList.toggle('moments-paused', !canAutoplay());
      updateToggle();
      scheduleAuto(delay);
      requestReplacementCheck();
    }

    // Fija las posiciones finales sin una transición adicional al terminar o cancelar un avance.
    function snapCards() {
      cards.forEach((card) => card.classList.add('is-resetting'));
      cards.forEach((card) => card.classList.remove('is-leaving'));
      // Forzar el cálculo de diseño aplica las posiciones con las transiciones desactivadas.
      // No se añade otro temporizador ni cuadro de animación, incluso con la pestaña oculta.
      void deck.offsetWidth;
      cards.forEach((card) => card.classList.remove('is-resetting'));
    }

    // Libera el temporizador visual y procesa como máximo la última dirección solicitada.
    // Al interrumpir por un diálogo o por visibilidad, puede descartarse la cola.
    function finishTransition(processQueue = true) {
      if (transitionTimer) clearTimeout(transitionTimer);
      transitionTimer = 0;
      if (!animating) return;
      snapCards();
      animating = false;
      leaving = null;
      deck.removeAttribute('aria-busy');
      gallery.classList.remove('is-transitioning');
      const pending = queuedDirection;
      queuedDirection = null;
      if (
        processQueue &&
        pending !== null &&
        !document.hidden &&
        !dialogOpen &&
        visible &&
        !externalPaused
      ) {
        advance(pending, true);
      } else {
        syncPlayback(Math.max(400, AUTOPLAY_MS - (performance.now() - lastAdvance)));
      }
    }

    // Rota el array de tarjetas sin mover el scroll; en pausa el cambio se aplica inmediatamente.
    function advance(direction, manual = true) {
      if (destroyed || cards.length < 2) return;
      const step = direction < 0 ? -1 : 1;
      if (animating) {
        // Varios toques rápidos conservan solo la última dirección y nunca solapan transiciones.
        if (manual) queuedDirection = step;
        return;
      }
      clearAuto();
      externalPaused = externalMotionPaused();
      const animate = !externalPaused && !document.hidden && visible;
      leaving = order[0];
      deck.dataset.direction = step === 1 ? 'next' : 'prev';
      lastAdvance = performance.now();
      if (animate) {
        animating = true;
        leaving.classList.add('is-leaving');
        deck.setAttribute('aria-busy', 'true');
        gallery.classList.add('is-transitioning');
      } else {
        cards.forEach((card) => card.classList.add('is-resetting'));
      }
      order =
        step === 1
          ? [...order.slice(1), order[0]]
          : [order[order.length - 1], ...order.slice(0, -1)];
      updateCards(manual);
      if (animate) {
        transitionTimer = setTimeout(finishTransition, TRANSITION_MS);
      } else {
        snapCards();
        leaving = null;
        syncPlayback();
      }
    }

    // Reacciona a cambios en las clases de movimiento o en la preferencia del sistema.
    function refreshExternal() {
      const nextPause = externalMotionPaused();
      if (nextPause === externalPaused) return;
      externalPaused = nextPause;
      if (externalPaused && animating) finishTransition();
      syncPlayback();
    }

    // Abrir un diálogo detiene la pila y elimina gestos pendientes hasta que vuelva a estar libre.
    function refreshDialogs() {
      const nextDialog = Boolean(document.querySelector('dialog[open]'));
      if (nextDialog === dialogOpen) return;
      dialogOpen = nextDialog;
      if (dialogOpen) {
        queuedDirection = null;
        if (animating) finishTransition(false);
      }
      syncPlayback();
    }

    // Solo un gesto horizontal suficiente y breve cambia de foto; el desplazamiento vertical es nativo.
    function endTouch(event, cancelled = false) {
      if (!touching || event.pointerId !== touching.id) return;
      const start = touching;
      touching = null;
      if (!cancelled) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const elapsed = performance.now() - start.time;
        if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.35 && elapsed < 1300) {
          advance(dx < 0 ? 1 : -1, true);
          return;
        }
      }
      syncPlayback();
    }

    // Preparar teclado, tacto y anuncios antes de instalar las escuchas de interacción.
    if (!deck.hasAttribute('tabindex')) deck.tabIndex = 0;
    if (!deck.hasAttribute('aria-label'))
      deck.setAttribute(
        'aria-label',
        'Galería de momentos. Usa las flechas izquierda y derecha para cambiar de foto.',
      );
    deck.style.touchAction = 'pan-y';
    cards.forEach((card) =>
      card.querySelectorAll('img').forEach((img) => {
        img.draggable = false;
      }),
    );
    if (announcement) {
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
    }
    // Posición y título son texto normal; solo el anuncio de cambios manuales es una región viva.
    position?.setAttribute('aria-live', 'off');
    title?.setAttribute('aria-live', 'off');
    // Los botones y la API pública usan el mismo avance que los gestos.
    if (prev) {
      prev.disabled = cards.length < 2;
      listen(prev, 'click', () => advance(-1, true));
    }
    if (next) {
      next.disabled = cards.length < 2;
      listen(next, 'click', () => advance(1, true));
    }
    if (toggle)
      listen(toggle, 'click', () => {
        if (externalPaused) return;
        userPaused = !userPaused;
        syncPlayback();
      });
    // Las flechas del teclado no interfieren con campos editables ni combinaciones modificadas.
    listen(deck, 'keydown', (event) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.target.isContentEditable ||
        event.target.closest('input,textarea,select')
      )
        return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      advance(event.key === 'ArrowRight' ? 1 : -1, true);
    });
    // Hover y foco pausan mientras se examina la foto; salir de la galería permite reanudar.
    listen(
      gallery,
      'pointerenter',
      (event) => {
        if (event.pointerType === 'touch') return;
        hovered = true;
        syncPlayback();
      },
      { passive: true },
    );
    listen(
      gallery,
      'pointerleave',
      () => {
        hovered = false;
        syncPlayback();
      },
      { passive: true },
    );
    listen(gallery, 'focusin', () => {
      focused = true;
      syncPlayback();
    });
    // Esperar una microtarea distingue salir de la galería de moverse entre sus controles.
    listen(gallery, 'focusout', () =>
      queueMicrotask(() => {
        if (destroyed) return;
        const nextFocus = gallery.contains(document.activeElement);
        if (nextFocus === focused) return;
        focused = nextFocus;
        syncPlayback();
      }),
    );
    // Guardar el inicio táctil sin capturar ni cancelar el scroll vertical del navegador.
    listen(
      deck,
      'pointerdown',
      (event) => {
        if (
          event.pointerType !== 'touch' ||
          event.isPrimary === false ||
          event.target.closest('a,button,input,textarea,select')
        )
          return;
        touching = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          time: performance.now(),
        };
        syncPlayback();
      },
      { passive: true },
    );
    // Finalizar fuera de la tarjeta también cierra el gesto y libera la reproducción.
    listen(window, 'pointerup', (event) => endTouch(event), { passive: true });
    listen(window, 'pointercancel', (event) => endTouch(event, true), { passive: true });
    listen(window, 'blur', () => {
      touching = null;
      hovered = false;
      syncPlayback();
    });
    // Al ocultarse la pestaña se descartan gestos y transiciones pendientes.
    listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        touching = null;
        queuedDirection = null;
        if (animating) finishTransition(false);
      }
      syncPlayback();
    });

    // Los observadores pertenecen a esta instancia y se desconectan en destroy.
    const motionObserver = new MutationObserver(refreshExternal);
    motionObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    const dialogObserver = new MutationObserver(refreshDialogs);
    dialogObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['open'],
      subtree: true,
    });
    let visibilityObserver = null;
    // Fuera del área visible no se consume reproducción automática.
    if ('IntersectionObserver' in window) {
      visibilityObserver = new IntersectionObserver(
        (entries) => {
          const nextVisible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.18;
          if (nextVisible === visible) return;
          visible = nextVisible;
          if (!visible && animating) finishTransition(false);
          syncPlayback();
        },
        { threshold: [0, 0.18] },
      );
      visibilityObserver.observe(deck);
    } else {
      // Compatibilidad: calcular visibilidad al desplazar o redimensionar si no hay observador.
      const refreshVisibility = () => {
        const rect = deck.getBoundingClientRect();
        const nextVisible =
          rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        if (nextVisible === visible) return;
        visible = nextVisible;
        syncPlayback();
      };
      listen(window, 'scroll', refreshVisibility, { passive: true });
      listen(window, 'resize', refreshVisibility, { passive: true });
    }
    if (typeof reduced.addEventListener === 'function') listen(reduced, 'change', refreshExternal);
    else if (typeof reduced.addListener === 'function') {
      reduced.addListener(refreshExternal);
      cleanups.push(() => reduced.removeListener(refreshExternal));
    }

    // Interfaz del componente para controles externos; no expone las referencias internas de tarjetas.
    const api = {
      next: () => advance(1, true),
      previous: () => advance(-1, true),
      pause: () => {
        userPaused = true;
        syncPlayback();
      },
      play: () => {
        userPaused = false;
        syncPlayback();
      },
      // Limpieza idempotente: cancelar ambos relojes, retirar escuchas y desconectar observadores.
      destroy() {
        if (destroyed) return;
        destroyed = true;
        clearAuto();
        if (transitionTimer) clearTimeout(transitionTimer);
        transitionTimer = 0;
        queuedDirection = null;
        animating = false;
        touching = null;
        snapCards();
        deck.removeAttribute('aria-busy');
        gallery.classList.remove('is-transitioning');
        gallery.classList.add('moments-paused');
        gallery.dataset.playback = 'paused';
        cleanups.forEach((cleanup) => cleanup());
        motionObserver.disconnect();
        dialogObserver.disconnect();
        visibilityObserver?.disconnect();
        if (gallery.cataniaMoments === api) delete gallery.cataniaMoments;
      },
    };
    api.replace = requestReplacement;
    api.getState = () => ({ userPaused, frontId: order[0]?.dataset.postId || '' });
    gallery.cataniaMoments = api;
    updateCards();
    snapCards();
    syncPlayback();
    // El anfitrión necesita estas operaciones para sustituir datos sin perder la interacción actual.
    return {
      snapshot: api.getState,
      signature: () =>
        fingerprint(
          canonical.map((card) => ({
            id: card.dataset.postId || '',
            image: card.querySelector('img')?.getAttribute('src') || '',
          })),
        ),
      canReplace: () =>
        !destroyed &&
        !animating &&
        !touching &&
        !hovered &&
        !gallery.contains(document.activeElement) &&
        !document.querySelector('dialog[open]'),
      destroy: api.destroy,
    };
  }

  controller = createController();
  // Esta escucha pertenece al anfitrión de la galería y sobrevive a los controladores reemplazados.
  window.addEventListener('catania:instagram-posts', (event) => requestReplacement(event.detail));
})();
