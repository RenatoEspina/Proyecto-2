// ui-tabla.js — renderizado de tablas y paneles. Solo DOM.
// Toda la lógica de negocio vive en motor-hhi.js / clasificador-fne.js / normalizacion.js.
//
// Los nombres de empresa vienen de un archivo que aporta el usuario: siempre se
// insertan con textContent, nunca con innerHTML, para que un archivo con contenido
// raro no pueda inyectar marcado en la página.

import { ETIQUETA_VEREDICTO } from './clasificador-fne.js';

export function fmtNum(n) {
  return Math.round(n).toLocaleString('es-CL');
}
export function fmtPct(n) {
  return `${n.toFixed(2)} %`;
}
export function fmtIhh(n) {
  return n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function crear(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

function celda(texto, clase) {
  const td = document.createElement('td');
  if (clase) td.className = clase;
  td.textContent = texto;
  return td;
}

/**
 * Panel "Mercado relevante": una línea por agente, con la casilla de inclusión y
 * la casilla de "parte de la operación".
 */
export function renderPanelMercado(contenedor, actores, onToggleIncluido, onToggleParte) {
  contenedor.innerHTML = '';
  // Se ordena por ventas, no por cuota: la cuota solo existe para los agentes
  // incluidos, y mezclar ambas escalas hacía que una empresa recién excluida
  // saltara al principio de la lista justo cuando el usuario acababa de tocarla.
  const ordenados = [...actores].sort((a, b) => b.ventas - a.ventas);

  for (const actor of ordenados) {
    const envoltorio = crear('div', 'bloque-actor' + (actor.esParte ? ' bloque-actor--parte' : ''));

    const fila = crear('div', 'fila-actor' + (actor.incluido ? '' : ' excluido'));

    const cbIncluido = document.createElement('input');
    cbIncluido.type = 'checkbox';
    cbIncluido.checked = actor.incluido;
    cbIncluido.id = `inc-${actor.id}`;
    cbIncluido.setAttribute('aria-label', `Incluir ${actor.nombre} en el mercado relevante`);
    cbIncluido.addEventListener('change', () => onToggleIncluido(actor.id));

    const nombre = document.createElement('label');
    nombre.className = 'nombre-actor';
    nombre.htmlFor = `inc-${actor.id}`;
    nombre.textContent = actor.nombre;
    if (actor.esGrupo) {
      nombre.appendChild(crear('span', 'badge-grupo', ' grupo'));
      nombre.title = `Agrupa: ${actor.miembros.map((m) => m.nombre).join(', ')}`;
    } else if (actor.aliases && actor.aliases.length > 1) {
      nombre.title = `Filas consolidadas: ${actor.aliases.join(' · ')}`;
    }

    const cuota = crear('span', 'cuota-actor', actor.incluido && actor.cuota != null ? fmtPct(actor.cuota) : '—');

    fila.append(cbIncluido, nombre, cuota);

    const filaParte = crear('div', 'fila-parte');
    const cbParte = document.createElement('input');
    cbParte.type = 'checkbox';
    cbParte.checked = actor.esParte;
    cbParte.disabled = !actor.incluido;
    cbParte.id = `parte-${actor.id}`;
    cbParte.addEventListener('change', () => onToggleParte(actor.id));
    const lblParte = document.createElement('label');
    lblParte.htmlFor = `parte-${actor.id}`;
    lblParte.textContent = '⚖ se fusiona (parte de la operación)';
    filaParte.append(cbParte, lblParte);

    envoltorio.append(fila, filaParte);
    contenedor.appendChild(envoltorio);
  }
}

/**
 * Tabla de detalle. `vista` decide si se muestra el mercado antes de la operación
 * (una fila por agente) o después (las partes fundidas en una sola entidad).
 */
export function renderTablaDetalle(tbody, resultado, vista = 'pre') {
  tbody.innerHTML = '';
  const esPost = vista === 'post';
  const filas = esPost ? resultado.actoresPost : resultado.actoresOrdenados;
  const totalIhh = esPost ? resultado.hhiPost : resultado.hhiPre;

  filas.forEach((a, i) => {
    const tr = document.createElement('tr');
    if (a.esParte) tr.className = 'parte';

    const tdNombre = document.createElement('td');
    tdNombre.textContent = a.nombre;
    if (a.esParte) tdNombre.appendChild(crear('span', 'badge-parte', ' ⚖'));

    tr.append(
      celda(String(i + 1)),
      tdNombre,
      celda(fmtNum(a.ventas), 'num'),
      celda(fmtPct(a.cuota), 'num'),
      celda(fmtIhh(a.cuotaCuadrado), 'num')
    );
    tbody.appendChild(tr);
  });

  const trTotal = document.createElement('tr');
  trTotal.className = 'fila-total';
  trTotal.append(
    celda(''),
    celda('TOTAL'),
    celda(fmtNum(resultado.mercadoTotal), 'num'),
    celda('100,00 %', 'num'),
    celda(`${fmtIhh(totalIhh)}  ← IHH ${esPost ? 'post' : 'pre'}`, 'num')
  );
  tbody.appendChild(trTotal);
}

/** Panel de filas consolidadas y descartadas. Nunca se oculta si hay algo que reportar. */
export function renderPanelDescartadas(contenedor, descartadas, consolidaciones) {
  contenedor.innerHTML = '';
  if (descartadas.length === 0 && consolidaciones.length === 0) {
    contenedor.hidden = true;
    return;
  }
  contenedor.hidden = false;

  const partes = [];
  if (consolidaciones.length) {
    const totalFilas = consolidaciones.reduce((a, c) => a + c.filasFusionadas, 0);
    partes.push(`${totalFilas} filas consolidadas en ${consolidaciones.length} empresa(s)`);
  }
  if (descartadas.length) partes.push(`${descartadas.length} fila(s) descartada(s)`);
  contenedor.appendChild(crear('div', 'resumen-advertencias', `⚠ ${partes.join(' · ')}`));

  if (consolidaciones.length) {
    const lista = crear('ul', 'lista-descartadas');
    consolidaciones.forEach((c) => {
      lista.appendChild(crear('li', null, `"${c.nombre}": ${c.filasFusionadas} filas sumadas en una sola`));
    });
    contenedor.appendChild(lista);
  }

  if (descartadas.length) {
    contenedor.appendChild(
      crear('p', 'nota', 'Revise estas filas: una fila mal descartada cambia el tamaño del mercado y, con él, todas las cuotas.')
    );
    const lista = crear('ul', 'lista-descartadas');
    descartadas.forEach((d) => {
      const li = document.createElement('li');
      li.textContent = `Fila ${d.fila}: "${d.nombreOriginal}" (${d.ventasCrudo ?? 'sin monto'}) — ${d.motivo}`;
      lista.appendChild(li);
    });
    contenedor.appendChild(lista);
  }
}

/** Vista previa de las primeras filas leídas, con las columnas elegidas resaltadas. */
export function renderVistaPrevia(contenedor, encabezados, filas, colEmpresa, colVentas) {
  contenedor.innerHTML = '';
  if (!encabezados.length) return;

  const tabla = crear('table', 'tabla-previa');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  encabezados.forEach((h, i) => {
    const th = document.createElement('th');
    th.textContent = h;
    if (i === colEmpresa) th.className = 'col-elegida col-empresa';
    if (i === colVentas) th.className = 'col-elegida col-ventas';
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  tabla.appendChild(thead);

  const tbody = document.createElement('tbody');
  filas.slice(0, 5).forEach((f) => {
    const tr = document.createElement('tr');
    encabezados.forEach((_, i) => {
      const td = celda(String(f[i] ?? ''));
      if (i === colEmpresa || i === colVentas) td.classList.add('col-elegida');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);
  contenedor.appendChild(tabla);
  if (filas.length > 5) {
    contenedor.appendChild(crear('p', 'nota', `… y ${filas.length - 5} filas más.`));
  }
}

/** Lista de casillas para elegir qué razones sociales forman un mismo grupo empresarial. */
export function renderListaAgrupables(contenedor, actores, seleccionados, onToggle) {
  contenedor.innerHTML = '';
  [...actores]
    .filter((a) => !a.esGrupo)
    .sort((a, b) => b.ventas - a.ventas)
    .forEach((actor) => {
      const fila = crear('label', 'fila-agrupable');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = seleccionados.has(actor.id);
      cb.addEventListener('change', () => onToggle(actor.id));
      fila.appendChild(cb);
      fila.appendChild(crear('span', null, `${actor.nombre} — ${fmtNum(actor.ventas)}`));
      contenedor.appendChild(fila);
    });
}

/** Grupos ya creados, con opción de deshacer. */
export function renderListaGrupos(contenedor, grupos, onDeshacer) {
  contenedor.innerHTML = '';
  if (!grupos.length) return;
  contenedor.appendChild(crear('p', 'rotulo-indicador', 'Grupos empresariales definidos'));
  grupos.forEach((g) => {
    const fila = crear('div', 'fila-grupo');
    fila.appendChild(crear('span', 'nombre-grupo', g.nombre));
    fila.appendChild(crear('span', 'nota', ` (${g.nombresMiembros.join(' + ')})`));
    const btn = crear('button', 'boton boton--texto boton--mini', 'Deshacer');
    btn.type = 'button';
    btn.addEventListener('click', () => onDeshacer(g.id));
    fila.appendChild(btn);
    contenedor.appendChild(fila);
  });
}

/** Tabla comparativa de escenarios guardados. */
export function renderEscenarios(tbody, escenarios, onEliminar) {
  tbody.innerHTML = '';
  escenarios.forEach((e) => {
    const tr = document.createElement('tr');
    const etiqueta = ETIQUETA_VEREDICTO[e.veredicto];
    const tdAccion = document.createElement('td');
    const btn = crear('button', 'boton boton--texto boton--mini', 'Eliminar');
    btn.type = 'button';
    btn.addEventListener('click', () => onEliminar(e.id));
    tdAccion.appendChild(btn);

    tr.append(
      celda(e.nombre),
      celda(String(e.numActores), 'num'),
      celda(fmtIhh(e.hhiPre), 'num'),
      celda(fmtIhh(e.hhiPost), 'num'),
      celda(fmtIhh(e.delta), 'num'),
      celda(`${etiqueta.icono} ${etiqueta.texto}`),
      tdAccion
    );
    tbody.appendChild(tr);
  });
}

/**
 * Tabla de ingreso manual de datos. Devuelve el control al orquestador en cada
 * cambio para que el estado viva en un solo lugar.
 */
export function renderTablaManual(tbody, filas, { onCambio, onEliminar, onPegar }) {
  tbody.innerHTML = '';
  filas.forEach((fila, i) => {
    const tr = document.createElement('tr');

    const tdNombre = document.createElement('td');
    const inpNombre = document.createElement('input');
    inpNombre.type = 'text';
    inpNombre.value = fila.nombre;
    inpNombre.placeholder = 'Nombre de la empresa';
    inpNombre.setAttribute('aria-label', `Nombre de la empresa ${i + 1}`);
    inpNombre.addEventListener('input', (e) => onCambio(i, 'nombre', e.target.value));
    if (i === 0 && onPegar) {
      inpNombre.addEventListener('paste', (e) => {
        const texto = e.clipboardData.getData('text');
        if (texto && /[\t\n]/.test(texto)) {
          e.preventDefault();
          onPegar(texto);
        }
      });
    }
    tdNombre.appendChild(inpNombre);

    const tdVentas = document.createElement('td');
    const inpVentas = document.createElement('input');
    inpVentas.type = 'text';
    inpVentas.inputMode = 'decimal';
    inpVentas.value = fila.ventas;
    inpVentas.placeholder = 'Ej.: 4.500.000';
    inpVentas.setAttribute('aria-label', `Ventas de la empresa ${i + 1}`);
    inpVentas.addEventListener('input', (e) => onCambio(i, 'ventas', e.target.value));
    tdVentas.appendChild(inpVentas);

    const tdAccion = document.createElement('td');
    const btn = crear('button', 'boton boton--texto boton--mini', '✕');
    btn.type = 'button';
    btn.title = 'Quitar esta fila';
    btn.addEventListener('click', () => onEliminar(i));
    tdAccion.appendChild(btn);

    tr.append(tdNombre, tdVentas, tdAccion);
    tbody.appendChild(tr);
  });
}
