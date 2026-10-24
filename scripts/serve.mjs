/**
 * Vista previa local sin compilación ni dependencias de servidor.
 * Entrega los archivos de dist tal como están guardados y escucha solo en este equipo.
 * Uso: npm start -- --port 4174
 */
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = await realpath(path.join(projectRoot, 'dist'));
const host = '127.0.0.1';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

/** Acepta un puerto explícito y rechaza opciones desconocidas para detectar errores de uso. */
function readPort(args) {
  if (args.length === 0) return 4173;
  const value =
    args.length === 2 && args[0] === '--port'
      ? args[1]
      : args.length === 1 && args[0].startsWith('--port=')
        ? args[0].slice('--port='.length)
        : '';
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(
      'Uso: node scripts/serve.mjs [--port 4173]. El puerto debe estar entre 1 y 65535.',
    );
  }
  return Number(value);
}

/** Compara rutas resueltas; también se aplica después de seguir un posible enlace simbólico. */
function insidePublicRoot(filename) {
  const relative = path.relative(publicRoot, filename);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

/** Las respuestas de error son texto fijo y nunca reflejan la ruta recibida. */
function sendText(response, method, statusCode, message, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(message),
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  response.end(method === 'HEAD' ? undefined : message);
}

let port;
try {
  port = readPort(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const server = createServer(async (request, response) => {
  const method = request.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    sendText(response, method, 405, 'Método no permitido.\n', { Allow: 'GET, HEAD' });
    return;
  }

  // Se decodifica una sola vez y se valida antes de resolver la ruta en Windows, macOS o Linux.
  let pathname;
  try {
    pathname = decodeURIComponent((request.url || '/').split(/[?#]/, 1)[0]);
  } catch {
    sendText(response, method, 400, 'Ruta no válida.\n');
    return;
  }
  if (!pathname.startsWith('/') || /[\u0000\\:]/.test(pathname)) {
    sendText(response, method, 400, 'Ruta no válida.\n');
    return;
  }
  let filename = path.resolve(publicRoot, pathname.replace(/^\/+/, ''));
  if (!insidePublicRoot(filename)) {
    sendText(response, method, 403, 'Acceso no permitido.\n');
    return;
  }

  try {
    // Los directorios sirven su index.html; realpath impide escapar mediante enlaces simbólicos.
    let metadata = await stat(filename);
    if (metadata.isDirectory()) filename = path.join(filename, 'index.html');
    filename = await realpath(filename);
    if (!insidePublicRoot(filename)) {
      sendText(response, method, 403, 'Acceso no permitido.\n');
      return;
    }
    metadata = await stat(filename);
    if (!metadata.isFile()) {
      sendText(response, method, 404, 'Archivo no encontrado.\n');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Content-Length': metadata.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (method === 'HEAD') {
      response.end();
      return;
    }
    // El flujo conserva los bytes originales: no transforma, comprime ni minifica el contenido.
    const stream = createReadStream(filename);
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  } catch (error) {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const missing = ['ENOENT', 'ENOTDIR'].includes(error.code);
    sendText(
      response,
      method,
      missing ? 404 : 500,
      missing ? 'Archivo no encontrado.\n' : 'No se pudo leer el archivo.\n',
    );
  }
});

server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `El puerto ${port} ya está ocupado. Prueba con npm start -- --port ${port + 1}.`
      : `No se pudo iniciar la vista previa: ${error.message}`,
  );
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`Catania disponible en http://${host}:${port}`));

// Ctrl+C y la terminación normal liberan el puerto sin dejar el proceso en segundo plano.
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
