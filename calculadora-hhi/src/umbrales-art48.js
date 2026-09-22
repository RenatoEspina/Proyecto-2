// umbrales-art48.js — verificación de los umbrales de notificación obligatoria
// del art. 48 inciso 2° del DL 211. Lógica pura, sin DOM.
//
// ⚠️ ATENCIÓN JURÍDICA: este cálculo NO usa las ventas del mercado relevante que
// se cargan en la calculadora de IHH. El art. 48 se refiere a las ventas TOTALES
// EN CHILE de cada agente económico durante el ejercicio anterior al de la
// notificación, cualquiera sea el mercado en que se produzcan. Por eso este
// módulo recibe sus propios montos y nunca los toma del archivo de ventas.

export const ART48 = {
  norma: 'Art. 48 inciso 2° DL 211',
  umbralConjuntoUF: 2_500_000,
  umbralIndividualUF: 450_000,
  minAgentesSobreIndividual: 2,
};

/**
 * Criterio de borde: el art. 48 exige montos "iguales o superiores" a los umbrales,
 * de modo que aquí el operador es `>=`. Nótese que es el criterio OPUESTO al del
 * párrafo 35 de la Guía FNE (donde el safe harbour exige ser estrictamente menor);
 * confundirlos es un error fácil y de consecuencias prácticas.
 *
 * @param {{nombre:string, ventasChileCLP:number}[]} agentes - los que proyectan concentrarse
 * @param {number} valorUF - valor de la UF al 31 de diciembre del ejercicio respectivo
 */
export function evaluarUmbralesArt48(agentes, valorUF) {
  if (!Number.isFinite(valorUF) || valorUF <= 0) {
    throw new Error('Indique un valor de la UF mayor a cero.');
  }
  const validos = (agentes || []).filter(
    (a) => Number.isFinite(a.ventasChileCLP) && a.ventasChileCLP > 0
  );
  if (validos.length < 2) {
    throw new Error('Indique las ventas en Chile de al menos dos agentes económicos.');
  }

  const detalle = validos.map((a) => {
    const uf = a.ventasChileCLP / valorUF;
    return {
      nombre: a.nombre,
      ventasChileCLP: a.ventasChileCLP,
      uf,
      superaIndividual: uf >= ART48.umbralIndividualUF,
    };
  });

  const sumaUF = detalle.reduce((acc, a) => acc + a.uf, 0);
  const sobreIndividual = detalle.filter((a) => a.superaIndividual).length;

  const cumpleConjunto = sumaUF >= ART48.umbralConjuntoUF;
  const cumpleIndividual = sobreIndividual >= ART48.minAgentesSobreIndividual;

  return {
    valorUF,
    detalle,
    sumaUF,
    sobreIndividual,
    cumpleConjunto,
    cumpleIndividual,
    // Los dos requisitos son copulativos.
    debeNotificarse: cumpleConjunto && cumpleIndividual,
  };
}

/** Explicación en lenguaje llano del resultado, para mostrar en la interfaz y en el informe. */
export function explicarArt48(resultado) {
  const fmtUF = (n) => n.toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const partes = [];
  partes.push(
    `Ventas conjuntas en Chile: ${fmtUF(resultado.sumaUF)} UF ` +
      `(${resultado.cumpleConjunto ? 'alcanza' : 'no alcanza'} el umbral de ${fmtUF(ART48.umbralConjuntoUF)} UF).`
  );
  partes.push(
    `Agentes que individualmente alcanzan ${fmtUF(ART48.umbralIndividualUF)} UF: ${resultado.sobreIndividual} ` +
      `(${resultado.cumpleIndividual ? 'se cumple' : 'no se cumple'} el mínimo de ${ART48.minAgentesSobreIndividual}).`
  );
  partes.push(
    resultado.debeNotificarse
      ? 'Ambos requisitos son copulativos y ambos se cumplen: la operación quedaría sujeta a notificación obligatoria.'
      : 'Los requisitos son copulativos: al no cumplirse ambos, la operación no quedaría sujeta a notificación obligatoria por esta vía (sin perjuicio de la notificación voluntaria del art. 48 inciso 9°).'
  );
  return partes;
}
