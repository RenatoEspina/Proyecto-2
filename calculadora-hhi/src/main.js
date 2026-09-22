// main.js — orquestación y estado de la aplicación. Conecta ingesta, normalización,
// motor de cálculo, clasificador FNE y las vistas. Único módulo con estado mutable.

import { leerArchivo, extraerTabla } from './ingesta.js';
import { consolidarActores, detectarColumnas, aplicarGrupos, parsearNumero } from './normalizacion.js';
import { analizarOperacion } from './motor-hhi.js';
import {
  nivelConcentracion,
  veredictoFNE,
  citaNormativa,
  ETIQUETA_NIVEL,
  ETIQUETA_VEREDICTO,
  VEREDICTO,
} from './clasificador-fne.js';
import { evaluarUmbralesArt48, explicarArt48 } from './umbrales-art48.js';
import {
  renderPanelMercado,
  renderTablaDetalle,
  renderPanelDescartadas,
  renderVistaPrevia,
  renderListaAgrupables,
  renderListaGrupos,
  renderEscenarios,
  renderTablaManual,
  fmtNum,
  fmtPct,
  fmtIhh,
} from './ui-tabla.js';
import { renderGrafico, graficoComoPNG } from './ui-grafico.js';
import { exportarCSV, exportarInformeHTML } from './exportar.js';

// ─────────────────────────────── Estado ───────────────────────────────

const estado = {
  origenNombre: null, // qué se le muestra al usuario como procedencia de los datos
  archivo: null, // File original, para releerlo si cambia la hoja o la fila de encabezado
  lectura: null, // { encabezados, filas, matriz, hojas, hojaActiva, filaEncabezadoDetectada }
  mapeo: { colEmpresa: -1, colVentas: -1 },
  base: [], // agentes consolidados tal como salieron del archivo
  descartadas: [],
  consolidaciones: [],
  grupos: [], // agrupaciones manuales: [{ id, nombre, idsMiembros, nombresMiembros }]
  marcas: new Map(), // id -> { incluido, esParte }; sobrevive a las agrupaciones
  actores: [], // derivado de base + grupos + marcas
  vista: 'pre',
  umbralSignificativo: 5,
  escenarios: [],
  contadorEscenarios: 0,
  ultimoResultado: null,
  art48: null,
  manual: [], // filas del editor manual
  seleccionAgrupacion: new Set(),
};

// ─────────────────────────────── Referencias al DOM ───────────────────────────────

const $ = (id) => document.getElementById(id);
const el = {
  errorGlobal: $('error-global'),
  btnAyuda: $('btn-ayuda'),
  btnReiniciar: $('btn-reiniciar'),
  modalAyuda: $('modal-ayuda'),
  btnCerrarAyuda: $('btn-cerrar-ayuda'),

  dropzone: $('dropzone'),
  inputArchivo: $('input-archivo'),
  btnModoManual: $('btn-modo-manual'),

  panelManual: $('panel-manual'),
  cuerpoManual: $('cuerpo-manual'),
  btnAgregarFila: $('btn-agregar-fila'),
  btnCancelarManual: $('btn-cancelar-manual'),
  btnUsarManual: $('btn-usar-manual'),

  resumenLectura: $('resumen-lectura'),
  resumenArchivo: $('resumen-archivo'),
  panelDescartadas: $('panel-descartadas'),
  detallesLectura: $('detalles-lectura'),
  labelHoja: $('label-hoja'),
  selectHoja: $('select-hoja'),
  selectFilaEncabezado: $('select-fila-encabezado'),
  selectColEmpresa: $('select-col-empresa'),
  selectColVentas: $('select-col-ventas'),
  vistaPrevia: $('vista-previa'),

  seccionResultados: $('seccion-resultados'),
  panelMercado: $('panel-mercado'),
  tamanoMercado: $('tamano-mercado'),
  btnSeleccionarTodos: $('btn-seleccionar-todos'),
  btnAgrupar: $('btn-agrupar'),
  panelAgrupacion: $('panel-agrupacion'),
  listaAgrupables: $('lista-agrupables'),
  inputNombreGrupo: $('input-nombre-grupo'),
  btnCancelarAgrupar: $('btn-cancelar-agrupar'),
  btnConfirmarAgrupar: $('btn-confirmar-agrupar'),
  listaGrupos: $('lista-grupos'),

  hhiPre: $('hhi-pre'),
  hhiPost: $('hhi-post'),
  deltaIhh: $('delta-ihh'),
  nivelTexto: $('nivel-texto'),
  veredictoTexto: $('veredicto-texto'),
  citaNormativa: $('cita-normativa'),
  avisoParrafo36: $('aviso-parrafo-36'),
  cr4: $('cr4'),
  numActores: $('num-actores'),
  numSignificativos: $('num-significativos'),
  inputUmbralSignificativo: $('input-umbral-significativo'),
  canvasGrafico: $('grafico-participacion'),

  btnGuardarEscenario: $('btn-guardar-escenario'),
  seccionEscenarios: $('seccion-escenarios'),
  cuerpoEscenarios: $('cuerpo-escenarios'),
  btnBorrarEscenarios: $('btn-borrar-escenarios'),

  btnVerPre: $('btn-ver-pre'),
  btnVerPost: $('btn-ver-post'),
  tablaDetalleBody: document.querySelector('#tabla-detalle tbody'),
  btnExportarCSV: $('btn-exportar-csv'),
  btnExportarInforme: $('btn-exportar-informe'),

  inputValorUF: $('input-valor-uf'),
  cuerpoArt48: $('cuerpo-art48'),
  btnAgregarAgenteArt48: $('btn-agregar-agente-art48'),
  btnCalcularArt48: $('btn-calcular-art48'),
  resultadoArt48: $('resultado-art48'),
};

