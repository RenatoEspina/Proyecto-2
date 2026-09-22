// clasificador-fne.js — árbol de decisión del párrafo 35 de la Guía para el Análisis
// de Operaciones de Concentración Horizontales de la FNE (vigente desde el 31-05-2022).
//
// Los umbrales normativos se centralizan aquí (ver §11.2 del plan: "los umbrales
// de la guía cambian" es un riesgo de mantenimiento; no deben dispersarse por el código).

export const GUIA_FNE = {
  nombre: 'Guía para el Análisis de Operaciones de Concentración Horizontales',
  organismo: 'Fiscalía Nacional Económica (FNE)',
  vigenteDesde: '2022-05-31',
  umbralModerado: 1500,
  umbralAlto: 2500,
  deltaMaxModerado: 200,
  deltaMaxAlto: 100,
};

export const NIVEL = {
  DESCONCENTRADO: 'DESCONCENTRADO',
  MODERADAMENTE_CONCENTRADO: 'MODERADAMENTE_CONCENTRADO',
  ALTAMENTE_CONCENTRADO: 'ALTAMENTE_CONCENTRADO',
};

export const VEREDICTO = {
  DESCARTE: 'DESCARTE',
  ANALISIS_PROFUNDIDAD: 'ANALISIS_PROFUNDIDAD',
  SIN_OPERACION: 'SIN_OPERACION', // menos de 2 partes seleccionadas
};

/** Nivel de concentración del mercado post-operación (informativo, no es el veredicto). */
export function nivelConcentracion(hhiPost) {
  if (hhiPost < GUIA_FNE.umbralModerado) return NIVEL.DESCONCENTRADO;
  if (hhiPost < GUIA_FNE.umbralAlto) return NIVEL.MODERADAMENTE_CONCENTRADO;
  return NIVEL.ALTAMENTE_CONCENTRADO;
}

/**
 * Veredicto FNE según el párrafo 35: ¿cae la operación en la zona de descarte (safe
 * harbour) o requeriría un análisis en profundidad?
 *
 * Criterio de borde (párr. 36, "igualen o sobrepasen"): los límites se tratan de
 * forma conservadora. delta === deltaMax NO cae en el safe harbour.
 */
export function veredictoFNE(hhiPost, delta, numPartes) {
  if (numPartes < 2) return VEREDICTO.SIN_OPERACION;
  if (hhiPost < GUIA_FNE.umbralModerado) return VEREDICTO.DESCARTE;
  if (hhiPost < GUIA_FNE.umbralAlto) {
    return delta < GUIA_FNE.deltaMaxModerado ? VEREDICTO.DESCARTE : VEREDICTO.ANALISIS_PROFUNDIDAD;
  }
  return delta < GUIA_FNE.deltaMaxAlto ? VEREDICTO.DESCARTE : VEREDICTO.ANALISIS_PROFUNDIDAD;
}

/** Cita normativa que fundamenta el veredicto, para mostrar en la interfaz y en el informe. */
export function citaNormativa(hhiPost, delta, numPartes) {
  const veredicto = veredictoFNE(hhiPost, delta, numPartes);
  if (veredicto === VEREDICTO.SIN_OPERACION) {
    return 'Seleccione al menos 2 partes de la operación para calcular el veredicto FNE.';
  }
  if (hhiPost < GUIA_FNE.umbralModerado) {
    return `IHH post < 1.500 (Guía FNE, párr. 35.i): mercado desconcentrado tras la operación.`;
  }
  if (hhiPost < GUIA_FNE.umbralAlto) {
    return veredicto === VEREDICTO.DESCARTE
      ? `1.500 ≤ IHH post < 2.500 y ΔIHH < 200 (Guía FNE, párr. 35.ii).`
      : `1.500 ≤ IHH post < 2.500 y ΔIHH ≥ 200 (Guía FNE, párr. 35.ii): no cae en la zona de descarte.`;
  }
  return veredicto === VEREDICTO.DESCARTE
    ? `IHH post ≥ 2.500 y ΔIHH < 100 (Guía FNE, párr. 35.iii).`
    : `IHH post ≥ 2.500 y ΔIHH ≥ 100 (Guía FNE, párr. 35.iii): no cae en la zona de descarte.`;
}

/** Etiquetas en español para mostrar en la UI. */
export const ETIQUETA_NIVEL = {
  [NIVEL.DESCONCENTRADO]: { texto: 'Desconcentrado', icono: '🟢' },
  [NIVEL.MODERADAMENTE_CONCENTRADO]: { texto: 'Moderadamente concentrado', icono: '🟡' },
  [NIVEL.ALTAMENTE_CONCENTRADO]: { texto: 'Altamente concentrado', icono: '🔴' },
};

export const ETIQUETA_VEREDICTO = {
  [VEREDICTO.DESCARTE]: { texto: 'Cae en zona de descarte', icono: '✅' },
  [VEREDICTO.ANALISIS_PROFUNDIDAD]: { texto: 'Requiere análisis en profundidad', icono: '⚠️' },
  [VEREDICTO.SIN_OPERACION]: { texto: 'Falta seleccionar partes de la operación', icono: 'ℹ️' },
};
