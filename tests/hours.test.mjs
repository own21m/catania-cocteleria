/** Verifica límites del horario real en Colombia usando fechas UTC independientes del equipo. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parsers } from 'prettier/plugins/babel';

const source = await readFile(new URL('../dist/interface.js', import.meta.url), 'utf8');
const ast = parsers.babel.parse(source, { sourceType: 'script' });

/** Busca la declaración por AST para que la documentación y el formato puedan cambiar libremente. */
function findOpeningState(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'FunctionDeclaration' && node.id?.name === 'getOpeningState') return node;
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findOpeningState(item);
        if (found) return found;
      }
    } else if (child && typeof child === 'object') {
      const found = findOpeningState(child);
      if (found) return found;
    }
  }
  return null;
}

const declaration = findOpeningState(ast);
assert.ok(declaration, 'Debe existir getOpeningState en interface.js');
const context = vm.createContext({ Intl, Date });
vm.runInContext(source.slice(declaration.start, declaration.end), context);
const openingState = (utc) => context.getOpeningState(new Date(utc));

test('De lunes a viernes abre a las 08:00 y cierra exactamente a las 18:00 de Bogotá', () => {
  for (const day of ['2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']) {
    assert.equal(openingState(`${day}T12:59:00Z`).open, false, `${day}, 07:59 en Colombia`);
    assert.equal(openingState(`${day}T13:00:00Z`).open, true, `${day}, 08:00 en Colombia`);
    assert.equal(openingState(`${day}T22:59:00Z`).open, true, `${day}, 17:59 en Colombia`);
    assert.equal(openingState(`${day}T23:00:00Z`).open, false, `${day}, 18:00 en Colombia`);
  }
  assert.ok(openingState('2026-10-23T13:00:00Z').text.includes('18:00'));
});

test('El sábado conserva la apertura y adelanta el cierre a las 16:00', () => {
  assert.equal(openingState('2026-10-24T12:59:00Z').open, false);
  assert.equal(openingState('2026-10-24T13:00:00Z').open, true);
  assert.equal(openingState('2026-10-24T20:59:00Z').open, true);
  assert.equal(openingState('2026-10-24T21:00:00Z').open, false);
  assert.ok(openingState('2026-10-24T13:00:00Z').text.includes('16:00'));
});

test('El domingo permanece cerrado durante todo el día local', () => {
  for (const utc of [
    '2026-10-25T05:00:00Z',
    '2026-10-25T13:00:00Z',
    '2026-10-25T18:00:00Z',
    '2026-10-26T04:59:00Z',
  ]) {
    assert.equal(openingState(utc).open, false, utc);
  }
});

test('La medianoche UTC no cambia antes de tiempo el día comercial de Colombia', () => {
  // El sábado 00:30 UTC todavía es viernes 19:30 en Bogotá; el negocio ya cerró a las 18:00.
  assert.equal(openingState('2026-10-24T00:30:00Z').open, false);
  assert.equal(openingState('2026-10-26T13:00:00Z').open, true);
});
