// ingesta.js — carga y parseo de archivos CSV/Excel en el navegador.
// Usa PapaParse (CSV, con autodetección de delimitador) y SheetJS (Excel).
// No calcula nada: entrega una matriz de filas crudas para que normalizacion.js las procese.

/* global Papa, XLSX */

/**
 * Decodifica el contenido de un archivo de texto detectando la codificación.
 *
 * Excel en configuración regional chilena exporta CSV en windows-1252 (Latin-1),
 * no en UTF-8 (§6.2 del plan). Si se decodifica mal, "Compañía" llega como
 * "Compa??a" y el nombre de la empresa queda corrupto en todo el informe.
 *
 * Estrategia: intentar UTF-8 en modo estricto; si el decodificador rechaza el
 * contenido, rehacerlo como windows-1252, que nunca falla (todo byte es válido).
 *
 * @returns {{texto:string, encoding:string}}
 */
export function decodificarTexto(buffer) {
  const bytes = new Uint8Array(buffer);
  try {
    const texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { texto: texto.replace(/^﻿/, ''), encoding: 'UTF-8' };
  } catch {
    const texto = new TextDecoder('windows-1252').decode(bytes);
    return { texto, encoding: 'windows-1252 (Excel Chile)' };
  }
}

/**
 * Lee un File y devuelve la tabla cruda más los metadatos que la interfaz necesita
 * para dejar que el usuario corrija la interpretación (hoja, fila de encabezado).
 *
 * @param {File} file
 * @param {{hoja?:string, filaEncabezado?:number}} [opciones]
 */
export async function leerArchivo(file, opciones = {}) {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) {
    return leerCSV(file, opciones);
  }
  if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
    return leerExcel(file, opciones);
  }
  throw new Error('Formato no soportado. Use un archivo .csv, .xlsx o .xls.');
}

/**
 * PapaParse falla en detectar el delimitador ("UndetectableDelimiter") cuando el
 * archivo trae filas basura sin delimitador antes del encabezado (título, logo,
 * confidencialidad, típico de exportaciones de Excel Chile — ver §6.2 del plan).
 * Se sniffea a mano: el delimitador que aparece en más líneas del archivo gana.
 */
export function detectarDelimitador(texto) {
  const candidatos = [',', ';', '\t', '|'];
  const lineas = texto.split(/\r\n|\n/).filter((l) => l.trim() !== '');
  let mejor = ',';
  let mejorCobertura = -1;
  for (const candidato of candidatos) {
    const cobertura = lineas.filter((l) => l.includes(candidato)).length;
    if (cobertura > mejorCobertura) {
      mejorCobertura = cobertura;
      mejor = candidato;
    }
  }
  return mejor;
}

/** Parsea texto CSV ya decodificado. Se expone aparte para poder cargar los ejemplos embebidos. */
export function parsearTextoCSV(texto, opciones = {}) {
  const delimiter = detectarDelimitador(texto);
  const resultados = Papa.parse(texto, { delimiter, skipEmptyLines: 'greedy' });
  const matriz = resultados.data;
  if (!matriz || matriz.length === 0) {
    throw new Error('El archivo CSV está vacío.');
  }
  return {
    ...extraerTabla(matriz, opciones.filaEncabezado),
    matriz,
    delimitador: delimiter,
    hojas: null,
    hojaActiva: null,
  };
}

async function leerCSV(file, opciones) {
  const { texto, encoding } = decodificarTexto(await file.arrayBuffer());
  return { ...parsearTextoCSV(texto, opciones), encoding };
}

/**
 * Elige qué hoja abrir cuando el usuario no ha indicado una.
 *
 * Los archivos reales suelen traer una portada, un índice o una hoja de notas
 * antes de la tabla de ventas; abrir siempre la primera obligaría al usuario a
 * descubrir por su cuenta el selector de hojas. Se toma la primera hoja que
 * parezca una tabla: al menos dos columnas y al menos dos filas con contenido.
 */
function elegirHojaConDatos(libro) {
  for (const nombre of libro.SheetNames) {
    const matriz = XLSX.utils.sheet_to_json(libro.Sheets[nombre], {
      header: 1,
      defval: '',
      blankrows: false,
      raw: true,
    });
    const filasUtiles = matriz.filter((f) => f.filter((c) => String(c ?? '').trim() !== '').length >= 2);
    if (filasUtiles.length >= 2) return nombre;
  }
  return libro.SheetNames[0];
}

async function leerExcel(file, opciones) {
  const buffer = await file.arrayBuffer();
  const libro = XLSX.read(buffer, { type: 'array', cellDates: false });
  const hojas = libro.SheetNames;
  const hojaActiva =
    opciones.hoja && hojas.includes(opciones.hoja) ? opciones.hoja : elegirHojaConDatos(libro);
  const hoja = libro.Sheets[hojaActiva];
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', blankrows: false, raw: true });
  if (!matriz || matriz.length === 0) {
    throw new Error(`La hoja "${hojaActiva}" del archivo Excel no tiene datos.`);
  }
  return {
    ...extraerTabla(matriz, opciones.filaEncabezado),
    matriz,
    hojas,
    hojaActiva,
    delimitador: null,
    encoding: 'Excel',
  };
}

/**
 * Detecta cuál fila de una matriz cruda es el encabezado real (permite filas basura
 * de título/logo arriba, según §6.2 del plan). Heurística: la primera fila con al
 * menos 2 celdas de texto no vacías y sin que la mayoría sean números.
 */
export function detectarFilaEncabezado(matriz) {
  const limite = Math.min(matriz.length, 10);
  for (let i = 0; i < limite; i++) {
    const fila = matriz[i];
    const celdasNoVacias = fila.filter((c) => String(c ?? '').trim() !== '');
    if (celdasNoVacias.length < 2) continue;
    const numericas = celdasNoVacias.filter((c) => !Number.isNaN(Number(String(c).replace(/[.,]/g, ''))) && String(c).trim() !== '');
    if (numericas.length / celdasNoVacias.length < 0.5) {
      return i;
    }
  }
  return 0;
}

/**
 * Corta una matriz cruda en encabezados + filas de datos.
 * @param {any[][]} matriz
 * @param {number} [filaEncabezado] si se omite, se detecta automáticamente
 */
export function extraerTabla(matriz, filaEncabezado) {
  const indice =
    Number.isInteger(filaEncabezado) && filaEncabezado >= 0 && filaEncabezado < matriz.length
      ? filaEncabezado
      : detectarFilaEncabezado(matriz);

  const encabezados = (matriz[indice] || []).map((h, i) => {
    const texto = String(h ?? '').trim();
    return texto || `Columna ${i + 1}`;
  });
  const filas = matriz
    .slice(indice + 1)
    .filter((f) => f.some((c) => String(c ?? '').trim() !== ''));
  return { encabezados, filas, filaEncabezadoDetectada: indice };
}
