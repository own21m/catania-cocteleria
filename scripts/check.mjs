/**
 * Comprobaciones locales del sitio sin generar ni modificar archivos.
 * Revisa sintaxis JavaScript, dependencias HTML locales, IDs duplicados y configuración JSON.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(projectRoot, 'dist');
const errors = [];
const displayPath = (filename) => path.relative(projectRoot, filename).split(path.sep).join('/');

/** Recorre solo los directorios indicados; no entra en dependencias ni metadatos de Git. */
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map((entry) => {
      const filename = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(filename) : entry.isFile() ? [filename] : [];
    }),
  );
  return groups.flat().sort();
}

/** Cada archivo se analiza con el mismo Node que ejecuta la comprobación. */
function checkJavaScript(filename) {
  const result = spawnSync(process.execPath, ['--check', filename], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    errors.push(
      `Sintaxis en ${displayPath(filename)}:\n${result.error?.message || result.stderr.trim()}`,
    );
  }
}

/** Comprueba un destino local; los esquemas externos, fragmentos y parámetros no son archivos. */
async function checkDependency(htmlFile, value) {
  const reference = value.trim().replace(/&amp;/gi, '&');
  if (
    !reference ||
    reference.startsWith('#') ||
    reference.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(reference)
  )
    return;
  let localPath;
  try {
    localPath = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  } catch {
    errors.push(`${displayPath(htmlFile)}: dirección local mal codificada: ${reference}`);
    return;
  }
  if (!localPath) return;
  const filename = localPath.startsWith('/')
    ? path.resolve(publicRoot, localPath.slice(1))
    : path.resolve(path.dirname(htmlFile), localPath);
  const relative = path.relative(publicRoot, filename);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    errors.push(`${displayPath(htmlFile)}: referencia fuera de dist: ${reference}`);
    return;
  }
  try {
    const metadata = await stat(filename);
    if (metadata.isDirectory()) await stat(path.join(filename, 'index.html'));
  } catch {
    errors.push(`${displayPath(htmlFile)}: falta ${reference} (${displayPath(filename)})`);
  }
}

/** Recorre etiquetas y atributos respetando valores entre comillas; ignora comentarios HTML. */
async function checkHTML(filename) {
  const html = (await readFile(filename, 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
  const ids = new Set();
  const dependencies = [];
  const tags = html.matchAll(/<[a-z][\w:-]*\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi);
  for (const [tag] of tags) {
    const attributes = tag.matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g);
    for (const attribute of attributes) {
      const name = attribute[1].toLowerCase();
      const value = attribute[2] ?? attribute[3] ?? attribute[4];
      if (name === 'id') {
        if (ids.has(value)) errors.push(`${displayPath(filename)}: ID HTML duplicado: ${value}`);
        ids.add(value);
      }
      if (name === 'src' || name === 'href') dependencies.push(checkDependency(filename, value));
    }
  }
  await Promise.all(dependencies);
}

/** Una configuración inválida informa su archivo y el error exacto del analizador JSON. */
async function checkJSON(filename) {
  try {
    JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    errors.push(`JSON en ${displayPath(filename)}: ${error.message}`);
  }
}

try {
  const directories = ['dist', 'scripts', 'tests'];
  const files = (
    await Promise.all(directories.map((name) => filesIn(path.join(projectRoot, name))))
  ).flat();
  const javascript = files.filter((filename) => /\.(?:js|mjs|cjs)$/i.test(filename));
  const html = files.filter(
    (filename) => filename.startsWith(`${publicRoot}${path.sep}`) && /\.html$/i.test(filename),
  );
  const json = files.filter((filename) => /\.json$/i.test(filename));
  // Estas configuraciones viven fuera de dist y pueden existir según la forma de publicación.
  for (const name of ['package.json', '.prettierrc.json', '.openai/hosting.json']) {
    const filename = path.join(projectRoot, name);
    try {
      await stat(filename);
      json.push(filename);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  javascript.forEach(checkJavaScript);
  await Promise.all([...html.map(checkHTML), ...json.map(checkJSON)]);
  if (errors.length) {
    console.error(`${errors.length} problema(s) encontrado(s):\n\n${errors.join('\n\n')}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Comprobación correcta: ${javascript.length} archivos JavaScript, ${html.length} HTML y ${json.length} JSON.`,
    );
  }
} catch (error) {
  console.error(`No se pudieron completar las comprobaciones: ${error.message}`);
  process.exitCode = 1;
}
