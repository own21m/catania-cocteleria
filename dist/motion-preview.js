/* Recorrido demostrativo: anima cursores y un contador local sin enviar pedidos. */
(() => {
  'use strict';
  // Referencias de la escena de demostración; no utiliza el catálogo ni el pedido real.
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('#tour-toggle');
  const status = document.querySelector('#tour-status');
  const contact = document.querySelector('#preview-contact');
  const cursor = document.querySelector('.preview-tour-cursor');
  const sprite = cursor.querySelector('img');
  const states = [...document.querySelectorAll('[data-cursor-state]')];
  // Los mismos tres sprites del sitio representan explorar, señalar y brindar.
  const paths = Object.fromEntries(
    ['point', 'bottle', 'sip'].map((name) => [name, `assets/cursor-${name}-48.png`]),
  );
  // Un único cuadro de animación conserva el tiempo del recorrido y su pausa voluntaria.
  let paused = reduced.matches;
  let explicitPlay = false;
  let frame = 0;
  let previousTime = 0;
  let elapsed = 0;
  let previousStage = '';
  let count = 2;
  // La interpolación suavizada evita saltos al pasar entre los puntos de la trayectoria.
  const ease = (value) => value * value * (3 - 2 * value);
  const mix = (start, end, amount) =>
    start + (end - start) * ease(Math.max(0, Math.min(1, amount)));
  // Precargar los sprites evita parpadeos la primera vez que cambia la mano.
  Object.values(paths).forEach((path) => {
    const image = new Image();
    image.src = path;
  });

  // Sincroniza el sprite, el estado destacado y la respuesta visual del botón.
  function setStage(stage, state, text) {
    if (stage === previousStage) return;
    previousStage = stage;
    sprite.src = paths[state];
    status.textContent = text;
    states.forEach((item) =>
      item.classList.toggle('is-active', item.dataset.cursorState === state),
    );
    contact.classList.toggle('tour-hover', stage === 'hover');
    contact.classList.toggle('tour-pressed', stage === 'press');
    cursor.classList.toggle('is-pressing', stage === 'press');
  }

  // Dibuja un ciclo de 12,5 segundos adaptado al tamaño actual de la ventana.
  function render(now) {
    frame = 0;
    if (paused || document.hidden) return;
    // Limitar el salto temporal evita movimientos bruscos tras una interrupción.
    const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.06) : 0;
    previousTime = now;
    elapsed += delta;
    const t = elapsed % 12.5;
    const width = innerWidth,
      height = innerHeight;
    const bounds = contact.getBoundingClientRect();
    const target = {
      x: bounds.left + bounds.width * 0.58,
      y: bounds.top + bounds.height * 0.38,
    };
    const start = { x: width * 0.17, y: height * 0.37 };
    const middle = { x: width * 0.6, y: height * 0.31 };
    let x, y;
    // Cada tramo ilustra una interacción: recorrido, acercamiento, clic, scroll y regreso.
    if (t < 3.2) {
      setStage('explore', 'point', 'Explora · El primer gesto');
      const p = t / 3.2;
      x = mix(start.x, middle.x, p);
      y = mix(start.y, middle.y, p) + Math.sin(p * Math.PI) * height * 0.055;
    } else if (t < 5.8) {
      setStage('hover', 'bottle', 'Descubre · Acércate al brindis');
      const p = Math.min((t - 3.2) / 1.25, 1);
      x = mix(middle.x, target.x, p);
      y = mix(middle.y, target.y, p);
    } else if (t < 7.5) {
      setStage('press', 'sip', 'Brinda · Un clic, otro momento');
      x = target.x;
      y = target.y + Math.sin((t - 5.8) * 6) * 2;
    } else if (t < 10.5) {
      setStage('scroll', 'sip', 'Fluye · El movimiento continúa');
      const p = (t - 7.5) / 3;
      x = mix(target.x, width * 0.79, p) + Math.sin(p * Math.PI) * width * 0.045;
      y = mix(target.y, height * 0.4, p);
    } else {
      setStage('return', 'point', 'Explora · Vuelve a sentirlo');
      const p = (t - 10.5) / 2;
      x = mix(width * 0.79, start.x, p);
      y = mix(height * 0.4, start.y, p);
    }
    // Mantiene el sprite dentro de los límites visibles incluso en pantallas pequeñas.
    const size = width <= 760 ? 42 : 48;
    x = Math.max(9, Math.min(width - size + 8, x));
    y = Math.max(9, Math.min(height - size + 8, y));
    cursor.style.transform = `translate3d(${(x - 8).toFixed(2)}px,${(y - 7).toFixed(2)}px,0)`;
    cursor.classList.add('is-visible');
    frame = requestAnimationFrame(render);
  }

  // Cancela el cuadro anterior antes de reconciliar preferencia, visibilidad y reproducción.
  function sync() {
    root.classList.toggle('motion-paused', paused);
    root.classList.toggle('motion-enabled', !paused && (!reduced.matches || explicitPlay));
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute(
      'aria-label',
      paused ? 'Reproducir recorrido animado' : 'Pausar recorrido animado',
    );
    toggle.querySelector('.preview-toggle-label').textContent = paused ? 'Reproducir' : 'Pausar';
    toggle.querySelector('.preview-toggle-symbol').innerHTML = window.CataniaIcon(
      paused ? 'play' : 'pause',
    );
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    if (paused) {
      cursor.classList.remove('is-visible', 'is-pressing');
      contact.classList.remove('tour-hover', 'tour-pressed');
      status.textContent =
        reduced.matches && !explicitPlay
          ? 'Movimiento en pausa · Tú decides'
          : 'Recorrido en pausa';
    } else if (!document.hidden) {
      previousStage = '';
      frame = requestAnimationFrame(render);
    }
  }

  // Una reproducción explícita puede activar esta vista aunque se prefiera menos movimiento.
  toggle.addEventListener('click', () => {
    paused = !paused;
    if (!paused) explicitPlay = true;
    sync();
  });
  // El contador es una simulación local: no crea pedidos ni abre un servicio externo.
  contact.addEventListener('click', () => {
    count = count === 2 ? 3 : 2;
    contact.querySelector('.contact-float-count').textContent = String(count);
    contact.setAttribute(
      'aria-label',
      `Contáctanos: probar contador de demostración, ${count} bebidas`,
    );
    status.textContent = `Demostración · ${count} bebidas`;
  });
  // La escena deja de solicitar cuadros cuando la pestaña no está visible.
  document.addEventListener('visibilitychange', sync);
  const preferenceChanged = () => {
    explicitPlay = false;
    paused = reduced.matches;
    sync();
  };
  // Se conserva el método antiguo para navegadores que no ofrecen el evento moderno.
  if (reduced.addEventListener) reduced.addEventListener('change', preferenceChanged);
  else if (reduced.addListener) reduced.addListener(preferenceChanged);
  // Si un recurso no carga, se retira el sprite sin interrumpir los controles de la vista.
  sprite.addEventListener('error', () => {
    cursor.style.display = 'none';
  });
  // Aplica la preferencia del dispositivo antes de iniciar el primer recorrido.
  sync();
})();
