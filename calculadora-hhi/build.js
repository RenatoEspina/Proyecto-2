// build.js — genera el archivo único que usa el equipo de Derecho.
//
// Por qué existe: la aplicación modular (index.html + src/*.js) no se puede abrir
// haciendo doble clic, porque los navegadores bloquean los módulos ES cargados
// desde file://. Obligar a un abogado a levantar un servidor desde la terminal
// mataría el producto. Este build produce un único archivo HTML autocontenido
// —con el CSS, las librerías y los datos de ejemplo embebidos— que funciona con
// doble clic, sin instalación, sin conexión y sin terminal.
//
// Uso:  npm run build
// Sale: dist/Calculadora-IHH.html
//
// El código fuente modular sigue siendo la fuente de verdad: es lo que se prueba
// con Vitest y lo que puede auditar quien necesite revisar el cálculo.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const r = (...p) => join(raiz, ...p);

// --- 1. Datos de ejemplo -> módulo JS embebible -----------------------------

const EJEMPLOS = [
  {
    id: 'supermercados',
    archivo: 'supermercados.csv',
    nombre: 'Supermercados (archivo limpio)',
    descripcion: '7 cadenas, CSV bien formado. Útil para ver el flujo completo sin ruido.',
  },
  {
    id: 'isapres',
    archivo: 'isapres.csv',
    nombre: 'Isapres (archivo limpio)',
    descripcion: '6 aseguradoras. Mercado más concentrado que el de supermercados.',
  },
  {
    id: 'sucio',
    archivo: 'sucio.csv',
    nombre: 'Cemento (archivo "sucio", como los reales)',
    descripcion:
      'Reproduce a propósito los defectos típicos: dos filas de título antes de la tabla, separador ";", formato numérico chileno, símbolo $, nombres inconsistentes de una misma empresa, una filial que hay que agrupar a mano, una fila con ventas negativas y una fila de totales.',
  },
];

function generarModuloEjemplos() {
  const entradas = EJEMPLOS.map((e) => {
    const csv = readFileSync(r('datos-ejemplo', e.archivo), 'utf8');
    return `  {
    id: ${JSON.stringify(e.id)},
    nombre: ${JSON.stringify(e.nombre)},
    archivo: ${JSON.stringify(e.archivo)},
    descripcion: ${JSON.stringify(e.descripcion)},
    csv: ${JSON.stringify(csv)},
  }`;
  }).join(',\n');

  const contenido = `// ejemplos.js — ARCHIVO GENERADO por build.js a partir de datos-ejemplo/*.csv.
// No editar a mano: los cambios se pierden en el próximo \`npm run build\`.
// Los datos van embebidos (y no se leen con fetch) para que la versión de archivo
// único funcione con doble clic, sin servidor.

export const EJEMPLOS = [
${entradas},
];
`;
  writeFileSync(r('src', 'ejemplos.js'), contenido, 'utf8');
  console.log(`✓ src/ejemplos.js generado (${EJEMPLOS.length} datasets)`);
}

// --- 2. Bundle de los módulos ES -------------------------------------------

async function bundle() {
  let esbuild;
  try {
    esbuild = await import('esbuild');
  } catch {
    console.error(
      '✗ Falta esbuild. Ejecute `npm install` en calculadora-hhi/ antes de `npm run build`.'
    );
    process.exit(1);
  }
  const resultado = await esbuild.build({
    entryPoints: [r('src', 'main.js')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    write: false,
    legalComments: 'none',
  });
  return resultado.outputFiles[0].text;
}

// --- 3. Ensamblado del archivo único ---------------------------------------

/** Evita que un `</script>` dentro del código corte la etiqueta que lo contiene. */
const seguroParaScript = (js) => js.replace(/<\/script/gi, '<\\/script');

// El código minificado de las librerías contiene secuencias como `$&` o `$\`` que
// String.replace interpreta como patrones de sustitución y que corromperían el
// archivo generado. Por eso todo reemplazo se hace con una función, nunca con un
// string literal: una función devuelve el texto tal cual.
const inyectar = (texto) => () => texto;

async function construir() {
  generarModuloEjemplos();

  const appJs = await bundle();
  const css = readFileSync(r('style.css'), 'utf8');
  const vendor = ['papaparse.min.js', 'xlsx.full.min.js', 'chart.umd.js']
    .map((f) => readFileSync(r('vendor', f), 'utf8'))
    .map(seguroParaScript);

  let html = readFileSync(r('index.html'), 'utf8');

  html = html.replace(
    '<link rel="stylesheet" href="style.css">',
    inyectar(`<style>\n${css}\n</style>`)
  );

  // Las tres etiquetas de vendor y la del módulo principal se reemplazan por el
  // código inline. Se hace por marcador explícito para que el build falle ruidoso
  // si alguien cambia index.html sin actualizar esto.
  const marcadorScripts = /<script src="vendor\/papaparse\.min\.js"><\/script>[\s\S]*?<script type="module" src="src\/main\.js"><\/script>/;
  if (!marcadorScripts.test(html)) {
    console.error('✗ No se encontró el bloque de <script> esperado en index.html. Revise build.js.');
    process.exit(1);
  }
  html = html.replace(
    marcadorScripts,
    inyectar(
      vendor.map((v) => `<script>${v}</script>`).join('\n') +
        `\n<script>${seguroParaScript(appJs)}</script>`
    )
  );

  // Marca de agua para saber de qué versión del código salió este archivo.
  const version = JSON.parse(readFileSync(r('package.json'), 'utf8')).version;
  html = html.replace(
    '</head>',
    inyectar(
      `<meta name="generator" content="calculadora-hhi ${version} — build ${new Date().toISOString().slice(0, 10)}">\n</head>`
    )
  );

  mkdirSync(r('dist'), { recursive: true });
  const salida = r('dist', 'Calculadora-IHH.html');
  writeFileSync(salida, html, 'utf8');
  const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
  console.log(`✓ dist/Calculadora-IHH.html generado (${kb} KB, autocontenido, abrible con doble clic)`);
}

construir().catch((e) => {
  console.error('✗ Error en el build:', e);
  process.exit(1);
});
