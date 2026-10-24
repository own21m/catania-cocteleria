/**
 * Constructor local de pedidos y consultas para WhatsApp.
 * Las selecciones se conservan en memoria; el sitio prepara un enlace y nunca
 * envía mensajes automáticamente ni confirma precios o disponibilidad.
 */
(() => {
  'use strict';
  const icon = window.CataniaIcon;
  /**
   * Productos disponibles para seleccionar, incluidos dos sin foto de catálogo.
   * Los id deben coincidir con data-order-product de app.js.
   * detail solo incluye presentaciones confirmadas; los precios se consultan por WhatsApp.
   */
  const menu = [
    {
      id: 'sangria',
      name: 'Sangría artesanal de frutos rojos',
      detail: '1000 ml · Con alcohol',
      image: '6928',
      color: '#ff4777',
    },
    {
      id: 'margarita',
      name: 'Margarita',
      detail: 'Cóctel artesanal · Con alcohol',
      image: '6945',
      color: '#efdf8c',
    },
    {
      id: 'mojito',
      name: 'Mojito',
      detail: '750 ml · Con alcohol',
      image: '6939',
      color: '#b5e870',
    },
    {
      id: 'daiquiri',
      name: 'Daiquirí de fresa',
      detail: '750 ml · Con alcohol',
      image: '6936',
      color: '#ff6179',
    },
    {
      id: 'lychee',
      name: 'Cóctel de lychee',
      detail: 'Cóctel artesanal · Con alcohol',
      color: '#f7acdc',
    },
    {
      id: 'sangria-sin-alcohol',
      name: 'Sangría sin alcohol',
      detail: 'Frutal · Sin alcohol',
      color: '#fa7099',
    },
    {
      id: 'maracuya',
      name: 'Soda de maracuyá',
      detail: '400 ml · Sin alcohol',
      image: '6940',
      color: '#ffd22d',
    },
    {
      id: 'soda-rojos',
      name: 'Soda de frutos rojos',
      detail: '400 ml · Sin alcohol',
      image: '6941',
      color: '#ff5279',
    },
    {
      id: 'mango',
      name: 'Soda de mango biche',
      detail: '400 ml · Sin alcohol',
      image: '6942',
      color: '#afe455',
    },
  ];
  // Las cantidades válidas y los errores de escritura se guardan por separado.
  // Esto impide incorporar al mensaje valores negativos, decimales o fuera de 0 a 99.
  const quantity = Object.fromEntries(menu.map((product) => [product.id, 0]));
  const invalidQuantities = new Set();
  let returnFocus = null;

  /** Renderiza una foto disponible o el motivo SVG de las bebidas sin fotografía. */
  function renderProductThumbnail(product) {
    if (product.image) {
      return /* HTML */ `
        <img
          src="assets/cutout-${product.image}.webp"
          alt=""
          width="48"
          height="70"
          loading="lazy"
        />
      `;
    }
    return /* HTML */ `<span aria-hidden="true">${icon('flower')}</span>`;
  }

  // Esta estructura utiliza únicamente textos fijos y las fichas anteriores.
  // El nombre y la consulta escritos por la persona nunca se insertan como HTML.
  const shell = document.createElement('div');
  shell.innerHTML = /* HTML */ ` <button
      class="contact-float"
      type="button"
      data-open-order
      aria-haspopup="dialog"
      aria-controls="order-dialog"
    >
      <span class="contact-bubbles" aria-hidden="true"
        ><i></i><i></i><i></i><i></i><i></i><i></i
      ></span>
      <span class="contact-float-icon" aria-hidden="true"
        ><svg viewBox="0 0 24 24" fill="none">
          <path
            d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.8A8.5 8.5 0 1 1 20.5 11.7Z"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M8.6 7.8c-.8.2-1 1.1-.7 2 .8 2.5 2.8 4.4 5.4 5.2.8.2 1.9-.1 2.1-1 .1-.3-.1-.5-.4-.7l-1.5-.7c-.2-.1-.4 0-.6.2l-.6.7a7 7 0 0 1-3.2-3.1l.6-.7c.2-.2.2-.4.1-.6l-.6-1.4c-.1-.2-.3-.3-.6-.2Z"
            fill="currentColor"
          /></svg
      ></span>
      <span class="contact-float-label">CONTÁCTANOS</span>
      <span class="contact-float-count" hidden>0</span>
    </button>
    <dialog
      class="order-dialog"
      id="order-dialog"
      aria-labelledby="order-title"
      aria-describedby="order-description"
    >
      <div class="order-topline">
        <span>CATANIA · UN BUEN PLAN EMPIEZA AQUÍ</span
        ><button class="order-close" type="button" aria-label="Cerrar y volver a la página">
          ${icon('close')}
        </button>
      </div>
      <div class="order-heading">
        <p class="order-kicker">TÚ ELIGES. NOSOTROS LO PREPARAMOS.</p>
        <h2 id="order-title">Arma tu <em>brindis.</em></h2>
        <p id="order-description">
          Elige tus sabores y cantidades. Te llevamos a WhatsApp con el mensaje listo.
        </p>
      </div>
      <form class="order-form" novalidate>
        <div class="order-builder">
          <div class="order-list-heading">
            <h3>¿Qué se te antoja?</h3>
            <span>CANTIDAD</span>
          </div>
          <p class="order-sr" id="order-quantity-help">
            Usa los botones o escribe una cantidad entera entre 0 y 99.
          </p>
          <div class="order-product-list">
            ${menu
              .map(
                (product) =>
                  /* HTML */ `<div
                    class="order-product"
                    data-order-row="${product.id}"
                    style="--order-accent:${product.color}"
                  >
                    <div class="order-thumbnail">${renderProductThumbnail(product)}</div>
                    <div class="order-product-copy">
                      <label for="order-quantity-${product.id}">${product.name}</label
                      ><span>${product.detail}</span
                      ><small class="order-quantity-error" id="order-error-${product.id}" hidden
                        >Usa un número entero de 0 a 99.</small
                      >
                    </div>
                    <div class="order-stepper">
                      <button
                        type="button"
                        data-step="-1"
                        data-step-product="${product.id}"
                        aria-label="Quitar una unidad de ${product.name}"
                        disabled
                      >
                        ${icon('minus')}</button
                      ><input
                        type="number"
                        id="order-quantity-${product.id}"
                        data-quantity="${product.id}"
                        value="0"
                        min="0"
                        max="99"
                        step="1"
                        inputmode="numeric"
                        aria-describedby="order-quantity-help order-error-${product.id}"
                      /><button
                        type="button"
                        data-step="1"
                        data-step-product="${product.id}"
                        aria-label="Añadir una unidad de ${product.name}"
                      >
                        ${icon('plus')}
                      </button>
                    </div>
                  </div>`,
              )
              .join('')}
          </div>
          <div class="order-personalize">
            <label for="order-name">Tu nombre <span>(opcional)</span></label
            ><input
              type="text"
              id="order-name"
              name="name"
              maxlength="80"
              autocomplete="given-name"
              placeholder="¿Cómo te llamas?"
            />
            <label for="order-note">Dale tu toque <span>(opcional)</span></label
            ><textarea
              id="order-note"
              name="message"
              maxlength="600"
              rows="3"
              placeholder="Cuéntanos para cuándo lo necesitas, tu plan o cualquier pregunta…"
            ></textarea
            ><span class="order-note-count" aria-hidden="true">0 / 600</span>
          </div>
        </div>
        <aside class="order-summary" aria-labelledby="order-summary-title">
          <div class="order-summary-sticky">
            <p class="order-kicker">ASÍ LLEGARÁ A WHATSAPP</p>
            <h3 id="order-summary-title">Tu mensaje, <em>listo.</em></h3>
            <div class="order-message">
              <span class="order-message-brand"
                >Catania <span aria-hidden="true">${icon('flower')}</span></span
              >
              <pre class="order-message-text"></pre>
              <span class="order-message-check" aria-hidden="true">${icon('check-double')}</span>
            </div>
            <p class="order-summary-count" aria-live="polite" aria-atomic="true">
              Sin productos seleccionados
            </p>
            <p class="order-availability">
              Confirmaremos disponibilidad, presentación y valor por WhatsApp.
            </p>
            <div class="order-social">
              <span>¿Prefieres inspirarte?</span
              ><a
                href="https://www.instagram.com/cataniacocteleria/"
                target="_blank"
                rel="noopener noreferrer"
                >@cataniacocteleria <span aria-hidden="true">${icon('arrow-up-right')}</span></a
              >
            </div>
          </div>
        </aside>
        <div class="order-actions">
          <div>
            <p class="order-feedback" role="status" aria-live="polite"></p>
            <p class="order-handoff">WhatsApp abrirá el mensaje. Tú decides cuándo enviarlo.</p>
          </div>
          <a class="order-whatsapp" target="_blank" rel="noopener noreferrer" aria-disabled="true"
            >Continuar a WhatsApp <span aria-hidden="true">${icon('arrow-up-right')}</span></a
          >
        </div>
      </form>
    </dialog>`;
  while (shell.firstChild) document.body.append(shell.firstChild);

  // Las consultas se limitan al diálogo de pedido para no capturar controles del detalle de producto.
  const orderDialog = document.querySelector('#order-dialog');
  const orderForm = orderDialog.querySelector('form');
  const nameInput = orderDialog.querySelector('#order-name');
  const noteInput = orderDialog.querySelector('#order-note');
  const preview = orderDialog.querySelector('.order-message-text');
  const feedback = orderDialog.querySelector('.order-feedback');
  const continueLink = orderDialog.querySelector('.order-whatsapp');
  const floatCount = document.querySelector('.contact-float-count');
  /** Localiza el campo de cantidad asociado a un identificador estable del menú. */
  const inputFor = (id) => orderDialog.querySelector(`[data-quantity="${id}"]`);

  /**
   * Construye texto plano con las unidades elegidas, el nombre y la consulta opcional.
   * La misma salida alimenta la vista previa y el enlace externo de WhatsApp.
   */
  function messageText() {
    const name = nameInput.value.trim().slice(0, 80);
    const note = noteInput.value.trim().slice(0, 600);
    const selected = menu.filter((product) => quantity[product.id] > 0);
    const lines = [name ? `¡Hola, Catania! Soy ${name}.` : '¡Hola, Catania!'];
    if (selected.length) {
      lines.push('', 'Me gustaría pedir:');
      selected.forEach((product, index) => {
        const volume = product.detail.match(/\d+ ml/);
        lines.push(
          `${index + 1}. ${product.name}${volume ? ` (${volume[0]})` : ''} — ${quantity[product.id]} ${quantity[product.id] === 1 ? 'unidad' : 'unidades'}`,
        );
      });
      lines.push('', '¿Me confirman disponibilidad y valor, por favor?');
    }
    if (note) lines.push('', note);
    if (!selected.length && !note)
      lines.push('', 'Quisiera conocer más sobre sus bebidas artesanales.');
    return lines.join('\n');
  }

  /** Permite un pedido con bebidas o una consulta escrita, siempre sin cantidades inválidas. */
  function canContinue() {
    return (
      invalidQuantities.size === 0 &&
      (Object.values(quantity).some((count) => count > 0) || noteInput.value.trim().length > 0)
    );
  }

  /** Sincroniza mensaje, contador, enlace y estados accesibles a partir del modelo local. */
  function updatePreview() {
    const count = Object.values(quantity).reduce((sum, value) => sum + value, 0);
    // textContent conserva el texto escrito sin interpretarlo como etiquetas o instrucciones.
    preview.textContent = messageText();
    continueLink.href = `https://wa.me/573206656100?text=${encodeURIComponent(messageText())}`;
    continueLink.setAttribute('aria-disabled', String(!canContinue()));
    orderDialog.querySelector('.order-summary-count').textContent = count
      ? `${count} ${count === 1 ? 'bebida seleccionada' : 'bebidas seleccionadas'}`
      : 'Sin productos seleccionados';
    floatCount.textContent = String(count);
    floatCount.hidden = count === 0;
    document
      .querySelector('.contact-float')
      .setAttribute(
        'aria-label',
        `Contáctanos${count ? `, ${count} ${count === 1 ? 'bebida seleccionada' : 'bebidas seleccionadas'}` : ''}`,
      );
    orderDialog.querySelector('.order-note-count').textContent = `${noteInput.value.length} / 600`;
    if (canContinue()) feedback.textContent = '';
  }

  /** Resalta la fila seleccionada y evita restar de cero o superar el máximo desde los botones. */
  function syncStepper(id) {
    const row = orderDialog.querySelector(`[data-order-row="${id}"]`);
    row.classList.toggle('is-selected', quantity[id] > 0);
    row.querySelector('[data-step="-1"]').disabled =
      quantity[id] === 0 && !invalidQuantities.has(id);
    row.querySelector('[data-step="1"]').disabled = quantity[id] === 99;
  }

  /** Actualiza una cantidad desde los botones y retira cualquier error anterior del campo. */
  function setQuantity(id, value) {
    if (!(id in quantity)) return;
    quantity[id] = Math.max(0, Math.min(99, value));
    invalidQuantities.delete(id);
    const input = inputFor(id);
    input.value = String(quantity[id]);
    input.removeAttribute('aria-invalid');
    orderDialog.querySelector(`#order-error-${id}`).hidden = true;
    syncStepper(id);
    updatePreview();
  }

  /** Explica el primer problema y lleva el foco al campo que permite resolverlo. */
  function validate() {
    if (invalidQuantities.size) {
      feedback.textContent = 'Revisa las cantidades: usa números enteros de 0 a 99.';
      inputFor([...invalidQuantities][0]).focus();
      return false;
    }
    if (!canContinue()) {
      feedback.textContent = 'Elige al menos una bebida o escribe tu consulta para continuar.';
      noteInput.focus();
      return false;
    }
    feedback.textContent = '';
    return true;
  }

  /**
   * Abre el pedido y, si se llega desde una bebida, suma una unidad a su selección.
   * Cierra otros diálogos antes de trasladar el foco al nuevo contexto modal.
   */
  function openOrder(productId, opener) {
    if (!orderDialog.open) returnFocus = opener || document.activeElement;
    document.querySelectorAll('dialog[open]').forEach((other) => {
      if (other !== orderDialog) other.close();
    });
    if (productId in quantity) setQuantity(productId, quantity[productId] + 1);
    if (!orderDialog.open) orderDialog.showModal();
    // El evento close del detalle anterior puede ejecutarse en una tarea posterior.
    // Se reafirma el bloqueo mientras este modal siga abierto para evitar una carrera visual.
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
      if (!orderDialog.open) return;
      document.body.classList.add('modal-open');
      if (productId in quantity) inputFor(productId).focus();
      else orderDialog.querySelector('.order-close').focus({ preventScroll: true });
    });
    setTimeout(() => {
      if (orderDialog.open) document.body.classList.add('modal-open');
    }, 0);
    updatePreview();
  }

  /** Deja al evento close la limpieza del bloqueo y la devolución del foco. */
  function closeOrder() {
    orderDialog.close();
  }
  // La delegación permite abrir el pedido desde controles generados por otros módulos.
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-order], [data-order-product]');
    if (!trigger || orderDialog.contains(trigger)) return;
    event.preventDefault();
    openOrder(trigger.dataset.orderProduct, trigger);
  });
  document.addEventListener('catania:order', (event) =>
    openOrder(event.detail?.productId, document.activeElement),
  );
  orderDialog.querySelector('.order-close').addEventListener('click', closeOrder);
  // Solo se interpreta como cierre un clic real sobre el fondo exterior del diálogo.
  orderDialog.addEventListener('click', (event) => {
    if (event.target !== orderDialog) return;
    const bounds = orderDialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      closeOrder();
  });
  // Un disparador dentro de otro modal ya cerrado no puede recuperar el foco.
  // En ese caso se utiliza el botón flotante, que permanece disponible en la página.
  orderDialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    const fallback = document.querySelector('.contact-float');
    const focusTarget =
      returnFocus?.isConnected && !returnFocus.closest('dialog:not([open])')
        ? returnFocus
        : fallback;
    focusTarget?.focus({ preventScroll: true });
  });
  // Los botones comparten el mismo actualizador que mantiene el modelo y la interfaz alineados.
  orderDialog.querySelectorAll('[data-step]').forEach((button) =>
    button.addEventListener('click', () => {
      const id = button.dataset.stepProduct;
      setQuantity(id, quantity[id] + Number(button.dataset.step));
    }),
  );
  // La escritura se valida sin corregirla silenciosamente: se muestra el error y se bloquea la salida.
  orderDialog.querySelectorAll('[data-quantity]').forEach((input) => {
    input.addEventListener('input', () => {
      const id = input.dataset.quantity;
      const raw = input.value;
      const valid = !input.validity.badInput && (raw === '' || /^\d{1,2}$/.test(raw));
      if (valid) {
        quantity[id] = raw === '' ? 0 : Number(raw);
        invalidQuantities.delete(id);
        input.removeAttribute('aria-invalid');
      } else {
        quantity[id] = 0;
        invalidQuantities.add(id);
        input.setAttribute('aria-invalid', 'true');
      }
      orderDialog.querySelector(`#order-error-${id}`).hidden = valid;
      syncStepper(id);
      updatePreview();
    });
    // Un campo vacío se interpreta como cero cuando la persona termina de editarlo.
    input.addEventListener('blur', () => {
      if (input.value === '' && !input.validity.badInput) setQuantity(input.dataset.quantity, 0);
    });
  });
  // El nombre y la consulta actualizan la vista previa sin abrir servicios externos.
  nameInput.addEventListener('input', updatePreview);
  noteInput.addEventListener('input', updatePreview);
  // El envío sigue siendo una acción explícita en WhatsApp; aquí solo se valida y abre el enlace.
  // El formulario comparte esta ruta para mantener el mismo resultado al usar el teclado.
  continueLink.addEventListener('click', (event) => {
    if (!validate()) event.preventDefault();
  });
  orderForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (validate()) continueLink.click();
  });
  updatePreview();
})();
