/**
 * Fondo líquido de Catania.
 * WebGL calcula reflejos, refracción, ondas y burbujas en toda la pantalla.
 * Si la GPU no está disponible, Canvas 2D conserva una versión más sencilla.
 * Un único ciclo de animación respeta la pausa, la visibilidad y el movimiento reducido.
 * El desplazamiento de la página y sus controles siguen siendo nativos.
 */
(() => {
  'use strict';

  let canvas = document.querySelector('#liquid-canvas');
  if (!canvas) return;

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  // Utilidades numéricas compartidas por los dos motores de dibujo.
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const heroColor = [216 / 255, 46 / 255, 75 / 255];
  const accent = heroColor.slice();
  let targetAccent = heroColor.slice();
  // x/y son posiciones suavizadas; tx/ty reciben la posición más reciente del puntero.
  // Las ondas reutilizan cuatro registros en un anillo para evitar crear partículas sin límite.
  const pointer = { x: 0.69, y: 0.47, tx: 0.69, ty: 0.47, strength: 0, targetStrength: 0 };
  const ripples = Array.from({ length: 4 }, () => ({ x: 0, y: 0, born: -20, strength: 0 }));
  let rippleIndex = 0;
  let width = 1;
  let height = 1;
  let animationTime = 0;
  let previousTime = 0;
  let previousPaint = -Infinity;
  let frame = 0;
  let contextLost = false;
  let sceneDirty = true;
  let lastRippleTime = -10;
  let lastPointerX = pointer.tx;
  let lastPointerY = pointer.ty;
  let scenes = [];

  // El lienzo es decorativo: no entra en el árbol accesible ni intercepta eventos.
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.pointerEvents = 'none';
  root.style.setProperty('--mx', '0.6900');
  root.style.setProperty('--my', '0.4700');

  // La elección explícita del usuario tiene prioridad sobre la preferencia del sistema.
  function paused() {
    return (
      root.classList.contains('motion-paused') ||
      (!root.classList.contains('motion-enabled') && reduced.matches)
    );
  }

  // Solo admite colores hexadecimales de tres o seis dígitos; devuelve RGB entre 0 y 1.
  function parseColor(value) {
    const match = String(value || '')
      .trim()
      .match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (!match) return null;
    const full =
      match[1].length === 3 ? [...match[1]].map((char) => char + char).join('') : match[1];
    return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16) / 255);
  }

  // Registra las escenas y aplaza la medición de sus posiciones al siguiente cuadro.
  function refreshScenes() {
    scenes = [...document.querySelectorAll('.product-scene')];
    sceneDirty = true;
  }

  // La escena situada cerca del centro aporta el color del líquido.
  // Lejos del recorrido de productos, la luz vuelve al color inicial del encabezado.
  function updateScene() {
    if (!sceneDirty) return;
    sceneDirty = false;
    const center = height * 0.48;
    let nearest = null;
    let distance = Infinity;
    for (const scene of scenes) {
      const rect = scene.getBoundingClientRect();
      const nextDistance =
        center < rect.top ? rect.top - center : center > rect.bottom ? center - rect.bottom : 0;
      if (nextDistance < distance) {
        nearest = scene;
        distance = nextDistance;
      }
      if (nextDistance === 0) break;
    }
    if (nearest && distance < height * 0.75) {
      targetAccent =
        parseColor(nearest.dataset.accent) ||
        parseColor(getComputedStyle(nearest).getPropertyValue('--accent')) ||
        heroColor.slice();
    } else {
      targetAccent = heroColor.slice();
    }
    if (paused()) accent.splice(0, 3, ...targetAccent);
  }

  // Construye un programa de GPU sin profundidad ni suavizado, adecuado para un fondo.
  // Devuelve la misma interfaz resize/draw que utiliza el motor alternativo de Canvas.
  function createWebGLRenderer() {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
    if (!gl) return null;

    const vertexSource = `
      // Dos triángulos cubren el lienzo. vUv expresa coordenadas de textura entre 0 y 1.
      attribute vec2 aPosition;
      varying vec2 vUv;

      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      varying vec2 vUv;

      // Datos compartidos con JavaScript en cada cuadro:
      // resolución real, tiempo acumulado, RGB y puntero normalizado con su intensidad.
      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec3 uAccent;
      uniform vec3 uPointer;

      // Cada onda contiene origen x/y, edad en segundos e intensidad inicial.
      uniform vec4 uRipples[4];
      // Desplazamiento vertical medido en alturas de pantalla.
      uniform float uScroll;

      // Mezcla de ondas suaves para deformar las cintas luminosas sin usar texturas.
      float field(vec2 p) {
        return
          sin(p.x * 1.46 + sin(p.y * 1.7)) * .5 +
          sin(p.y * 1.83 - p.x * .71) * .28 +
          cos(p.x * 2.28 + p.y * 1.52) * .16;
      }

      // Distribución determinista: una misma semilla siempre sitúa la misma burbuja.
      float hash(float n) {
        return fract(sin(n * 127.1) * 4375.5453);
      }

      void main() {
        // Corregir la proporción mantiene redondas las ondas en cualquier pantalla.
        vec2 uv = vUv;
        float aspect = uResolution.x / uResolution.y;
        vec2 p = (uv - .5) * vec2(aspect, 1.0);
        vec2 mouse = (uPointer.xy - .5) * vec2(aspect, 1.0);
        float time = uTime * .105;
        float dMouse = length(p - mouse);
        vec2 drift = vec2(time * .24, -time * .39 + uScroll * .055);
        vec2 q = p * 3.15 + drift;
        q += vec2(field(q * .73 + time * .17), field(q * .62 - 2.0)) * .43;

        // Una lente amplia alrededor del puntero desvía las mismas cintas del líquido.
        float lens = exp(-dMouse * dMouse * 13.0) * uPointer.z;
        q += (p - mouse) * lens * 1.15;
        float rippleLight = 0.0;

        // Los frentes circulares se expanden y pierden intensidad de forma exponencial.
        for (int i = 0; i < 4; i++) {
          vec4 ripple = uRipples[i];
          float age = ripple.z;
          vec2 origin = (ripple.xy - .5) * vec2(aspect, 1.0);
          float distance = length(p - origin);
          float radius = age * .17;
          float front = exp(-pow((distance - radius) * 23.0, 2.0));
          float envelope = exp(-age * 1.25) * ripple.w;
          float wave = sin((distance - radius) * 46.0) * front * envelope;
          q += normalize(p - origin + vec2(.0001)) * wave * .065;
          rippleLight += front * envelope * .07;
        }

        // Los pliegues de luz combinan zonas suaves, líneas finas y sombras profundas.
        float f = field(q + vec2(0.0, time * .31));
        float fold = abs(sin(q.x * .62 + q.y * .31 + f * 1.75 + time * .16));
        float fold2 = abs(sin(q.x * .38 - q.y * .71 + field(q + 4.1) * 1.2));
        float ribbon = pow(1.0 - fold, 10.0);
        float hairline = pow(1.0 - fold, 54.0);
        float secondary = pow(1.0 - fold2, 18.0);
        float body = exp(-pow((p.x - .36 + sin(p.y * 2.4 + time) * .25) * 2.0, 2.0));
        float vertical = .43 + .57 * smoothstep(-.6, .6, p.y);

        // Los haces verticales sugieren luz que atraviesa una botella desde arriba.
        float shaft = exp(
          -pow((p.x + .19 - p.y * .47 + sin(p.y * 3.0 + time) * .15) * 2.6, 2.0)
        );
        float shade = .026 + body * .042 + shaft * .066 * vertical;
        vec3 color = vec3(0.0) + uAccent * shade;
        vec3 liquidLight = mix(uAccent, vec3(.82, .86, .87), .15);
        color += liquidLight *
          (ribbon * .17 + hairline * .16 + secondary * .07) *
          (.37 + .63 * body);
        color += mix(uAccent, vec3(1.0), .24) * shaft * .045;
        color += uAccent * lens * .12;
        color += mix(uAccent, vec3(.75, .83, .84), .38) * rippleLight;

        // Ocho burbujas translúcidas ascienden a velocidades distintas según su profundidad.
        for (int i = 0; i < 8; i++) {
          float seed = float(i) + 1.0;
          float depth = .35 + hash(seed * 2.17) * .65;
          float radius = (.012 + hash(seed * 3.9) * .027) * depth;
          float bx = hash(seed * 7.3) * 1.34 - .17;
          float by = fract(hash(seed * 5.4) + uTime * (.006 + depth * .007));
          bx += sin(uTime * .13 + seed * 4.0 + by * 3.0) * .024;
          vec2 bubble = vec2((bx - .5) * aspect, (by * 1.2 - .1) - .5);
          vec2 delta = p - bubble;
          float dist = length(delta);
          float ring = exp(-pow((dist - radius) / (.0009 + radius * .075), 2.0));
          float shine = max(
            0.0,
            dot(normalize(delta + vec2(.0001)), normalize(vec2(-.65, .76)))
          );
          float soft = exp(-pow((dist - radius) / (radius * .32), 2.0));
          color += mix(uAccent, vec3(.77, .83, .86), .56) *
            (ring * (.015 + pow(shine, 7.0) * .10) + soft * .008) *
            depth;
        }

        // La viñeta atenúa los bordes sin modificar la opacidad del fondo.
        float vignette = 1.0 - smoothstep(.25, 1.3, length((uv - .5) * vec2(1.12, .85)));
        color *= .61 + vignette * .39;
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compila cada etapa; un fallo activa la ruta alternativa sin detener la página.
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        throw new Error('Liquid shader unavailable');
      }
      return shader;
    }

    try {
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error('Liquid program unavailable');
      gl.useProgram(program);
      // Geometría fija de dos triángulos; la animación sucede dentro del fragment shader.
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const locations = {};
      // Guardar las ubicaciones evita buscarlas de nuevo en cada dibujo.
      ['uResolution', 'uTime', 'uAccent', 'uPointer', 'uScroll', 'uRipples[0]'].forEach((name) => {
        locations[name] = gl.getUniformLocation(program, name);
      });
      const rippleData = new Float32Array(16);
      return {
        // Ajusta el área de la GPU al tamaño real del búfer del lienzo.
        resize() {
          gl.viewport(0, 0, canvas.width, canvas.height);
        },
        // Envía el estado actual; WebGL usa el eje Y invertido respecto al DOM.
        draw() {
          gl.uniform2f(locations.uResolution, canvas.width, canvas.height);
          gl.uniform1f(locations.uTime, animationTime);
          gl.uniform3f(locations.uAccent, ...accent);
          gl.uniform3f(locations.uPointer, pointer.x, 1 - pointer.y, pointer.strength);
          gl.uniform1f(locations.uScroll, scrollY / Math.max(height, 1));
          ripples.forEach((ripple, index) => {
            const offset = index * 4;
            rippleData[offset] = ripple.x;
            rippleData[offset + 1] = 1 - ripple.y;
            rippleData[offset + 2] = animationTime - ripple.born;
            rippleData[offset + 3] = ripple.strength;
          });
          gl.uniform4fv(locations['uRipples[0]'], rippleData);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        },
      };
    } catch (_) {
      // Un lienzo que ya pidió WebGL no puede cambiar a 2D: se sustituye por una copia vacía.
      const replacement = canvas.cloneNode(false);
      canvas.replaceWith(replacement);
      canvas = replacement;
      return null;
    }
  }

  // Alternativa sin shaders: curvas Bézier, gradientes, ondas y círculos translúcidos.
  function createCanvasRenderer() {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return { resize() {}, draw() {} };
    // Aclara el color activo con un componente blanco para simular reflejos de vidrio.
    const rgba = (alpha, white = 0) =>
      `rgba(${accent.map((value) => Math.round(lerp(value * 255, 224, white))).join(',')},${alpha})`;
    // Traza una cinta; el llamador la repasa con tres grosores e intensidades.
    function ribbon(index) {
      const t = animationTime * 0.075;
      const middle = width * (0.3 + index * 0.23) + Math.sin(t + index * 2.0) * width * 0.12;
      ctx.beginPath();
      ctx.moveTo(middle - width * 0.42, -height * 0.15);
      ctx.bezierCurveTo(
        middle + width * 0.5,
        height * 0.22,
        middle - width * 0.44,
        height * 0.49,
        middle + width * 0.18,
        height * 1.16,
      );
    }
    return {
      // Canvas adapta su escala dentro de draw; no necesita un paso de redimensionado.
      resize() {},
      draw() {
        // Las coordenadas siguen en píxeles CSS aunque el búfer tenga otra resolución.
        ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        let glow = ctx.createRadialGradient(
          width * 0.69,
          height * 0.45,
          0,
          width * 0.69,
          height * 0.45,
          Math.max(width, height) * 0.72,
        );
        glow.addColorStop(0, rgba(0.12));
        glow.addColorStop(0.55, rgba(0.035));
        glow.addColorStop(1, rgba(0));
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.lineCap = 'round';
        // La composición aditiva aclara las intersecciones de luz.
        ctx.globalCompositeOperation = 'screen';
        for (let index = 0; index < 3; index++) {
          ribbon(index);
          ctx.lineWidth = width * 0.073;
          ctx.strokeStyle = rgba(0.025);
          ctx.stroke();
          ribbon(index);
          ctx.lineWidth = width * 0.017;
          ctx.strokeStyle = rgba(0.045, 0.12);
          ctx.stroke();
          ribbon(index);
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = rgba(0.17, 0.26);
          ctx.stroke();
        }
        if (pointer.strength > 0.005) {
          const x = pointer.x * width,
            y = pointer.y * height;
          glow = ctx.createRadialGradient(x, y, 0, x, y, Math.min(width, height) * 0.32);
          glow.addColorStop(0, rgba(0.17 * pointer.strength));
          glow.addColorStop(1, rgba(0));
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, width, height);
        }
        for (const ripple of ripples) {
          const age = animationTime - ripple.born;
          if (age < 0 || age > 5) continue;
          ctx.beginPath();
          ctx.ellipse(
            ripple.x * width,
            ripple.y * height,
            age * height * 0.17 + 2,
            age * height * 0.17 + 2,
            0,
            0,
            Math.PI * 2,
          );
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = rgba(Math.exp(-age * 1.4) * ripple.strength * 0.13, 0.4);
          ctx.stroke();
        }
        for (let index = 0; index < 7; index++) {
          const depth = 0.4 + (index % 4) * 0.16;
          const x =
            (((index * 0.173 + 0.13) % 1) + Math.sin(animationTime * 0.13 + index) * 0.02) * width;
          const y =
            (1.12 - ((index * 0.213 + animationTime * (0.007 + depth * 0.008)) % 1.24)) * height;
          const radius = (8 + (index % 3) * 9) * depth;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.lineWidth = 0.65;
          ctx.strokeStyle = rgba(0.085, 0.3);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, radius - 0.8, Math.PI * 1.08, Math.PI * 1.53);
          ctx.strokeStyle = rgba(0.17, 0.6);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  }

  // Probar primero WebGL; conservar siempre un motor con interfaz compatible.
  let renderer;
  try {
    renderer = createWebGLRenderer();
  } catch (_) {
    renderer = null;
  }
  if (!renderer) renderer = createCanvasRenderer();

  // Limita los píxeles procesados para evitar una carga excesiva en móviles y pantallas densas.
  function resize() {
    width = Math.max(innerWidth, 1);
    height = Math.max(innerHeight, 1);
    const maxPixels = coarse ? 650000 : 1500000;
    const scale = Math.min(
      devicePixelRatio || 1,
      coarse ? 1 : 1.5,
      Math.sqrt(maxPixels / (width * height)),
    );
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    renderer.resize();
    sceneDirty = true;
    requestFrame();
  }

  // Único cuadro de animación: actualiza color/puntero, limita la frecuencia y vuelve a programarse.
  // En pausa dibuja una imagen estática sin avanzar el reloj de las ondas.
  function render(now) {
    frame = 0;
    if (document.hidden || contextLost) return;
    updateScene();
    const isPaused = paused();
    const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60;
    previousTime = now;
    if (!isPaused) {
      animationTime += delta;
      const amount = 1 - Math.exp(-delta * 3.4);
      accent.forEach((value, index) => {
        accent[index] = lerp(value, targetAccent[index], amount);
      });
      pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-delta * 5));
      pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-delta * 5));
      pointer.strength = lerp(pointer.strength, pointer.targetStrength, 1 - Math.exp(-delta * 3.7));
    }
    const interval = coarse ? 1000 / 30 : 1000 / 60;
    if (isPaused || now - previousPaint >= interval - 0.75) {
      renderer.draw();
      previousPaint = now;
    }
    if (!isPaused) frame = requestAnimationFrame(render);
  }

  // Agrupa las peticiones de scroll, tamaño y preferencias en un solo requestAnimationFrame.
  function requestFrame() {
    if (!frame && !document.hidden && !contextLost) frame = requestAnimationFrame(render);
  }

  // Cancela el cuadro anterior y limpia efectos transitorios al pausar; reanuda sin saltos de tiempo.
  function reconcileMotion() {
    previousTime = 0;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (paused()) {
      pointer.strength = 0;
      ripples.forEach((ripple) => {
        ripple.strength = 0;
      });
      accent.splice(0, 3, ...targetAccent);
    }
    requestFrame();
  }

  // Inserta una onda en el siguiente registro reutilizable del anillo.
  function addRipple(x, y, strength) {
    if (paused()) return;
    Object.assign(ripples[rippleIndex], { x, y, born: animationTime, strength });
    rippleIndex = (rippleIndex + 1) % ripples.length;
    lastRippleTime = animationTime;
  }

  // El puntero mueve la lente y las variables CSS. La distancia y el tiempo limitan las ondas.
  addEventListener(
    'pointermove',
    (event) => {
      const x = clamp(event.clientX / width, 0, 1),
        y = clamp(event.clientY / height, 0, 1);
      pointer.tx = x;
      pointer.ty = y;
      pointer.targetStrength = event.pointerType === 'touch' ? 0.4 : 1;
      root.style.setProperty('--mx', x.toFixed(4));
      root.style.setProperty('--my', y.toFixed(4));
      const distance = Math.hypot(((x - lastPointerX) * width) / height, y - lastPointerY);
      if (
        distance > 0.055 &&
        animationTime - lastRippleTime > 0.36 &&
        event.pointerType !== 'touch'
      ) {
        addRipple(x, y, 0.26);
        lastPointerX = x;
        lastPointerY = y;
      }
    },
    { passive: true },
  );
  // Solo el botón principal genera la onda intensa de clic o contacto táctil.
  addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      addRipple(clamp(event.clientX / width, 0, 1), clamp(event.clientY / height, 0, 1), 0.95);
    },
    { passive: true },
  );
  // Fuera de la página, la lente se desvanece gradualmente.
  document.addEventListener('pointerleave', () => {
    pointer.targetStrength = 0;
  });
  addEventListener('blur', () => {
    pointer.targetStrength = 0;
  });
  // El desplazamiento invalida las mediciones; no impide ni reemplaza el scroll nativo.
  addEventListener(
    'scroll',
    () => {
      sceneDirty = true;
      requestFrame();
    },
    { passive: true },
  );
  addEventListener('resize', resize, { passive: true });
  // Una pestaña oculta no consume cuadros; al volver se reinicia la referencia de tiempo.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else {
      previousTime = 0;
      sceneDirty = true;
      requestFrame();
    }
  });
  // app.js expresa la preferencia global mediante clases en el elemento html.
  new MutationObserver(reconcileMotion).observe(root, {
    attributes: true,
    attributeFilter: ['class'],
  });
  if (typeof reduced.addEventListener === 'function')
    reduced.addEventListener('change', reconcileMotion);
  else if (typeof reduced.addListener === 'function') reduced.addListener(reconcileMotion);
  // La pérdida de contexto suspende el bucle y deja un gradiente CSS de respaldo.
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    canvas.style.background = `radial-gradient(ellipse at 70% 45%, rgba(${accent.map((value) => Math.round(value * 255)).join(',')},.17), #000000 72%)`;
  });
  // Cuando vuelve la GPU, recompilar el programa y adaptar el lienzo antes de dibujar.
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    renderer = createWebGLRenderer() || createCanvasRenderer();
    resize();
  });

  // Arranque: registrar las escenas y solicitar el primer dibujo con el tamaño correcto.
  refreshScenes();
  resize();
})();
