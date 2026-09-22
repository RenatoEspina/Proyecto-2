// normalizacion.js — limpieza de datos brutos: formatos numéricos chilenos,
// símbolos de moneda, nombres inconsistentes, consolidación de duplicados.
// Lógica pura: recibe filas crudas, devuelve actores consolidados + reporte.

// Nota: "Cía."/"Compañía" se excluyen deliberadamente de esta lista. Como suele
// aparecer como prefijo del nombre (p. ej. "Compañía de Teléfonos de Chile"), y
// además "empresa" es uno de los sinónimos usados para detectar la columna de
// nombre (§ SINONIMOS_EMPRESA), tratarlo como sufijo a eliminar puede vaciar por
// completo el nombre de esa columna al normalizarla.
const SUFIJOS_SOCIETARIOS = [
  's\\.?\\s*a\\.?', 'spa', 'ltda\\.?', 'limitada', 'e\\.?i\\.?r\\.?l\\.?',
];
const SUFIJO_REGEX = new RegExp(`\\b(${SUFIJOS_SOCIETARIOS.join('|')})\\b\\.?`, 'gi');

const SINONIMOS_EMPRESA = ['empresa', 'razon social', 'razón social', 'competidor', 'marca', 'agente', 'compañia', 'compañía', 'nombre'];
const SINONIMOS_VENTAS = ['venta', 'ventas', 'monto', 'facturacion', 'facturación', 'ingresos', 'total'];

/** Códigos de descarte, para que la interfaz sepa cuáles puede ofrecer recuperar. */
export const MOTIVO = {
  SIN_NOMBRE: 'SIN_NOMBRE',
  FILA_TOTAL: 'FILA_TOTAL',
  NO_NUMERICO: 'NO_NUMERICO',
  NEGATIVA: 'NEGATIVA',
  NOMBRE_VACIO: 'NOMBRE_VACIO',
};

