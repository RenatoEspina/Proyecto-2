// motor-hhi.js — lógica de negocio pura del índice Herfindahl-Hirschman (IHH/HHI).
// No toca el DOM ni conoce la interfaz. Recibe datos, devuelve datos.
// Fórmulas: Guía FNE para el Análisis de Operaciones de Concentración Horizontales (mayo 2022), § B, párr. 32-37.

/** Umbral por defecto (en puntos porcentuales) para contar "competidores significativos". */
export const UMBRAL_SIGNIFICATIVO_POR_DEFECTO = 5;

/**
 * Calcula la cuota de mercado (en puntos porcentuales, 0-100) de cada actor.
 * @param {{id:string, ventas:number}[]} actores
 * @returns {{id:string, ventas:number, cuota:number}[]}
 */
export function calcularCuotas(actores) {
  const total = actores.reduce((acc, a) => acc + a.ventas, 0);
  if (total <= 0) {
    throw new Error('El tamaño del mercado debe ser mayor a cero.');
  }
  return actores.map((a) => ({ ...a, cuota: (a.ventas / total) * 100 }));
}

/** Suma de los cuadrados de las cuotas. */
export function hhi(cuotas) {
  return cuotas.reduce((acc, s) => acc + s * s, 0);
}

/**
 * Construye la lista de actores tal como queda el mercado DESPUÉS de la operación:
 * las partes se funden en una sola entidad que suma sus ventas y sus cuotas.
 *
 * Sirve para que el IHH post también sea auditable línea por línea (RNF-05), no
 * solo un número calculado con un atajo algebraico.
 *
 * @param {{id:string, nombre:string, ventas:number, cuota:number}[]} conCuota
 * @param {string[]} idsPartes
 */
function construirMercadoPost(conCuota, idsPartes) {
  const partes = conCuota.filter((a) => idsPartes.includes(a.id));
  if (partes.length < 2) {
    return conCuota.map((a) => ({ ...a, esEntidadFusionada: false }));
  }
  const ventasFusion = partes.reduce((acc, a) => acc + a.ventas, 0);
  const cuotaFusion = partes.reduce((acc, a) => acc + a.cuota, 0);
  const entidad = {
    id: '__fusion__',
    nombre: partes.map((a) => a.nombre).join(' + '),
    ventas: ventasFusion,
    cuota: cuotaFusion,
    cuotaCuadrado: cuotaFusion * cuotaFusion,
    esParte: true,
    esEntidadFusionada: true,
  };
  const resto = conCuota
    .filter((a) => !idsPartes.includes(a.id))
    .map((a) => ({ ...a, esEntidadFusionada: false }));
  return [entidad, ...resto].sort((a, b) => b.cuota - a.cuota);
}

/**
 * Analiza una operación de concentración sobre un conjunto de actores.
 *
 * No redondea en ningún paso intermedio (RNF-04): el redondeo es solo
 * responsabilidad de la capa de presentación.
 *
 * @param {{id:string, nombre:string, ventas:number}[]} actores - actores incluidos en el mercado relevante
 * @param {string[]} idsPartes - ids de los actores que se concentran (0, 1 o más)
 * @param {{umbralSignificativo?:number}} [opciones]
 * @returns {object} resultado del análisis
 */
export function analizarOperacion(actores, idsPartes, opciones = {}) {
  if (!actores || actores.length === 0) {
    throw new Error('No hay actores incluidos en el mercado relevante.');
  }
  const umbralSignificativo = opciones.umbralSignificativo ?? UMBRAL_SIGNIFICATIVO_POR_DEFECTO;

  const mercadoTotal = actores.reduce((acc, a) => acc + a.ventas, 0);
  const conCuota = calcularCuotas(actores).map((a) => ({
    ...a,
    cuotaCuadrado: a.cuota * a.cuota,
    esParte: idsPartes.includes(a.id),
  }));

  const cuotas = conCuota.map((a) => a.cuota);
  const hhiPre = hhi(cuotas);

  const partes = conCuota.filter((a) => idsPartes.includes(a.id));
  const sumaPartes = partes.reduce((acc, a) => acc + a.cuota, 0);
  const sumaCuadradosPartes = partes.reduce((acc, a) => acc + a.cuotaCuadrado, 0);

  // ΔIHH = (Σ cuotas de las partes)² − Σ (cuotas de las partes)²
  // Con 0 o 1 parte seleccionada, delta es 0 (no hay operación que evaluar).
  const delta = partes.length >= 2 ? sumaPartes ** 2 - sumaCuadradosPartes : 0;
  const hhiPost = hhiPre + delta;

  // CR4: suma de las cuotas de los 4 mayores actores.
  const ordenados = [...conCuota].sort((a, b) => b.cuota - a.cuota);
  const cr4 = ordenados.slice(0, 4).reduce((acc, a) => acc + a.cuota, 0);

  const actoresPost = construirMercadoPost(conCuota, idsPartes);

  return {
    mercadoTotal,
    actores: conCuota,
    actoresOrdenados: ordenados,
    actoresPost,
    hhiPre,
    hhiPost,
    delta,
    cr4,
    umbralSignificativo,
    numSignificativos: ordenados.filter((a) => a.cuota >= umbralSignificativo).length,
    numActores: ordenados.length,
    numPartes: partes.length,
    cuotaConjuntaPartes: sumaPartes,
  };
}
