import { describe, it, expect } from 'vitest';
import { parsearNumero, pareceFilaDeTotal, detectarColumnas, consolidarActores, agruparManualmente } from '../src/normalizacion.js';

describe('parsearNumero', () => {
  it('parsea números simples', () => {
    expect(parsearNumero('4500000')).toBe(4500000);
    expect(parsearNumero(4500000)).toBe(4500000);
  });
  it('parsea formato es-CL con miles y decimales: 1.234.567,89', () => {
    expect(parsearNumero('1.234.567,89')).toBeCloseTo(1234567.89, 6);
  });
  it('parsea símbolo de moneda y espacios: "$ 4.500.000"', () => {
    expect(parsearNumero('$ 4.500.000')).toBe(4500000);
  });
  it('parsea separador de miles chileno sin decimales: "500.000"', () => {
    expect(parsearNumero('500.000')).toBe(500000);
  });
  it('parsea formato en-US con miles: "1,234,567.89"', () => {
    expect(parsearNumero('1,234,567.89')).toBeCloseTo(1234567.89, 6);
  });
  it('parsea decimal simple: "1234.56"', () => {
    expect(parsearNumero('1234.56')).toBeCloseTo(1234.56, 6);
  });
  it('devuelve null para texto no interpretable', () => {
    expect(parsearNumero('n/a')).toBeNull();
    expect(parsearNumero('')).toBeNull();
    expect(parsearNumero(null)).toBeNull();
    expect(parsearNumero(undefined)).toBeNull();
  });
  it('preserva números negativos (la validación de negativos es responsabilidad de consolidarActores)', () => {
    expect(parsearNumero('-200000')).toBe(-200000);
  });
});

describe('pareceFilaDeTotal', () => {
  it('detecta filas de totales sin importar mayúsculas/tildes', () => {
    expect(pareceFilaDeTotal('TOTAL')).toBe(true);
    expect(pareceFilaDeTotal('Total')).toBe(true);
    expect(pareceFilaDeTotal('Gran Total')).toBe(true);
    expect(pareceFilaDeTotal('Subtotal')).toBe(true);
  });
  it('no confunde un nombre de empresa que contiene "total"', () => {
    expect(pareceFilaDeTotal('Total Chile S.A.')).toBe(false);
  });
});

describe('detectarColumnas', () => {
  it('detecta columnas por sinónimos comunes', () => {
    expect(detectarColumnas(['Razón Social', 'Ventas'])).toEqual({ colEmpresa: 0, colVentas: 1 });
    expect(detectarColumnas(['Competidor', 'Monto'])).toEqual({ colEmpresa: 0, colVentas: 1 });
  });
  it('devuelve -1 si no encuentra coincidencias', () => {
    expect(detectarColumnas(['Fecha', 'Región'])).toEqual({ colEmpresa: -1, colVentas: -1 });
  });
});

describe('consolidarActores', () => {
  it('consolida variantes de un mismo nombre sumando ventas', () => {
    const filas = [
      { fila: 1, nombreOriginal: 'EMPRESA ALFA S.A.', ventasCrudo: '1.000.000' },
      { fila: 2, nombreOriginal: 'Empresa Alfa SA', ventasCrudo: '500000' },
    ];
    const { actores, consolidaciones } = consolidarActores(filas);
    expect(actores).toHaveLength(1);
    expect(actores[0].ventas).toBe(1500000);
    expect(consolidaciones).toHaveLength(1);
    expect(consolidaciones[0].filasFusionadas).toBe(2);
  });

  it('NO consolida filiales con nombre distinto (requiere agrupación manual)', () => {
    const filas = [
      { fila: 1, nombreOriginal: 'Alfa Retail SpA', ventasCrudo: '100000' },
      { fila: 2, nombreOriginal: 'Alfa Distribución Ltda.', ventasCrudo: '50000' },
    ];
    const { actores } = consolidarActores(filas);
    expect(actores).toHaveLength(2);
  });

  it('descarta filas con ventas negativas y las reporta', () => {
    const filas = [{ fila: 1, nombreOriginal: 'Empresa X', ventasCrudo: '-100' }];
    const { actores, descartadas } = consolidarActores(filas);
    expect(actores).toHaveLength(0);
    expect(descartadas).toHaveLength(1);
    expect(descartadas[0].motivo).toMatch(/negativas/);
  });

  it('descarta la fila de totales', () => {
    const filas = [
      { fila: 1, nombreOriginal: 'Empresa X', ventasCrudo: '100' },
      { fila: 2, nombreOriginal: 'TOTAL', ventasCrudo: '100' },
    ];
    const { actores, descartadas } = consolidarActores(filas);
    expect(actores).toHaveLength(1);
    expect(descartadas).toHaveLength(1);
    expect(descartadas[0].motivo).toBe('Fila de totales');
  });

  it('trata ventas vacías/no interpretables como fila descartada', () => {
    const filas = [{ fila: 1, nombreOriginal: 'Empresa Y', ventasCrudo: '' }];
    const { actores, descartadas } = consolidarActores(filas);
    expect(actores).toHaveLength(0);
    expect(descartadas).toHaveLength(1);
  });
});

describe('agruparManualmente', () => {
  it('funde varios actores en uno bajo la matriz indicada', () => {
    const actores = [
      { id: 'alfa-retail', nombre: 'Alfa Retail SpA', ventas: 100, aliases: ['Alfa Retail SpA'], incluido: true, esParte: false },
      { id: 'alfa-distribucion', nombre: 'Alfa Distribución Ltda.', ventas: 50, aliases: ['Alfa Distribución Ltda.'], incluido: true, esParte: false },
      { id: 'beta', nombre: 'Beta S.A.', ventas: 200, aliases: ['Beta S.A.'], incluido: true, esParte: false },
    ];
    const resultado = agruparManualmente(actores, ['alfa-retail', 'alfa-distribucion'], 'alfa-retail');
    expect(resultado).toHaveLength(2);
    const alfa = resultado.find((a) => a.id === 'alfa-retail');
    expect(alfa.ventas).toBe(150);
    expect(alfa.aliases).toContain('Alfa Distribución Ltda.');
  });
});