/** Quita tildes, pasa a minúsculas, colapsa espacios: clave de comparación, no de presentación. */
function normalizarClave(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(SUFIJO_REGEX, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nombre "bonito" para mostrar: usa la primera variante encontrada, con espacios colapsados. */
function limpiarNombreParaMostrar(nombre) {
  return nombre.replace(/\s+/g, ' ').trim();
}

/**
 * Convierte un valor de ventas (string u number) con formato chileno o genérico a Number.
 * Soporta: "$ 4.500.000", "1.234.567,89", "1234567.89", "1,234,567.89", números ya parseados.
 * @returns {number|null} null si no se pudo interpretar
 */
export function parsearNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (valor == null) return null;
  let s = String(valor).trim();
  if (s === '') return null;

  // Quita símbolos de moneda y espacios (incluyendo espacios de separador de miles).
  s = s.replace(/[$\s]/g, '').replace(/CLP|USD|UF/gi, '');
  if (s === '') return null;

  const tienePunto = s.includes('.');
  const tieneComa = s.includes(',');

  if (tienePunto && tieneComa) {
    // El último separador es el decimal; el otro es de miles.
    const ultimoPunto = s.lastIndexOf('.');
    const ultimaComa = s.lastIndexOf(',');
    if (ultimaComa > ultimoPunto) {
      // Formato es-CL: 1.234.567,89
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato en-US: 1,234,567.89
      s = s.replace(/,/g, '');
    }
  } else if (tieneComa && !tienePunto) {
    // Ambiguo: "1234,56" (decimal es-CL) vs "1,234" (miles en-US).
    // Más de un grupo de coma, o un único grupo final de exactamente 3 dígitos, se
    // interpreta como separador de miles (caso típico de montos de ventas sin decimales).
    const partes = s.split(',');
    const pareceMiles = partes.length > 1 && partes.slice(1).every((p) => p.length === 3);
    s = pareceMiles ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (tienePunto && !tieneComa) {
    // Ambiguo: "1.234.567" o "500.000" (miles es-CL) vs "1234.56" (decimal en-US).
    // Mismo criterio: un único grupo final de exactamente 3 dígitos se trata como miles.
    const partes = s.split('.');
    const pareceMiles = partes.length > 1 && partes.slice(1).every((p) => p.length === 3);
    s = pareceMiles ? s.replace(/\./g, '') : s;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Detecta si una fila parece ser una fila de totales (para excluirla con confirmación). */
export function pareceFilaDeTotal(nombre) {
  const clave = normalizarClave(String(nombre || ''));
  return /^(total|totales|subtotal|gran total|suma)$/.test(clave);
}

/**
 * Sugiere el índice de columna de empresa y de ventas.
 *
 * Primero busca por sinónimos en los encabezados. Si eso no alcanza (encabezados
 * genéricos tipo "Columna 1", o archivos sin encabezado real), cae a una heurística
 * sobre el contenido: la columna con más celdas numéricas es la de ventas, y la
 * primera columna mayoritariamente de texto es la de empresa.
 *
 * @param {string[]} encabezados
 * @param {any[][]} [filasMuestra] filas de datos para la heurística de contenido
 */
export function detectarColumnas(encabezados, filasMuestra = []) {
  const normalizados = encabezados.map((h) => normalizarClave(String(h || '')));
  let colEmpresa = -1;
  let colVentas = -1;
  normalizados.forEach((h, i) => {
    if (colEmpresa === -1 && SINONIMOS_EMPRESA.some((s) => h.includes(normalizarClave(s)))) colEmpresa = i;
    if (colVentas === -1 && SINONIMOS_VENTAS.some((s) => h.includes(normalizarClave(s)))) colVentas = i;
  });

  // Una misma columna no puede ser a la vez la de empresa y la de ventas
  // (p. ej. un encabezado "Ventas por empresa"): se resuelve con el contenido.
  if (colEmpresa !== -1 && colEmpresa === colVentas) colVentas = -1;

  if (filasMuestra.length && (colEmpresa === -1 || colVentas === -1)) {
    const nCols = Math.max(encabezados.length, ...filasMuestra.map((f) => f.length));
    const proporcionNumerica = [];
    for (let c = 0; c < nCols; c++) {
      const celdas = filasMuestra.map((f) => f[c]).filter((v) => String(v ?? '').trim() !== '');
      const numericas = celdas.filter((v) => parsearNumero(v) !== null).length;
      proporcionNumerica[c] = celdas.length ? numericas / celdas.length : 0;
    }
    if (colVentas === -1) {
      let mejor = -1;
      let mejorProp = 0.6; // exige mayoría clara antes de adivinar
      for (let c = 0; c < nCols; c++) {
        if (c === colEmpresa) continue;
        if (proporcionNumerica[c] > mejorProp) {
          mejorProp = proporcionNumerica[c];
          mejor = c;
        }
      }
      colVentas = mejor;
    }
    if (colEmpresa === -1) {
      for (let c = 0; c < nCols; c++) {
        if (c === colVentas) continue;
        if (proporcionNumerica[c] < 0.4) {
          colEmpresa = c;
          break;
        }
      }
    }
  }

  return { colEmpresa, colVentas };
}

/**
 * Consolida filas crudas en actores únicos por nombre normalizado, sumando ventas.
 *
 * @param {{fila:number, nombreOriginal:string, ventasCrudo:*}[]} filas
 * @returns {{actores:object[], descartadas:object[], consolidaciones:object[]}}
 */
export function consolidarActores(filas) {
  const grupos = new Map(); // clave normalizada -> actor acumulado
  const descartadas = [];
  const consolidacionesPorClave = new Map();

  for (const fila of filas) {
    const nombreOriginal = String(fila.nombreOriginal ?? '').trim();
    if (!nombreOriginal) {
      descartadas.push({ ...fila, codigo: MOTIVO.SIN_NOMBRE, motivo: 'Fila sin nombre de empresa' });
      continue;
    }
    if (pareceFilaDeTotal(nombreOriginal)) {
      descartadas.push({ ...fila, codigo: MOTIVO.FILA_TOTAL, motivo: 'Fila de totales' });
      continue;
    }

    const ventas = parsearNumero(fila.ventasCrudo);
    if (ventas === null) {
      descartadas.push({ ...fila, codigo: MOTIVO.NO_NUMERICO, motivo: 'Ventas no interpretables' });
      continue;
    }
    if (ventas < 0) {
      descartadas.push({ ...fila, codigo: MOTIVO.NEGATIVA, motivo: 'Ventas negativas' });
      continue;
    }

    const clave = normalizarClave(nombreOriginal);
    if (!clave) {
      descartadas.push({ ...fila, codigo: MOTIVO.NOMBRE_VACIO, motivo: 'Nombre de empresa vacío tras normalizar' });
      continue;
    }

    if (!grupos.has(clave)) {
      grupos.set(clave, {
        id: clave,
        nombre: limpiarNombreParaMostrar(nombreOriginal),
        aliases: [nombreOriginal],
        ventas: 0,
        incluido: true,
        esParte: false,
        grupoManual: null,
      });
      consolidacionesPorClave.set(clave, 0);
    }
    const actor = grupos.get(clave);
    actor.ventas += ventas;
    if (!actor.aliases.includes(nombreOriginal)) actor.aliases.push(nombreOriginal);
    consolidacionesPorClave.set(clave, consolidacionesPorClave.get(clave) + 1);
  }

  const consolidaciones = [...consolidacionesPorClave.entries()]
    .filter(([, n]) => n > 1)
    .map(([clave, n]) => ({ nombre: grupos.get(clave).nombre, filasFusionadas: n }));

  return { actores: [...grupos.values()], descartadas, consolidaciones };
}

/**
 * Aplica agrupación manual de filiales: funde varios ids de actores en uno solo,
 * bajo el nombre del actor "matriz" indicado.
 * @param {object[]} actores
 * @param {string[]} idsAConsolidar
 * @param {string} idMatriz - debe estar incluido en idsAConsolidar
 */
export function agruparManualmente(actores, idsAConsolidar, idMatriz) {
  const matriz = actores.find((a) => a.id === idMatriz);
  if (!matriz) throw new Error('El actor matriz indicado no existe.');

  const otros = actores.filter((a) => idsAConsolidar.includes(a.id) && a.id !== idMatriz);
  const restantes = actores.filter((a) => !idsAConsolidar.includes(a.id) || a.id === idMatriz);

  const ventasSumadas = matriz.ventas + otros.reduce((acc, a) => acc + a.ventas, 0);
  const aliasesUnidos = [...matriz.aliases, ...otros.flatMap((a) => a.aliases)];

  return restantes.map((a) =>
    a.id === idMatriz ? { ...a, ventas: ventasSumadas, aliases: aliasesUnidos, grupoManual: aliasesUnidos } : a
  );
}

/**
 * Deriva la lista de agentes económicos de trabajo a partir de la lista base del
 * archivo más las agrupaciones manuales declaradas por el usuario.
 *
 * Se recalcula siempre desde la base (no se muta la lista anterior) para que
 * deshacer una agrupación sea trivial y el resultado no dependa del orden en que
 * el usuario hizo y deshizo agrupaciones.
 *
 * @param {object[]} base - actores consolidados tal como salieron del archivo
 * @param {{id:string, nombre:string, idsMiembros:string[]}[]} grupos
 * @returns {object[]} agentes económicos resultantes
 */
export function aplicarGrupos(base, grupos = []) {
  const usados = new Set();
  const resultado = [];

  for (const grupo of grupos) {
    const miembros = base.filter((a) => grupo.idsMiembros.includes(a.id));
    if (miembros.length === 0) continue;
    miembros.forEach((m) => usados.add(m.id));
    resultado.push({
      id: grupo.id,
      nombre: grupo.nombre,
      aliases: miembros.flatMap((m) => m.aliases),
      ventas: miembros.reduce((acc, m) => acc + m.ventas, 0),
      incluido: true,
      esParte: false,
      esGrupo: true,
      miembros: miembros.map((m) => ({ id: m.id, nombre: m.nombre, ventas: m.ventas })),
      grupoManual: miembros.map((m) => m.nombre),
    });
  }

  for (const actor of base) {
    if (usados.has(actor.id)) continue;
    resultado.push({ ...actor, esGrupo: false, miembros: null });
  }

  return resultado;
}
