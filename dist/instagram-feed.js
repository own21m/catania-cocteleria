/**
 * Feed público opcional de Instagram mediante Behold.
 * Lee instagram.json, valida la cuenta, consulta publicaciones y precarga sus imágenes.
 * Solo después comunica un conjunto completo a moments.js mediante un evento propio.
 * Las fotos manuales permanecen disponibles si falta configuración o falla una consulta.
 * Los tokens del administrador se gestionan en el proveedor y no forman parte del navegador.
 * Esquema de referencia: https://behold.so/docs/json-feeds/
 */
(() => {
  'use strict';
  const gallery = document.querySelector('.moments-gallery');
  if (!gallery) return;
  const OWNER = 'cataniacocteleria';
  const HOUR = 60 * 60 * 1000;
  const TIMEOUT = 8000;
  const CACHE_MAX_AGE = 24 * HOUR;
  const BEHOLD_IMAGES = new Set(['behold.pictures', 'cdn.behold.pictures', 'cdn2.behold.pictures']);
  // Configuración y caché se resuelven una vez. Solo una consulta puede estar activa a la vez.
  // requestVersion descarta respuestas antiguas después de una cancelación o cambio de página.
  let config = null;
  let configLoaded = false;
  let cacheChecked = false;
  let running = false;
  let stopped = false;
  let requestVersion = 0;
  let activeController = null;
  let refreshTimer = 0;
  let nextDue = 0;
  let lastFingerprint = '';
  let lastLoadedPosts = [];
  gallery.dataset.source = 'manual';
  gallery.dataset.sourceStatus = 'unconfigured';

  // Distingue fallos esperados para exponer un estado breve en data-source-status.
  class FeedError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
    }
  }

  // Los validadores rechazan arrays, valores inesperados y tamaños fuera de los límites admitidos.
  function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  // Los IDs solo se usan como datos: se aceptan caracteres simples y una longitud acotada.
  function validId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  }
  // Cero indica dimensión desconocida; posteriormente se mide la imagen descargada.
  function dimension(value) {
    return Number.isInteger(value) && value > 0 && value <= 20000 ? value : 0;
  }

  // Base común para direcciones externas: HTTPS, sin credenciales y sin puertos alternativos.
  function secureURL(value) {
    if (typeof value !== 'string' || value.length > 4096) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null;
    } catch {
      return null;
    }
  }

  // Limita las imágenes a los CDN previstos y excluye fuentes de vídeo de la pila fotográfica.
  function imageURL(value) {
    const url = secureURL(value);
    if (!url || url.hash) return '';
    const known =
      BEHOLD_IMAGES.has(url.hostname) ||
      url.hostname === 'cdninstagram.com' ||
      url.hostname.endsWith('.cdninstagram.com');
    if (!known || /\.(?:mp4|m4v|mov|webm|m3u8|avi)(?:$|\/)/i.test(url.pathname)) return '';
    return url.href;
  }

  // Conserva únicamente la ruta de una publicación de Instagram, sin parámetros de seguimiento.
  function permalinkURL(value) {
    const url = secureURL(value);
    if (
      !url ||
      url.hostname !== 'www.instagram.com' ||
      !/^\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    )
      return '';
    return `https://www.instagram.com${url.pathname.replace(/\/?$/, '/')}`;
  }

  // Comprueba fecha real y zona horaria antes de convertir a una representación ISO uniforme.
  // La validación del día evita que Date.parse normalice silenciosamente una fecha imposible.
  function timestamp(value) {
    if (typeof value !== 'string') return '';
    const match =
      /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/.exec(
        value,
      );
    if (!match) return '';
    const year = Number(match[1]),
      month = Number(match[2]),
      day = Number(match[3]);
    if (
      year < 1970 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > new Date(Date.UTC(year, month, 0)).getUTCDate()
    )
      return '';
    const parsed = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
  }

  // El pie editorial muestra la fecha de publicación con la zona horaria del negocio.
  function dateTitle(value) {
    const date = new Date(value);
    const label = new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Bogota',
    }).format(date);
    return `Catania · ${label}`;
  }

  // Limpia controles, símbolos pictográficos y marcas HTML del texto alternativo externo.
  // Se limita por puntos de código para no cortar una pareja Unicode a la mitad.
  function altText(value) {
    if (typeof value !== 'string') return 'Foto publicada por Catania en Instagram.';
    const clean = value
      .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u200D\uFE0F]/gu, '')
      .replace(/[\u0000-\u001F\u007F-\u009F<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return [...clean].slice(0, 180).join('') || 'Foto publicada por Catania en Instagram.';
  }

  // La configuración local debe apuntar al dominio exacto de Behold y a la cuenta esperada.
  // Un feedUrl vacío desactiva el feed; el intervalo nunca baja de una hora.
  function normalizeConfig(raw) {
    if (
      !object(raw) ||
      raw.provider !== 'behold' ||
      typeof raw.feedUrl !== 'string' ||
      typeof raw.expectedUsername !== 'string' ||
      raw.expectedUsername.toLowerCase() !== OWNER
    )
      throw new FeedError('invalid-config');
    const feedUrl = raw.feedUrl.trim();
    if (!feedUrl) return null;
    if (!/^https:\/\/feeds\.behold\.so\/[A-Za-z0-9_-]{1,128}$/.test(feedUrl))
      throw new FeedError('invalid-config');
    const url = secureURL(feedUrl);
    if (!url || url.href !== feedUrl) throw new FeedError('invalid-config');
    return {
      feedUrl,
      username: OWNER,
      limit: Number.isInteger(raw.limit) ? Math.min(5, Math.max(1, raw.limit)) : 5,
      // Un error de configuración no puede provocar consultas continuas al proveedor.
      refresh: Math.min(24 * HOUR, Math.max(HOUR, Number(raw.refreshMinutes) * 60000 || HOUR)),
    };
  }

  // Extrae una imagen optimizada de un tamaño conocido y valida su dirección y dimensiones.
  function fromSize(media, name) {
    const size = object(media.sizes) && object(media.sizes[name]) ? media.sizes[name] : null;
    const image = size && imageURL(size.mediaUrl);
    return image
      ? { image, width: dimension(size.width), height: dimension(size.height), alt: media.altText }
      : null;
  }

  // Prioriza la imagen mediana. Los vídeos solo aportan una miniatura, nunca se reproducen.
  function singleImage(media) {
    if (!object(media)) return null;
    if (!['IMAGE', 'VIDEO', 'REEL'].includes(media.mediaType)) return null;
    const medium = fromSize(media, 'medium');
    if (medium) return medium;
    if (media.mediaType !== 'IMAGE') {
      const thumbnail = imageURL(media.thumbnailUrl);
      if (thumbnail) return { image: thumbnail, width: 0, height: 0, alt: media.altText };
      // Los tamaños optimizados de vídeo o reel son imágenes de vista previa.
      return fromSize(media, 'large') || fromSize(media, 'small') || fromSize(media, 'full');
    }
    const original = imageURL(media.mediaUrl);
    return original
      ? {
          image: original,
          width: dimension(media.width),
          height: dimension(media.height),
          alt: media.altText,
        }
      : null;
  }

  // Un álbum aporta su primer hijo utilizable; como alternativa, se usa su vista previa general.
  function postImage(post) {
    if (post.mediaType !== 'CAROUSEL_ALBUM') return singleImage(post);
    if (Array.isArray(post.children)) {
      for (const child of post.children.slice(0, 20)) {
        const firstAvailable = singleImage(child);
        if (firstAvailable) return firstAvailable;
      }
    }
    return (
      fromSize(post, 'medium') ||
      fromSize(post, 'large') ||
      fromSize(post, 'small') ||
      fromSize(post, 'full')
    );
  }

  // Verifica el propietario, filtra publicaciones válidas, ordena por fecha y elimina duplicados.
  // El límite final coincide con la capacidad de la pila del encabezado.
  function normalizeFeed(raw) {
    if (
      !object(raw) ||
      typeof raw.username !== 'string' ||
      raw.username.toLowerCase() !== config.username
    )
      throw new FeedError('account-mismatch');
    if (!Array.isArray(raw.posts) || raw.posts.length > 500) throw new FeedError('error');
    const candidates = [];
    for (const post of raw.posts) {
      if (!object(post) || !validId(post.id)) continue;
      const published = timestamp(post.timestamp),
        permalink = permalinkURL(post.permalink),
        media = postImage(post);
      if (!published || !permalink || !media) continue;
      candidates.push({
        id: post.id,
        image: media.image,
        permalink,
        alt: altText(media.alt || post.altText),
        title: dateTitle(published),
        timestamp: published,
        width: media.width,
        height: media.height,
      });
    }
    candidates.sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || a.id.localeCompare(b.id),
    );
    const seen = new Set();
    const posts = candidates
      .filter((post) => {
        if (seen.has(post.id)) return false;
        seen.add(post.id);
        return true;
      })
      .slice(0, config.limit);
    if (!posts.length) throw new FeedError('empty');
    return posts;
  }

  // La firma detecta cambios de contenido y evita precargar de nuevo imágenes sin cambios.
  function fingerprint(posts) {
    return JSON.stringify(
      posts.map(({ id, image, permalink, alt, title, timestamp: published }) => [
        id,
        image,
        permalink,
        alt,
        title,
        published,
      ]),
    );
  }

  // Cada petición hereda la cancelación general y añade un límite de espera propio.
  // No envía cookies, no sigue redirecciones y descarta respuestas demasiado grandes.
  async function fetchJSON(url, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) controller.abort();
    const timeout = setTimeout(abort, TIMEOUT);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-cache',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok || Number(response.headers.get('content-length')) > 1000000)
        throw new FeedError('error');
      const text = await response.text();
      if (text.length > 1000000) throw new FeedError('error');
      return JSON.parse(text);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  }

  // Precarga el conjunto completo antes de publicarlo para evitar una pila parcialmente vacía.
  // Un fallo, cancelación o vencimiento libera escuchas y rechaza todo el conjunto.
  function loadImages(posts, signal) {
    return new Promise((resolve, reject) => {
      let remaining = posts.length,
        settled = false;
      const images = [],
        loaded = new Array(posts.length);
      const abort = () => finish(new FeedError('image-error'));
      const timer = setTimeout(abort, TIMEOUT);
      // La resolución es única aunque varias imágenes terminen casi al mismo tiempo.
      function finish(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        images.forEach((image) => {
          image.onload = null;
          image.onerror = null;
          if (error) image.src = '';
        });
        if (error) reject(error);
        else resolve(loaded);
      }
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      posts.forEach((post, index) => {
        const image = new Image();
        images.push(image);
        image.referrerPolicy = 'no-referrer';
        image.decoding = 'async';
        image.onerror = () => finish(new FeedError('image-error'));
        image.onload = () => {
          if (settled) return;
          const width = dimension(image.naturalWidth),
            height = dimension(image.naturalHeight);
          if (!width || !height) {
            finish(new FeedError('image-error'));
            return;
          }
          loaded[index] = { ...post, width, height };
          if (--remaining === 0) finish();
        };
        image.src = post.image;
      });
    });
  }

  // Cuenta y URL forman una clave distinta para no mezclar feeds al cambiar de configuración.
  function cacheKey() {
    return `catania.instagram.v1:${config.feedUrl}:${config.username}`;
  }
  // La caché de sesión es opcional y vuelve a validar cada campo como si fuera una respuesta externa.
  // Su edad se calcula desde la consulta, no desde la fecha de publicación de las fotos.
  function readCache() {
    try {
      const text = sessionStorage.getItem(cacheKey());
      if (!text || text.length > 40000) return null;
      const cached = JSON.parse(text),
        age = Date.now() - cached.fetchedAt;
      if (
        !object(cached) ||
        cached.username !== config.username ||
        !Number.isFinite(cached.fetchedAt) ||
        age < 0 ||
        age > CACHE_MAX_AGE
      ) {
        sessionStorage.removeItem(cacheKey());
        return null;
      }
      // Una consulta fallida no autoriza reutilizar una caché cuyo intervalo ya venció.
      if (
        age >= config.refresh ||
        !Array.isArray(cached.posts) ||
        !cached.posts.length ||
        cached.posts.length > config.limit
      )
        return null;
      const seen = new Set();
      for (const post of cached.posts) {
        if (
          !object(post) ||
          !validId(post.id) ||
          seen.has(post.id) ||
          imageURL(post.image) !== post.image ||
          permalinkURL(post.permalink) !== post.permalink ||
          timestamp(post.timestamp) !== post.timestamp ||
          !dimension(post.width) ||
          !dimension(post.height) ||
          typeof post.alt !== 'string' ||
          post.alt.length > 360
        )
          return null;
        seen.add(post.id);
        post.alt = altText(post.alt);
        post.title = dateTitle(post.timestamp);
      }
      cached.posts.sort(
        (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || a.id.localeCompare(b.id),
      );
      return cached;
    } catch {
      return null;
    }
  }

  // Un navegador sin almacenamiento disponible continúa funcionando sin caché.
  function writeCache(posts, fetchedAt) {
    try {
      const text = JSON.stringify({ username: config.username, fetchedAt, posts });
      if (text.length <= 40000) sessionStorage.setItem(cacheKey(), text);
    } catch {
      /* El almacenamiento es opcional; la galería manual y las consultas siguen disponibles. */
    }
  }

  // Solo se conserva un temporizador de actualización pendiente.
  function clearRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = 0;
  }
  // Programa la próxima consulta para su vencimiento; una pestaña oculta no mantiene el reloj activo.
  function scheduleRefresh() {
    clearRefresh();
    if (stopped || document.hidden || running || (configLoaded && !config)) return;
    refreshTimer = setTimeout(
      () => {
        refreshTimer = 0;
        void run();
      },
      Math.max(0, nextDue - Date.now()),
    );
  }

  // Flujo asíncrono final: precargar, comprobar vigencia y notificar al controlador visual.
  // El controlador decide cuándo es seguro sustituir las tarjetas sin interrumpir al usuario.
  async function publish(posts, fetchedAt, version, signal) {
    const nextFingerprint = fingerprint(posts);
    if (nextFingerprint !== lastFingerprint) {
      const loaded = await loadImages(posts, signal);
      if (version !== requestVersion || signal.aborted || stopped || document.hidden) return false;
      // La galería conserva el control del reemplazo, la pausa y el origen de sus datos.
      window.dispatchEvent(
        new CustomEvent('catania:instagram-posts', {
          detail: {
            posts: loaded,
            username: config.username,
            fetchedAt: new Date(fetchedAt).toISOString(),
          },
        }),
      );
      lastFingerprint = nextFingerprint;
      lastLoadedPosts = loaded;
      writeCache(loaded, fetchedAt);
    } else writeCache(lastLoadedPosts, fetchedAt);
    gallery.dataset.sourceStatus = 'ready';
    nextDue = fetchedAt + config.refresh;
    return true;
  }

  // Secuencia principal: configuración local -> caché vigente -> proveedor -> imágenes -> evento.
  // El número de versión y AbortController impiden que una respuesta cancelada llegue a la interfaz.
  async function run() {
    if (stopped || document.hidden || running) return;
    running = true;
    const version = ++requestVersion,
      controller = new AbortController();
    activeController = controller;
    gallery.dataset.sourceStatus = 'loading';
    try {
      if (!configLoaded) {
        const url = new URL('instagram.json?v=7', document.baseURI || window.location.href);
        if (url.origin !== window.location.origin) throw new FeedError('invalid-config');
        const raw = await fetchJSON(url.href, controller.signal);
        if (version !== requestVersion || controller.signal.aborted) return;
        configLoaded = true;
        config = normalizeConfig(raw);
        if (!config) {
          gallery.dataset.sourceStatus = 'unconfigured';
          return;
        }
      }
      if (!cacheChecked) {
        cacheChecked = true;
        const cached = readCache();
        if (cached) {
          try {
            if (await publish(cached.posts, cached.fetchedAt, version, controller.signal)) return;
          } catch {
            if (controller.signal.aborted || version !== requestVersion) return;
          }
        }
      }
      const raw = await fetchJSON(config.feedUrl, controller.signal);
      if (version !== requestVersion || controller.signal.aborted || document.hidden) return;
      await publish(normalizeFeed(raw), Date.now(), version, controller.signal);
    } catch (error) {
      if (version !== requestVersion || controller.signal.aborted || stopped) return;
      gallery.dataset.sourceStatus = error instanceof FeedError ? error.kind : 'error';
      nextDue = Date.now() + (config?.refresh || HOUR);
    } finally {
      if (version === requestVersion) {
        running = false;
        activeController = null;
        scheduleRefresh();
      }
    }
  }

  // Invalida respuestas tardías antes de abortar la consulta y retirar el próximo temporizador.
  function cancelActive() {
    requestVersion++;
    activeController?.abort();
    activeController = null;
    running = false;
    clearRefresh();
    if (gallery.dataset.sourceStatus === 'loading') gallery.dataset.sourceStatus = 'paused';
  }
  // Al recuperar visibilidad solo consulta si ha vencido el intervalo; en otro caso espera.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelActive();
      return;
    }
    if (stopped || (configLoaded && !config)) return;
    if (Date.now() >= nextDue) void run();
    else scheduleRefresh();
  });
  // pagehide también cubre la caché de navegación del navegador y cancela trabajo pendiente.
  window.addEventListener('pagehide', () => {
    stopped = true;
    cancelActive();
  });
  // Una restauración desde esa caché reactiva el ciclo sin registrar escuchas adicionales.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    stopped = false;
    if (!document.hidden && Date.now() >= nextDue) void run();
    else scheduleRefresh();
  });
  // Arranque sin bloquear la página; los fallos quedan reflejados en el estado del componente.
  if (!document.hidden) void run();
})();
