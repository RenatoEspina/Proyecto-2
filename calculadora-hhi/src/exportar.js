// exportar.js — genera las salidas del análisis: informe imprimible (HTML → PDF con
// "Imprimir → Guardar como PDF") y detalle en CSV abrible con Excel.
// No hace red: todo se genera y descarga en el navegador (RNF-01).

import {
  ETIQUETA_NIVEL,
  ETIQUETA_VEREDICTO,
  veredictoFNE,
  nivelConcentracion,
  citaNormativa,
  GUIA_FNE,
} from './clasificador-fne.js';
import { ART48 } from './umbrales-art48.js';

function descargarBlob(contenido, nombreArchivo, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Escapa texto proveniente del archivo del usuario antes de insertarlo en el informe HTML. */
function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const fmtPct = (n) => `${n.toFixed(2)} %`;
const fmtNum = (n) => Math.round(n).toLocaleString('es-CL');
const fmtIhh = (n) => n.toLocaleString('es-CL', { maximumFractionDigits: 2 });

/** Nombre de archivo con fecha, para que no se pisen los informes de casos distintos. */
function nombreConFecha(base, extension) {
  const hoy = new Date().toISOString().slice(0, 10);
  return `${base}-${hoy}.${extension}`;
}

export function exportarCSV(resultado, meta = {}) {
  const filas = [['#', 'Agente económico', 'Ventas', 'Cuota (%)', 'Cuota²', 'Parte de la operación']];
  resultado.actoresOrdenados.forEach((a, i) => {
    filas.push([i + 1, a.nombre, a.ventas, a.cuota.toFixed(4), a.cuotaCuadrado.toFixed(4), a.esParte ? 'Sí' : 'No']);
  });
  filas.push([]);
  filas.push(['Tamaño del mercado', resultado.mercadoTotal]);
  filas.push(['IHH pre-operación', resultado.hhiPre.toFixed(2)]);
  filas.push(['IHH post-operación', resultado.hhiPost.toFixed(2)]);
  filas.push(['ΔIHH', resultado.delta.toFixed(2)]);
  filas.push(['CR4', resultado.cr4.toFixed(2)]);
  filas.push([`Agentes con cuota >= ${resultado.umbralSignificativo} %`, resultado.numSignificativos]);
  filas.push(['Nivel de concentración', ETIQUETA_NIVEL[nivelConcentracion(resultado.hhiPost)].texto]);
  filas.push([
    'Veredicto FNE',
    ETIQUETA_VEREDICTO[veredictoFNE(resultado.hhiPost, resultado.delta, resultado.numPartes)].texto,
  ]);
  if (meta.excluidos && meta.excluidos.length) {
    filas.push([]);
    filas.push(['Excluidos del mercado relevante', ...meta.excluidos]);
  }

  // El separador ";" y el BOM hacen que Excel en configuración regional chilena
  // abra el archivo con las columnas ya separadas y los acentos correctos.
  const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  descargarBlob('﻿' + csv, nombreConFecha('detalle-ihh', 'csv'), 'text/csv;charset=utf-8');
}

function filasTablaHTML(actores) {
  return actores
    .map(
      (a, i) => `<tr${a.esParte ? ' class="parte"' : ''}>
        <td>${i + 1}</td>
        <td>${esc(a.nombre)}${a.esParte ? ' ⚖' : ''}</td>
        <td class="num">${fmtNum(a.ventas)}</td>
        <td class="num">${fmtPct(a.cuota)}</td>
        <td class="num">${fmtIhh(a.cuotaCuadrado)}</td>
      </tr>`
    )
    .join('\n');
}

/**
 * Informe autocontenido en HTML. Se abre en el navegador y se convierte a PDF con
 * "Imprimir → Guardar como PDF"; el texto queda seleccionable para pegarlo en el escrito.
 *
 * @param {object} resultado - salida de analizarOperacion
 * @param {object} meta - { archivoNombre, excluidos, grupos, descartadas, graficoPNG, escenarios, art48 }
 */
export function exportarInformeHTML(resultado, meta = {}) {
  const nivel = nivelConcentracion(resultado.hhiPost);
  const veredicto = veredictoFNE(resultado.hhiPost, resultado.delta, resultado.numPartes);
  const cita = citaNormativa(resultado.hhiPost, resultado.delta, resultado.numPartes);
  const excluidos = meta.excluidos || [];
  const grupos = meta.grupos || [];
  const descartadas = meta.descartadas || [];
  const escenarios = meta.escenarios || [];
  const partes = resultado.actoresOrdenados.filter((a) => a.esParte);

  const bloqueGrafico = meta.graficoPNG
    ? `<h2>Participación de mercado</h2>
       <p><img src="${meta.graficoPNG}" alt="Gráfico de participación de mercado" style="max-width:100%"></p>`
    : '';

  const bloquePost =
    resultado.numPartes >= 2
      ? `<h2>Mercado resultante (después de la operación)</h2>
         <p class="nota">Las partes se cuentan como un solo agente económico. La suma de la columna Cuota² es el IHH post-operación.</p>
         <table>
           <thead><tr><th>#</th><th>Agente económico</th><th class="num">Ventas</th><th class="num">Cuota</th><th class="num">Cuota²</th></tr></thead>
           <tbody>${filasTablaHTML(resultado.actoresPost)}</tbody>
           <tfoot><tr><td></td><td><strong>TOTAL</strong></td><td class="num">${fmtNum(resultado.mercadoTotal)}</td><td class="num">100,00 %</td><td class="num"><strong>${fmtIhh(resultado.hhiPost)}</strong></td></tr></tfoot>
         </table>`
      : '';

  const bloqueEscenarios = escenarios.length
    ? `<h2>Escenarios comparados</h2>
       <table>
         <thead><tr><th>Escenario</th><th class="num">Agentes</th><th class="num">IHH pre</th><th class="num">IHH post</th><th class="num">ΔIHH</th><th>Veredicto FNE</th></tr></thead>
         <tbody>${escenarios
           .map(
             (e) => `<tr><td>${esc(e.nombre)}</td><td class="num">${e.numActores}</td><td class="num">${fmtIhh(e.hhiPre)}</td><td class="num">${fmtIhh(e.hhiPost)}</td><td class="num">${fmtIhh(e.delta)}</td><td>${ETIQUETA_VEREDICTO[e.veredicto].texto}</td></tr>`
           )
           .join('')}</tbody>
       </table>`
    : '';

  const bloqueArt48 = meta.art48
    ? `<h2>Umbrales de notificación (${esc(ART48.norma)})</h2>
       <p class="nota">Calculado con montos de ventas totales en Chile ingresados por el usuario, independientes del archivo de ventas del mercado relevante. Valor UF utilizado: ${fmtNum(meta.art48.valorUF)}. Umbrales según la ${esc(ART48.resolucion)}.</p>
       <table>
         <thead><tr><th>Agente</th><th class="num">Ventas en Chile</th><th class="num">UF</th><th>¿Sobre 450.000 UF?</th></tr></thead>
         <tbody>${meta.art48.detalle
           .map(
             (a) => `<tr><td>${esc(a.nombre)}</td><td class="num">${fmtNum(a.ventasChileCLP)}</td><td class="num">${fmtNum(a.uf)}</td><td>${a.superaIndividual ? 'Sí' : 'No'}</td></tr>`
           )
           .join('')}</tbody>
       </table>
       <ul>${(meta.art48.explicacion || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe IHH — ${esc(meta.archivoNombre || 'Calculadora HHI')}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 820px; margin: 40px auto; color: #1a1a1a; line-height: 1.5; padding: 0 16px; }
  h1 { font-size: 1.4rem; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; }
  h2 { font-size: 1.1rem; margin-top: 2rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 1rem; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.parte { background: #fff3cd; }
  tfoot td { font-weight: bold; border-top: 2px solid #1a1a1a; }
  .resumen { display: flex; gap: 16px; margin: 1rem 0; flex-wrap: wrap; }
  .resumen div.caja { border: 1px solid #999; padding: 10px 16px; text-align: center; flex: 1; min-width: 150px; }
  .resumen .valor { font-size: 1.5rem; font-weight: bold; }
  .veredicto { padding: 12px 16px; border-left: 4px solid #333; background: #f7f7f7; margin: 1rem 0; }
  .aviso { font-size: 0.85rem; color: #444; border-top: 1px dashed #999; padding-top: 10px; margin-top: 2rem; }
  .nota { font-size: 0.85rem; color: #555; }
  ul { font-size: 0.9rem; }
  @media print { body { margin: 0; } h2 { page-break-after: avoid; } table { page-break-inside: avoid; } }
</style>
</head>
<body>
  <h1>Informe · Índice Herfindahl-Hirschman (IHH)</h1>
  <p>
    <strong>Origen de los datos:</strong> ${esc(meta.archivoNombre || 'ingreso manual')} ·
    <strong>Fecha del informe:</strong> ${new Date().toLocaleDateString('es-CL')}
  </p>
  <p><strong>Partes de la operación:</strong> ${partes.length ? partes.map((p) => esc(p.nombre)).join(' + ') : 'no identificadas'}${
    partes.length >= 2 ? ` · <strong>Cuota conjunta:</strong> ${fmtPct(resultado.cuotaConjuntaPartes)}` : ''
  }</p>

  <div class="resumen">
    <div class="caja"><div>IHH pre-operación</div><div class="valor">${fmtIhh(resultado.hhiPre)}</div></div>
    <div class="caja"><div>IHH post-operación</div><div class="valor">${fmtIhh(resultado.hhiPost)}</div></div>
    <div class="caja"><div>ΔIHH</div><div class="valor">${fmtIhh(resultado.delta)}</div></div>
  </div>

  <div class="veredicto">
    <div><strong>Nivel de concentración:</strong> ${ETIQUETA_NIVEL[nivel].icono} ${ETIQUETA_NIVEL[nivel].texto}</div>
    <div><strong>Veredicto FNE:</strong> ${ETIQUETA_VEREDICTO[veredicto].icono} ${ETIQUETA_VEREDICTO[veredicto].texto}</div>
    <div class="nota">${esc(cita)}</div>
  </div>

  <h2>Índices complementarios</h2>
  <ul>
    <li>CR4 (suma de las cuatro mayores cuotas): <strong>${fmtPct(resultado.cr4)}</strong></li>
    <li>Agentes económicos en el mercado relevante: <strong>${resultado.numActores}</strong></li>
    <li>Agentes con cuota igual o superior a ${resultado.umbralSignificativo} %: <strong>${resultado.numSignificativos}</strong></li>
    <li>Tamaño del mercado: <strong>${fmtNum(resultado.mercadoTotal)}</strong></li>
  </ul>

  <h2>Mercado relevante analizado (antes de la operación)</h2>
  <p class="nota">La suma de la columna Cuota² es el IHH pre-operación: el cálculo es auditable línea por línea.</p>
  <table>
    <thead><tr><th>#</th><th>Agente económico</th><th class="num">Ventas</th><th class="num">Cuota</th><th class="num">Cuota²</th></tr></thead>
    <tbody>${filasTablaHTML(resultado.actoresOrdenados)}</tbody>
    <tfoot><tr><td></td><td><strong>TOTAL</strong></td><td class="num">${fmtNum(resultado.mercadoTotal)}</td><td class="num">100,00 %</td><td class="num"><strong>${fmtIhh(resultado.hhiPre)}</strong></td></tr></tfoot>
  </table>

  ${bloquePost}
  ${bloqueGrafico}
  ${bloqueEscenarios}
  ${bloqueArt48}

  <h2>Decisiones tomadas sobre los datos</h2>
  <h3 style="font-size:0.95rem">Empresas excluidas del mercado relevante</h3>
  ${excluidos.length ? `<ul>${excluidos.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="nota">Ninguna.</p>'}

  <h3 style="font-size:0.95rem">Razones sociales consolidadas como un mismo agente económico</h3>
  ${
    grupos.length
      ? `<ul>${grupos.map((g) => `<li><strong>${esc(g.nombre)}</strong>: ${g.nombresMiembros.map(esc).join(' + ')}</li>`).join('')}</ul>`
      : '<p class="nota">Ninguna agrupación manual. Las filas con el mismo nombre se sumaron automáticamente.</p>'
  }

  <h3 style="font-size:0.95rem">Filas del archivo no consideradas</h3>
  ${
    descartadas.length
      ? `<ul>${descartadas.map((d) => `<li>Fila ${d.fila}: "${esc(d.nombreOriginal)}" — ${esc(d.motivo)}</li>`).join('')}</ul>`
      : '<p class="nota">Ninguna.</p>'
  }

  <h2>Supuestos y limitaciones</h2>
  <ul>
    <li>El cálculo asume que las cuotas de las partes se suman íntegramente y que ningún competidor reacciona (no hay reasignación de ventas, entrada ni salida). Es el supuesto estándar del análisis estructural preliminar, no una proyección de mercado.</li>
    <li>Cubre el caso de adquisición completa. Para adquisiciones parciales o <em>joint ventures</em>, la Guía FNE utiliza índices IHH modificados (nota 50), fuera del alcance de esta herramienta.</li>
    <li>El IHH no es el único predictor del desempeño competitivo de un mercado (Guía FNE, párr. 32).</li>
    <li>No evalúa las circunstancias especiales del párrafo 36 (competidor potencial o entrante reciente, agente <em>maverick</em>, competidores cercanos, vínculos estructurales o contractuales, estructura tendiente a la coordinación, entre otras).</li>
    <li>La definición del mercado relevante fue establecida por el usuario; la herramienta no la valida ni la define.</li>
    <li>El resultado depende íntegramente de la calidad del dato de entrada y de que la variable medida (ventas, volumen, capacidad) sea la adecuada para el mercado analizado.</li>
  </ul>

  <p class="aviso">
    <strong>Este informe no constituye asesoría legal.</strong> Es un instrumento de tamizaje preliminar.
    La calificación final sobre si procede o no profundizar el análisis corresponde al criterio profesional
    del abogado responsable, conforme a la ${esc(GUIA_FNE.nombre)} de la ${esc(GUIA_FNE.organismo)}
    (vigente desde el ${new Date(GUIA_FNE.vigenteDesde + 'T00:00:00').toLocaleDateString('es-CL')}).
    Los umbrales normativos deben verificarse contra la versión vigente de las guías y resoluciones de la FNE.
  </p>
</body>
</html>`;

  descargarBlob(html, nombreConFecha('informe-ihh', 'html'), 'text/html;charset=utf-8');
}
