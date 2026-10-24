/**
 * Iconos SVG locales compartidos por los controles y las composiciones decorativas.
 * La geometría explícita evita diferencias de dibujo entre sistemas operativos.
 * El color y el tamaño se heredan de icons.css y del contexto donde se insertan.
 */
(() => {
  'use strict';
  // Vocabulario cerrado: solo se pueden solicitar los nombres definidos aquí.
  // Las rutas son datos de dibujo SVG y no contienen contenido procedente de visitantes.
  const paths = {
    'arrow-up-right': /* HTML */ `<path d="M6 18 18 6M6 6h12v12" />`,
    'arrow-down': /* HTML */ `<path d="M12 4v16m-7-7 7 7 7-7" />`,
    'arrow-up': /* HTML */ `<path d="M12 20V4m-7 7 7-7 7 7" />`,
    plus: /* HTML */ `<path d="M12 5v14M5 12h14" />`,
    minus: /* HTML */ `<path d="M5 12h14" />`,
    close: /* HTML */ `<path d="m6 6 12 12M18 6 6 18" />`,
    flower: /* HTML */ `<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07 19.07 4.93" />`,
    spark: /* HTML */ `<path
      d="M12 1c0 8-3 11-11 11 8 0 11 3 11 11 0-8 3-11 11-11-8 0-11-3-11-11Z"
    />`,
    pause: /* HTML */ `<path class="icon-fill" d="M6 4h4v16H6zm8 0h4v16h-4z" />`,
    play: /* HTML */ `<path class="icon-fill" d="m7 3 14 9-14 9z" />`,
    'check-double': /* HTML */ `<path d="m2 12 4 4L16 5m-6 9 2 2L22 5" />`,
  };
  /**
   * Devuelve un SVG decorativo del vocabulario, o una cadena vacía si el nombre no existe.
   * aria-hidden evita duplicar el nombre accesible que ya aporta el botón o enlace.
   */
  window.CataniaIcon = (name) =>
    Object.prototype.hasOwnProperty.call(paths, name)
      ? /* HTML */ `<svg
          class="ui-icon icon-${name}"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden="true"
          focusable="false"
        >
          ${paths[name]}
        </svg>`
      : '';
})();
