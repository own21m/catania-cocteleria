/**
 * Estado del horario comercial y cursores gráficos de la interfaz.
 * El horario utiliza la hora de Colombia, aunque la visita llegue desde otro país.
 */
(() => {
  'use strict';
  /** Calcula si la fecha está dentro del horario: lunes a viernes 8-18, sábado 8-16. */
  function getOpeningState(date) {
    // formatToParts evita depender del formato del reloj o de la zona horaria del navegador.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const part = (type) => parts.find((p) => p.type === type).value;
    const day = part('weekday'),
      minutes = Number(part('hour')) * 60 + Number(part('minute'));
    // El límite de cierre es exclusivo: a las 18:00 o 16:00 la tienda ya figura cerrada.
    const close = day === 'Sat' ? 16 * 60 : 18 * 60;
    const open = day !== 'Sun' && minutes >= 8 * 60 && minutes < close;
    return {
      open,
      text: open
        ? `Abierto ahora · Hasta las ${day === 'Sat' ? '16:00' : '18:00'}`
        : 'Cerrado ahora · Volvamos a brindar pronto',
    };
  }
  const status = document.querySelector('#opening-status');
  /** Actualiza el texto y el indicador visual sin exigir que exista la tarjeta de horario. */
  function updateHours() {
    if (!status) return;
    const state = getOpeningState(new Date());
    status.textContent = state.text;
    status.closest('.hours-card').classList.toggle('is-open', state.open);
  }
  updateHours();
  // Se actualiza cada minuto visible y de inmediato al volver a esta pestaña.
  setInterval(() => {
    if (!document.hidden) updateHours();
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateHours();
  });
  // Los cursores solo se activan con un puntero preciso; no alteran la interacción táctil.
  if (matchMedia('(pointer:fine)').matches) {
    const sprites = ['point', 'bottle', 'sip'];
    // Se esperan las tres imágenes antes de activar la clase que las utiliza.
    // Si alguna falla, el cursor nativo continúa disponible como alternativa.
    Promise.all(
      sprites.map(
        (name) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = `assets/cursor-${name}-48.png`;
          }),
      ),
    )
      .then(() => document.documentElement.classList.add('cursor-ready'))
      .catch(() => {});
    // Los estados de pulsación y desplazamiento los representa CSS con archivos PNG locales.
    let scrollTimer;
    addEventListener(
      'pointerdown',
      (e) => {
        if (e.button === 0) document.documentElement.classList.add('cursor-pressed');
      },
      { passive: true },
    );
    /** Retira la pulsación incluso si el gesto se cancela o la ventana pierde el foco. */
    const release = () => document.documentElement.classList.remove('cursor-pressed');
    addEventListener('pointerup', release, { passive: true });
    addEventListener('pointercancel', release, { passive: true });
    addEventListener('blur', release);
    // El temporizador se reinicia con cada evento y devuelve el cursor a reposo al detenerse.
    addEventListener(
      'scroll',
      () => {
        if (document.documentElement.classList.contains('motion-paused')) return;
        document.documentElement.classList.add('cursor-scrolling');
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(
          () => document.documentElement.classList.remove('cursor-scrolling'),
          180,
        );
      },
      { passive: true },
    );
  }
})();
