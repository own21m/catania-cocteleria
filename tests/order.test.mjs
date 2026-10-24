/**
 * Pruebas del pedido con las funciones reales del sitio.
 * El AST identifica cada declaración sin depender del formato, las líneas ni los comentarios.
 * La VM sustituye únicamente los campos y nodos del navegador; no abre WhatsApp.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parsers } from 'prettier/plugins/babel';

const source = await readFile(new URL('../dist/contact.js', import.meta.url), 'utf8');
const ast = parsers.babel.parse(source, { sourceType: 'script' });

/** Busca un nodo por su estructura; no interpreta ni ejecuta el módulo completo del navegador. */
function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findNode(item, predicate);
        if (found) return found;
      }
    } else if (child && typeof child === 'object') {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

/** La prueba falla con un mensaje concreto si se renombra o elimina una función necesaria. */
function functionSource(name) {
  const node = findNode(
    ast,
    (item) => item.type === 'FunctionDeclaration' && item.id?.name === name,
  );
  assert.ok(node, `Debe existir la función ${name} en contact.js`);
  return source.slice(node.start, node.end);
}

const menuNode = findNode(
  ast,
  (node) => node.type === 'VariableDeclarator' && node.id?.name === 'menu',
);
assert.ok(menuNode?.init, 'Debe existir el catálogo del formulario en contact.js');
const inputListener = findNode(
  ast,
  (node) =>
    node.type === 'CallExpression' &&
    node.callee?.object?.name === 'input' &&
    node.callee?.property?.name === 'addEventListener' &&
    node.arguments[0]?.value === 'input',
);
assert.ok(inputListener?.arguments[1], 'Debe existir la validación del campo de cantidad');
const quantityHandler = inputListener.arguments[1];

/** Cada prueba recibe estado nuevo para evitar que una selección altere los casos siguientes. */
function createOrder() {
  const nodes = new Map();
  const fields = new Map();
  const element = (selector) => {
    if (!nodes.has(selector)) {
      nodes.set(selector, {
        hidden: false,
        textContent: '',
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
      });
    }
    return nodes.get(selector);
  };
  const context = vm.createContext({
    nameInput: { value: '' },
    noteInput: { value: '' },
    invalidQuantities: new Set(),
    preview: { textContent: '' },
    continueLink: element('continue'),
    floatCount: element('count'),
    feedback: element('feedback'),
    document: { querySelector: element },
    orderDialog: { querySelector: element },
    inputFor: (id) => fields.get(id),
    syncStepper: () => {},
  });
  context.menu = vm.runInContext(
    `(${source.slice(menuNode.init.start, menuNode.init.end)})`,
    context,
  );
  context.quantity = Object.fromEntries(context.menu.map(({ id }) => [id, 0]));
  for (const { id } of context.menu) {
    fields.set(id, {
      dataset: { quantity: id },
      value: '0',
      validity: { badInput: false },
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
    });
  }
  vm.runInContext(
    ['messageText', 'canContinue', 'updatePreview', 'setQuantity'].map(functionSource).join('\n'),
    context,
  );
  context.input = fields.get('sangria');
  vm.runInContext(
    `globalThis.onQuantityInput = ${source.slice(quantityHandler.start, quantityHandler.end)};`,
    context,
  );
  return { context, fields, nodes };
}

test('Un formulario vacío o con solo un nombre no permite continuar', () => {
  const { context } = createOrder();
  assert.equal(context.menu.length, 9);
  assert.equal(context.canContinue(), false);
  context.nameInput.value = 'Ana';
  context.noteInput.value = '   ';
  assert.equal(context.canContinue(), false);
});

test('El mensaje enumera unidades y solo añade presentaciones conocidas', () => {
  const { context } = createOrder();
  context.nameInput.value = ' Ana & María ';
  context.quantity.sangria = 2;
  context.quantity.margarita = 1;
  context.quantity.lychee = 3;
  const message = context.messageText();
  assert.ok(message.startsWith('¡Hola, Catania! Soy Ana & María.'));
  assert.ok(message.includes('1. Sangría artesanal de frutos rojos (1000 ml) — 2 unidades'));
  assert.ok(message.includes('2. Margarita — 1 unidad'));
  assert.ok(message.includes('3. Cóctel de lychee — 3 unidades'));
  assert.ok(message.includes('¿Me confirman disponibilidad y valor, por favor?'));
  assert.equal(message.includes('undefined'), false);
});

test('Una consulta personalizada permite continuar y llega intacta al enlace de WhatsApp', () => {
  const { context } = createOrder();
  context.noteInput.value = '¿Entregan el sábado? <consulta> & gracias.';
  context.updatePreview();
  assert.equal(context.canContinue(), true);
  const link = new URL(context.continueLink.href);
  assert.equal(link.origin, 'https://wa.me');
  assert.equal(link.pathname, '/573206656100');
  assert.equal(link.searchParams.get('text'), context.messageText());
  assert.ok(context.preview.textContent.includes(context.noteInput.value));
  assert.equal(Object.hasOwn(context.preview, 'innerHTML'), false);
});

test('Nombre y consulta respetan los límites del mensaje incluso al asignarlos por código', () => {
  const { context } = createOrder();
  context.nameInput.value = 'N'.repeat(81);
  context.noteInput.value = 'M'.repeat(601);
  const message = context.messageText();
  assert.ok(message.includes(`Soy ${'N'.repeat(80)}.`));
  assert.equal(message.includes('N'.repeat(81)), false);
  assert.ok(message.endsWith('M'.repeat(600)));
  assert.equal(message.includes('M'.repeat(601)), false);
});

test('Los botones acotan cantidades y retiran el error del producto corregido', () => {
  const { context, fields, nodes } = createOrder();
  context.setQuantity('sangria', -5);
  assert.equal(context.quantity.sangria, 0);
  context.invalidQuantities.add('sangria');
  context.setQuantity('sangria', 120);
  assert.equal(context.quantity.sangria, 99);
  assert.equal(fields.get('sangria').value, '99');
  assert.equal(context.invalidQuantities.has('sangria'), false);
  assert.equal(nodes.get('#order-error-sangria').hidden, true);
  context.setQuantity('producto-inexistente', 4);
  assert.equal(Object.hasOwn(context.quantity, 'producto-inexistente'), false);
});

test('El campo rechaza decimales, negativos, exponentes y valores superiores a 99', () => {
  const { context, fields } = createOrder();
  const input = fields.get('sangria');
  context.noteInput.value = 'Una consulta válida no debe omitir el error de cantidad.';
  for (const value of ['1.5', '-1', '1e2', '100']) {
    input.value = value;
    context.onQuantityInput();
    assert.equal(context.canContinue(), false, `Cantidad inválida: ${value}`);
    assert.equal(input.attributes['aria-invalid'], 'true');
    assert.equal(context.quantity.sangria, 0);
  }
  input.value = '99';
  context.onQuantityInput();
  assert.equal(context.quantity.sangria, 99);
  assert.equal(context.canContinue(), true);
  assert.equal(Object.hasOwn(input.attributes, 'aria-invalid'), false);
  input.value = '';
  input.validity.badInput = true;
  context.onQuantityInput();
  assert.equal(context.canContinue(), false);
  input.validity.badInput = false;
  context.onQuantityInput();
  assert.equal(context.quantity.sangria, 0);
  assert.equal(context.canContinue(), true);
});