function mostrarError(mensaje) {
  el.errorGlobal.textContent = mensaje || '';
  el.errorGlobal.hidden = !mensaje;
  if (mensaje) el.errorGlobal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─────────────────────────────── Derivación del estado ───────────────────────────────

/**
 * Reconstruye la lista de trabajo desde la base del archivo, aplicando las
 * agrupaciones manuales y devolviendo a cada agente las marcas que el usuario ya
 * le había puesto (incluido / parte de la operación).
 */
function reconstruirActores() {
  estado.actores = aplicarGrupos(estado.base, estado.grupos).map((a) => {
    const marca = estado.marcas.get(a.id) || marcaHeredada(a);
    return { ...a, incluido: marca.incluido ?? true, esParte: marca.esParte ?? false };
  });
}

/**
 * Un grupo empresarial recién creado hereda las marcas de sus miembros: si el
 * usuario ya había señalado a la matriz como parte de la operación, agrupar sus
 * filiales no debe borrar ese trabajo. Basta con que un miembro esté marcado.
 */
function marcaHeredada(actor) {
  if (!actor.esGrupo) return {};
  const marcas = actor.miembros.map((m) => estado.marcas.get(m.id)).filter(Boolean);
  if (!marcas.length) return {};
  return {
    incluido: marcas.some((m) => m.incluido !== false),
    esParte: marcas.some((m) => m.esParte === true),
  };
}

function marcar(id, cambios) {
  const actual = estado.marcas.get(id) || { incluido: true, esParte: false };
  estado.marcas.set(id, { ...actual, ...cambios });
}

const actoresIncluidos = () => estado.actores.filter((a) => a.incluido);
const idsPartes = () => estado.actores.filter((a) => a.esParte && a.incluido).map((a) => a.id);

// ─────────────────────────────── Cálculo y pintado ───────────────────────────────

function recalcular() {
  mostrarError('');
  reconstruirActores();

  const incluidos = actoresIncluidos();
  if (incluidos.length === 0) {
    mostrarError('Todas las empresas están excluidas del mercado relevante. Incluya al menos una para poder calcular.');
    el.seccionResultados.hidden = false;
    pintarPanelMercado();
    return;
  }

  let resultado;
  try {
    resultado = analizarOperacion(incluidos, idsPartes(), {
      umbralSignificativo: estado.umbralSignificativo,
    });
  } catch (e) {
    mostrarError(e.message);
    pintarPanelMercado();
    return;
  }

  // Devuelve la cuota calculada a la lista completa, para pintarla junto a cada agente.
  const cuotaPorId = new Map(resultado.actores.map((a) => [a.id, a.cuota]));
  estado.actores.forEach((a) => {
    a.cuota = a.incluido ? cuotaPorId.get(a.id) : null;
  });

  el.seccionResultados.hidden = false;
  el.btnReiniciar.hidden = false;

  el.tamanoMercado.textContent = fmtNum(resultado.mercadoTotal);
  el.hhiPre.textContent = fmtIhh(resultado.hhiPre);
  el.hhiPost.textContent = fmtIhh(resultado.hhiPost);
  el.deltaIhh.textContent = resultado.numPartes >= 2 ? `+ ${fmtIhh(resultado.delta)}` : '—';

  const nivel = nivelConcentracion(resultado.hhiPost);
  const veredicto = veredictoFNE(resultado.hhiPost, resultado.delta, resultado.numPartes);
  el.nivelTexto.textContent = `${ETIQUETA_NIVEL[nivel].icono} ${ETIQUETA_NIVEL[nivel].texto}`;
  el.nivelTexto.className = `nivel nivel--${nivel.toLowerCase()}`;
  el.veredictoTexto.textContent = `${ETIQUETA_VEREDICTO[veredicto].icono} ${ETIQUETA_VEREDICTO[veredicto].texto}`;
  el.veredictoTexto.className = `veredicto veredicto--${veredicto.toLowerCase()}`;
  el.citaNormativa.textContent = citaNormativa(resultado.hhiPost, resultado.delta, resultado.numPartes);

  el.cr4.textContent = fmtPct(resultado.cr4);
  el.numActores.textContent = String(resultado.numActores);
  el.numSignificativos.textContent = String(resultado.numSignificativos);

  pintarAvisos(resultado, veredicto, incluidos);
  pintarPanelMercado();
  renderListaGrupos(el.listaGrupos, estado.grupos, deshacerGrupo);
  renderTablaDetalle(el.tablaDetalleBody, resultado, estado.vista);
  renderGrafico(el.canvasGrafico, resultado, estado.vista);

  estado.ultimoResultado = resultado;
}

function pintarAvisos(resultado, veredicto, incluidos) {
  const avisos = [];

  if (resultado.numPartes < 2) {
    avisos.push(
      'Para obtener el ΔIHH y el veredicto, marque «se fusiona» en al menos dos empresas del panel de la izquierda.'
    );
  }
  if (veredicto === VEREDICTO.DESCARTE) {
    avisos.push(
      'Recordatorio (Guía FNE, párr. 36): aun cayendo en la zona de descarte, la FNE puede analizar con mayor detención operaciones con circunstancias especiales —competidor potencial o entrante reciente, agente maverick, competidores cercanos, vínculos estructurales o contractuales, estructura tendiente a la coordinación, entre otras—.'
    );
  }
  if (incluidos.length === 1) {
    avisos.push(
      'Advertencia: hay una sola empresa en el mercado relevante. Un monopolio preexistente (IHH 10.000) no es un mercado analizable con esta herramienta.'
    );
  }
  if (estado.actores.some((a) => a.esParte && !a.incluido)) {
    avisos.push(
      'Advertencia: una empresa marcada como parte de la operación está excluida del mercado relevante, por lo que el ΔIHH no la está considerando.'
    );
  }
  avisos.push(
    'El IHH no es un predictor único del desempeño competitivo del mercado (Guía FNE, párr. 32). Este resultado no constituye asesoría legal.'
  );

  el.avisoParrafo36.innerHTML = '';
  avisos.forEach((texto) => {
    const p = document.createElement('p');
    p.textContent = texto;
    el.avisoParrafo36.appendChild(p);
  });
}

function pintarPanelMercado() {
  renderPanelMercado(
    el.panelMercado,
    estado.actores,
    (id) => {
      const actor = estado.actores.find((a) => a.id === id);
      const incluido = !actor.incluido;
      marcar(id, { incluido, ...(incluido ? {} : { esParte: false }) });
      recalcular();
    },
    (id) => {
      const actor = estado.actores.find((a) => a.id === id);
      marcar(id, { esParte: !actor.esParte });
      recalcular();
    }
  );
}

// ─────────────────────────────── Carga de datos ───────────────────────────────

function cargarBase(actores, descartadas, consolidaciones, origenNombre) {
  estado.base = actores;
  estado.descartadas = descartadas;
  estado.consolidaciones = consolidaciones;
  estado.origenNombre = origenNombre;
  estado.grupos = [];
  estado.marcas = new Map();
  estado.seleccionAgrupacion = new Set();

  const totalFilas = descartadas.length + actores.reduce((acc, a) => acc + a.aliases.length, 0);
  el.resumenLectura.hidden = false;
  el.resumenArchivo.textContent = `📄 ${origenNombre} · ${totalFilas} filas leídas → ${actores.length} agentes económicos`;
  renderPanelDescartadas(el.panelDescartadas, descartadas, consolidaciones);

  recalcular();
  el.seccionResultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Rehace la tabla de agentes desde la lectura cruda actual y el mapeo de columnas vigente. */
function procesarLectura() {
  const { filas } = estado.lectura;
  const { colEmpresa, colVentas } = estado.mapeo;

  if (colEmpresa === -1 || colVentas === -1) {
    mostrarError(
      'No se pudo identificar automáticamente cuál columna tiene el nombre de la empresa y cuál tiene las ventas. ' +
        'Abra «¿La tabla se leyó mal?» y elíjalas usted en los desplegables.'
    );
    el.resumenLectura.hidden = false;
    el.detallesLectura.open = true;
    pintarControlesLectura();
    return;
  }
  if (colEmpresa === colVentas) {
    mostrarError('La columna de empresa y la de ventas no pueden ser la misma. Elija columnas distintas.');
    el.detallesLectura.open = true;
    return;
  }

  const filasCrudas = filas.map((f, i) => ({
    fila: i + estado.lectura.filaEncabezadoDetectada + 2,
    nombreOriginal: f[colEmpresa],
    ventasCrudo: f[colVentas],
  }));

  const { actores, descartadas, consolidaciones } = consolidarActores(filasCrudas);
  if (actores.length === 0) {
    mostrarError(
      'No se pudo extraer ninguna empresa válida. Revise en «¿La tabla se leyó mal?» que las columnas y la fila de títulos sean las correctas.'
    );
    el.detallesLectura.open = true;
    pintarControlesLectura();
    return;
  }
  pintarControlesLectura();
  cargarBase(actores, descartadas, consolidaciones, estado.origenNombre);
}

/** Pinta los desplegables de corrección de lectura (hoja, fila de títulos, columnas). */
function pintarControlesLectura() {
  const { encabezados, filas, matriz, hojas, hojaActiva, filaEncabezadoDetectada } = estado.lectura;

  el.labelHoja.hidden = !(hojas && hojas.length > 1);
  if (hojas && hojas.length > 1) {
    el.selectHoja.innerHTML = '';
    hojas.forEach((h) => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      opt.selected = h === hojaActiva;
      el.selectHoja.appendChild(opt);
    });
  }

  el.selectFilaEncabezado.innerHTML = '';
  matriz.slice(0, 15).forEach((fila, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    const muestra = fila
      .map((c) => String(c ?? '').trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(' | ');
    opt.textContent = `Fila ${i + 1}: ${muestra.slice(0, 60) || '(vacía)'}`;
    opt.selected = i === filaEncabezadoDetectada;
    el.selectFilaEncabezado.appendChild(opt);
  });

  [
    [el.selectColEmpresa, estado.mapeo.colEmpresa],
    [el.selectColVentas, estado.mapeo.colVentas],
  ].forEach(([select, elegido]) => {
    select.innerHTML = '';
    encabezados.forEach((h, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = h;
      opt.selected = i === elegido;
      select.appendChild(opt);
    });
  });

  renderVistaPrevia(el.vistaPrevia, encabezados, filas, estado.mapeo.colEmpresa, estado.mapeo.colVentas);
}

function adoptarLectura(lectura, origenNombre) {
  estado.lectura = lectura;
  estado.origenNombre = origenNombre;
  estado.mapeo = detectarColumnas(lectura.encabezados, lectura.filas.slice(0, 20));
  procesarLectura();
}

async function procesarArchivo(file, nombreParaMostrar, opciones = {}) {
  mostrarError('');
  try {
    estado.archivo = file;
    const lectura = await leerArchivo(file, opciones);
    adoptarLectura(lectura, nombreParaMostrar || file.name);
  } catch (e) {
    const esFormato = /Formato no soportado/.test(e.message);
    mostrarError(
      `No se pudo leer el archivo: ${e.message}` +
        (esFormato ? '' : ' Si el archivo está abierto en Excel, ciérrelo e inténtelo de nuevo.')
    );
  }
}

// ─────────────────────────────── Ingreso manual ───────────────────────────────

function abrirManual(prefijo = null) {
  estado.manual = prefijo && prefijo.length ? prefijo : [{ nombre: '', ventas: '' }, { nombre: '', ventas: '' }, { nombre: '', ventas: '' }];
  el.panelManual.hidden = false;
  pintarManual();
  el.panelManual.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function pintarManual() {
  renderTablaManual(el.cuerpoManual, estado.manual, {
    onCambio: (i, campo, valor) => {
      estado.manual[i][campo] = valor;
    },
    onEliminar: (i) => {
      estado.manual.splice(i, 1);
      if (estado.manual.length === 0) estado.manual.push({ nombre: '', ventas: '' });
      pintarManual();
    },
    onPegar: (texto) => {
      const filas = texto
        .split(/\r?\n/)
        .map((l) => l.split('\t'))
        .filter((c) => c.some((v) => String(v).trim() !== ''))
        .map((c) => ({ nombre: String(c[0] ?? '').trim(), ventas: String(c[1] ?? '').trim() }));
      if (filas.length) {
        estado.manual = filas;
        pintarManual();
      }
    },
  });
}

function usarDatosManuales() {
  const filasCrudas = estado.manual
    .filter((f) => String(f.nombre).trim() !== '' || String(f.ventas).trim() !== '')
    .map((f, i) => ({ fila: i + 1, nombreOriginal: f.nombre, ventasCrudo: f.ventas }));

  if (filasCrudas.length < 1) {
    mostrarError('Escriba al menos una empresa con sus ventas.');
    return;
  }

  const { actores, descartadas, consolidaciones } = consolidarActores(filasCrudas);
  if (actores.length === 0) {
    mostrarError('Ninguna de las filas escritas es válida. Revise que los montos sean números positivos.');
    return;
  }
  estado.lectura = null;
  estado.archivo = null;
  el.panelManual.hidden = true;
  el.resumenLectura.hidden = false;
  el.detallesLectura.hidden = true;
  cargarBase(actores, descartadas, consolidaciones, 'datos escritos a mano');
}

/** Lleva los agentes actuales (y las filas descartadas) al editor manual para corregirlos. */
function corregirAMano() {
  const filas = [
    ...estado.actores.map((a) => ({ nombre: a.nombre, ventas: String(a.ventas) })),
    ...estado.descartadas.map((d) => ({
      nombre: String(d.nombreOriginal ?? ''),
      ventas: String(d.ventasCrudo ?? ''),
    })),
  ];
  abrirManual(filas);
}

// ─────────────────────────────── Agrupación de filiales ───────────────────────────────

function abrirAgrupacion() {
  estado.seleccionAgrupacion = new Set();
  el.inputNombreGrupo.value = '';
  el.panelAgrupacion.hidden = false;
  pintarAgrupables();
}

function pintarAgrupables() {
  renderListaAgrupables(el.listaAgrupables, estado.actores, estado.seleccionAgrupacion, (id) => {
    if (estado.seleccionAgrupacion.has(id)) estado.seleccionAgrupacion.delete(id);
    else estado.seleccionAgrupacion.add(id);
    // Propone como nombre del grupo el de la empresa más grande seleccionada.
    if (!el.inputNombreGrupo.value || el.inputNombreGrupo.dataset.auto === 'si') {
      const elegidos = estado.actores.filter((a) => estado.seleccionAgrupacion.has(a.id));
      const mayor = elegidos.sort((a, b) => b.ventas - a.ventas)[0];
      el.inputNombreGrupo.value = mayor ? mayor.nombre : '';
      el.inputNombreGrupo.dataset.auto = 'si';
    }
    pintarAgrupables();
  });
}

function confirmarAgrupacion() {
  const ids = [...estado.seleccionAgrupacion];
  if (ids.length < 2) {
    mostrarError('Seleccione al menos dos razones sociales para agruparlas bajo un mismo agente económico.');
    return;
  }
  const nombre = el.inputNombreGrupo.value.trim();
  if (!nombre) {
    mostrarError('Escriba el nombre con el que debe aparecer el grupo empresarial.');
    return;
  }
  const nombresMiembros = estado.base.filter((a) => ids.includes(a.id)).map((a) => a.nombre);
  estado.grupos.push({
    id: `grupo-${estado.grupos.length + 1}-${ids[0]}`,
    nombre,
    idsMiembros: ids,
    nombresMiembros,
  });
  el.panelAgrupacion.hidden = true;
  estado.seleccionAgrupacion = new Set();
  recalcular();
}

function deshacerGrupo(idGrupo) {
  estado.grupos = estado.grupos.filter((g) => g.id !== idGrupo);
  estado.marcas.delete(idGrupo);
  recalcular();
}

// ─────────────────────────────── Escenarios ───────────────────────────────

function guardarEscenario() {
  if (!estado.ultimoResultado) return;
  const r = estado.ultimoResultado;
  const excluidos = estado.actores.filter((a) => !a.incluido).map((a) => a.nombre);
  const sugerido = `Escenario ${estado.contadorEscenarios + 1}${excluidos.length ? ` (sin ${excluidos.slice(0, 2).join(', ')}${excluidos.length > 2 ? '…' : ''})` : ' (mercado completo)'}`;
  const nombre = window.prompt('¿Con qué nombre quiere guardar este escenario?', sugerido);
  if (nombre === null) return;

  estado.contadorEscenarios += 1;
  estado.escenarios.push({
    id: `esc-${estado.contadorEscenarios}`,
    nombre: nombre.trim() || sugerido,
    numActores: r.numActores,
    hhiPre: r.hhiPre,
    hhiPost: r.hhiPost,
    delta: r.delta,
    veredicto: veredictoFNE(r.hhiPost, r.delta, r.numPartes),
    excluidos,
  });
  pintarEscenarios();
}

function pintarEscenarios() {
  el.seccionEscenarios.hidden = estado.escenarios.length === 0;
  renderEscenarios(el.cuerpoEscenarios, estado.escenarios, (id) => {
    estado.escenarios = estado.escenarios.filter((e) => e.id !== id);
    pintarEscenarios();
  });
}

// ─────────────────────────────── Art. 48 DL 211 ───────────────────────────────

function filasArt48() {
  return [...el.cuerpoArt48.querySelectorAll('tr')].map((tr) => {
    const inputs = tr.querySelectorAll('input');
    return { nombre: inputs[0].value.trim(), ventasChileCLP: parsearNumero(inputs[1].value) };
  });
}

function agregarFilaArt48(nombre = '') {
  const tr = document.createElement('tr');

  const tdNombre = document.createElement('td');
  const inpNombre = document.createElement('input');
  inpNombre.type = 'text';
  inpNombre.value = nombre;
  inpNombre.placeholder = 'Nombre del agente económico';
  inpNombre.setAttribute('aria-label', 'Nombre del agente económico');
  tdNombre.appendChild(inpNombre);

  const tdVentas = document.createElement('td');
  const inpVentas = document.createElement('input');
  inpVentas.type = 'text';
  inpVentas.inputMode = 'decimal';
  inpVentas.placeholder = 'Ventas totales en Chile, en pesos';
  inpVentas.setAttribute('aria-label', 'Ventas totales en Chile');
  tdVentas.appendChild(inpVentas);

  const tdAccion = document.createElement('td');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'boton boton--texto boton--mini';
  btn.textContent = '✕';
  btn.addEventListener('click', () => tr.remove());
  tdAccion.appendChild(btn);

  tr.append(tdNombre, tdVentas, tdAccion);
  el.cuerpoArt48.appendChild(tr);
}

function calcularArt48() {
  const valorUF = parsearNumero(el.inputValorUF.value);
  try {
    const resultado = evaluarUmbralesArt48(filasArt48(), valorUF);
    const explicacion = explicarArt48(resultado);
    estado.art48 = { ...resultado, explicacion };

    el.resultadoArt48.hidden = false;
    el.resultadoArt48.className = `resultado-art48 ${resultado.debeNotificarse ? 'resultado-art48--si' : 'resultado-art48--no'}`;
    el.resultadoArt48.innerHTML = '';

    const titulo = document.createElement('p');
    titulo.className = 'veredicto';
    titulo.textContent = resultado.debeNotificarse
      ? '⚠️ Se cumplen ambos umbrales: la operación debería notificarse a la FNE.'
      : 'ℹ️ No se cumplen ambos umbrales: la operación no quedaría sujeta a notificación obligatoria.';
    el.resultadoArt48.appendChild(titulo);

    explicacion.forEach((linea) => {
      const p = document.createElement('p');
      p.className = 'nota';
      p.textContent = linea;
      el.resultadoArt48.appendChild(p);
    });

    const pie = document.createElement('p');
    pie.className = 'nota';
    pie.textContent =
      'Verifique el valor de la UF y el ejercicio aplicable contra la fuente oficial antes de usar esta conclusión. Cálculo complementario, fuera del alcance del análisis de IHH.';
    el.resultadoArt48.appendChild(pie);
  } catch (e) {
    estado.art48 = null;
    el.resultadoArt48.hidden = false;
    el.resultadoArt48.className = 'resultado-art48 resultado-art48--error';
    el.resultadoArt48.textContent = e.message;
  }
}

// ─────────────────────────────── Exportación ───────────────────────────────

function metaExportacion() {
  return {
    archivoNombre: estado.origenNombre,
    excluidos: estado.actores.filter((a) => !a.incluido).map((a) => a.nombre),
    grupos: estado.grupos,
    descartadas: estado.descartadas,
    escenarios: estado.escenarios,
    art48: estado.art48,
    graficoPNG: graficoComoPNG(el.canvasGrafico),
  };
}

// ─────────────────────────────── Reinicio ───────────────────────────────

function reiniciar() {
  Object.assign(estado, {
    origenNombre: null,
    archivo: null,
    lectura: null,
    mapeo: { colEmpresa: -1, colVentas: -1 },
    base: [],
    descartadas: [],
    consolidaciones: [],
    grupos: [],
    marcas: new Map(),
    actores: [],
    vista: 'pre',
    escenarios: [],
    contadorEscenarios: 0,
    ultimoResultado: null,
    art48: null,
    manual: [],
    seleccionAgrupacion: new Set(),
  });
  el.inputArchivo.value = '';
  el.seccionResultados.hidden = true;
  el.resumenLectura.hidden = true;
  el.detallesLectura.hidden = false;
  el.panelManual.hidden = true;
  el.panelAgrupacion.hidden = true;
  el.btnReiniciar.hidden = true;
  el.seccionEscenarios.hidden = true;
  el.cuerpoArt48.innerHTML = '';
  el.inputValorUF.value = '';
  el.resultadoArt48.hidden = true;
  document.querySelector('.seccion-art48').open = false;
  mostrarError('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────── Eventos ───────────────────────────────

function conectarEventos() {
  // Ayuda
  el.btnAyuda.addEventListener('click', () => {
    el.modalAyuda.hidden = false;
  });
  el.btnCerrarAyuda.addEventListener('click', () => {
    el.modalAyuda.hidden = true;
  });
  el.modalAyuda.addEventListener('click', (e) => {
    if (e.target === el.modalAyuda) el.modalAyuda.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') el.modalAyuda.hidden = true;
  });
  el.btnReiniciar.addEventListener('click', reiniciar);

  // Carga de archivo
  el.inputArchivo.addEventListener('change', (e) => {
    if (e.target.files[0]) procesarArchivo(e.target.files[0]);
  });
  ['dragenter', 'dragover'].forEach((evt) =>
    el.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      el.dropzone.classList.add('dropzone--activo');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    el.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      el.dropzone.classList.remove('dropzone--activo');
    })
  );
  el.dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) procesarArchivo(file);
  });
  el.dropzone.addEventListener('click', () => el.inputArchivo.click());
  el.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.inputArchivo.click();
    }
  });

  // Ingreso manual
  el.btnModoManual.addEventListener('click', () => abrirManual());
  el.btnAgregarFila.addEventListener('click', () => {
    estado.manual.push({ nombre: '', ventas: '' });
    pintarManual();
  });
  el.btnCancelarManual.addEventListener('click', () => {
    el.panelManual.hidden = true;
  });
  el.btnUsarManual.addEventListener('click', usarDatosManuales);

  // Corrección de la lectura
  el.selectHoja.addEventListener('change', () => {
    if (estado.archivo) procesarArchivo(estado.archivo, estado.origenNombre, { hoja: el.selectHoja.value });
  });
  el.selectFilaEncabezado.addEventListener('change', () => {
    const indice = Number(el.selectFilaEncabezado.value);
    estado.lectura = { ...estado.lectura, ...extraerTabla(estado.lectura.matriz, indice) };
    estado.mapeo = detectarColumnas(estado.lectura.encabezados, estado.lectura.filas.slice(0, 20));
    procesarLectura();
    el.detallesLectura.open = true;
  });
  el.selectColEmpresa.addEventListener('change', () => {
    estado.mapeo = { ...estado.mapeo, colEmpresa: Number(el.selectColEmpresa.value) };
    procesarLectura();
    el.detallesLectura.open = true;
  });
  el.selectColVentas.addEventListener('change', () => {
    estado.mapeo = { ...estado.mapeo, colVentas: Number(el.selectColVentas.value) };
    procesarLectura();
    el.detallesLectura.open = true;
  });

  // Mercado relevante
  el.btnSeleccionarTodos.addEventListener('click', () => {
    const todosIncluidos = estado.actores.every((a) => a.incluido);
    estado.actores.forEach((a) => marcar(a.id, { incluido: !todosIncluidos, esParte: todosIncluidos ? false : a.esParte }));
    recalcular();
  });
  el.btnAgrupar.addEventListener('click', abrirAgrupacion);
  el.btnCancelarAgrupar.addEventListener('click', () => {
    el.panelAgrupacion.hidden = true;
  });
  el.btnConfirmarAgrupar.addEventListener('click', confirmarAgrupacion);
  el.inputNombreGrupo.addEventListener('input', () => {
    el.inputNombreGrupo.dataset.auto = 'no';
  });

  // Índices complementarios
  el.inputUmbralSignificativo.addEventListener('change', () => {
    const v = Number(el.inputUmbralSignificativo.value);
    estado.umbralSignificativo = Number.isFinite(v) && v >= 0 ? v : 5;
    recalcular();
  });

  // Vista pre / post
  const cambiarVista = (vista) => {
    estado.vista = vista;
    el.btnVerPre.classList.toggle('activo', vista === 'pre');
    el.btnVerPost.classList.toggle('activo', vista === 'post');
    if (estado.ultimoResultado) {
      renderTablaDetalle(el.tablaDetalleBody, estado.ultimoResultado, vista);
      renderGrafico(el.canvasGrafico, estado.ultimoResultado, vista);
    }
  };
  el.btnVerPre.addEventListener('click', () => cambiarVista('pre'));
  el.btnVerPost.addEventListener('click', () => cambiarVista('post'));

  // Escenarios
  el.btnGuardarEscenario.addEventListener('click', guardarEscenario);
  el.btnBorrarEscenarios.addEventListener('click', () => {
    estado.escenarios = [];
    pintarEscenarios();
  });

  // Exportación
  el.btnExportarCSV.addEventListener('click', () => {
    if (estado.ultimoResultado) exportarCSV(estado.ultimoResultado, metaExportacion());
  });
  el.btnExportarInforme.addEventListener('click', () => {
    if (estado.ultimoResultado) exportarInformeHTML(estado.ultimoResultado, metaExportacion());
  });

  // Art. 48
  el.btnAgregarAgenteArt48.addEventListener('click', () => agregarFilaArt48());
  el.btnCalcularArt48.addEventListener('click', calcularArt48);
  document.querySelector('.seccion-art48').addEventListener('toggle', (e) => {
    if (!e.target.open || el.cuerpoArt48.children.length) return;
    // Al abrir por primera vez, propone los nombres de las partes ya marcadas.
    const partes = estado.actores.filter((a) => a.esParte);
    if (partes.length >= 2) partes.forEach((p) => agregarFilaArt48(p.nombre));
    else {
      agregarFilaArt48();
      agregarFilaArt48();
    }
  });
}

// Botón "corregir a mano", inyectado junto al resumen de lectura para no duplicar
// marcado en index.html: solo tiene sentido cuando ya hay datos cargados.
function montarBotonCorregir() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'boton boton--texto';
  btn.textContent = 'Revisar y corregir los datos a mano';
  btn.addEventListener('click', corregirAMano);
  el.resumenArchivo.after(btn);
}

conectarEventos();
montarBotonCorregir();
