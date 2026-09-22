import { describe, it, expect } from 'vitest';
import { aplicarGrupos, detectarColumnas } from '../src/normalizacion.js';
import { analizarOperacion } from '../src/motor-hhi.js';

const base = [
  { id: 'alfa-retail', nombre: 'Alfa Retail SpA', ventas: 100, aliases: ['Alfa Retail SpA'] },
  { id: 'alfa-distribucion', nombre: 'Alfa Distribución Ltda.', ventas: 50, aliases: ['Alfa Distribución Ltda.'] },
  { id: 'beta', nombre: 'Beta S.A.', ventas: 200, aliases: ['Beta S.A.'] },
];

describe('aplicarGrupos — consolidación de filiales bajo un agente económico', () => {
  it('sin grupos devuelve la base intacta', () => {
    const r = aplicarGrupos(base, []);
    expect(r).toHaveLength(3);
    expect(r.map((a) => a.ventas)).toEqual([100, 50, 200]);
  });

  it('funde los miembros del grupo en un solo agente que suma sus ventas', () => {
    const r = aplicarGrupos(base, [
      { id: 'g1', nombre: 'Grupo Alfa', idsMiembros: ['alfa-retail', 'alfa-distribucion'] },
    ]);
    expect(r).toHaveLength(2);
    const grupo = r.find((a) => a.id === 'g1');
    expect(grupo.ventas).toBe(150);
    expect(grupo.esGrupo).toBe(true);
    expect(grupo.miembros.map((m) => m.nombre)).toEqual(['Alfa Retail SpA', 'Alfa Distribución Ltda.']);
  });

  it('es reversible: quitar el grupo devuelve exactamente la base original', () => {
    const conGrupo = aplicarGrupos(base, [{ id: 'g1', nombre: 'Grupo Alfa', idsMiembros: ['alfa-retail', 'alfa-distribucion'] }]);
    expect(conGrupo).toHaveLength(2);
    const sinGrupo = aplicarGrupos(base, []);
    expect(sinGrupo.map((a) => a.id)).toEqual(['alfa-retail', 'alfa-distribucion', 'beta']);
    expect(sinGrupo.reduce((s, a) => s + a.ventas, 0)).toBe(350);
  });

  it('ignora grupos cuyos miembros ya no existen en la base', () => {
    const r = aplicarGrupos(base, [{ id: 'g9', nombre: 'Fantasma', idsMiembros: ['no-existe'] }]);
    expect(r).toHaveLength(3);
  });

  it('agrupar filiales cambia el IHH: es una decisión jurídica con efecto en el cálculo', () => {
    const sinAgrupar = analizarOperacion(aplicarGrupos(base, []), []);
    const agrupado = analizarOperacion(
      aplicarGrupos(base, [{ id: 'g1', nombre: 'Grupo Alfa', idsMiembros: ['alfa-retail', 'alfa-distribucion'] }]),
      []
    );
    // Cuotas sin agrupar: 28,57 / 14,29 / 57,14 → IHH ≈ 4285,7
    // Cuotas agrupando:   42,86 / 57,14          → IHH ≈ 5102,0
    expect(sinAgrupar.hhiPre).toBeCloseTo(4285.71, 1);
    expect(agrupado.hhiPre).toBeCloseTo(5102.04, 1);
  });
});

describe('analizarOperacion — mercado post-operación y complementarios', () => {
  const actores = [400, 300, 200, 100].map((v, i) => ({ id: `e${i}`, nombre: `E${i}`, ventas: v }));

  it('construye el mercado post fundiendo las partes en una sola entidad', () => {
    const r = analizarOperacion(actores, ['e1', 'e2']);
    expect(r.actoresPost).toHaveLength(3);
    const fusion = r.actoresPost.find((a) => a.esEntidadFusionada);
    expect(fusion.cuota).toBeCloseTo(50, 10);
    // La suma de cuota² del mercado post es exactamente el IHH post: el informe es auditable.
    const sumaCuadrados = r.actoresPost.reduce((acc, a) => acc + a.cuotaCuadrado, 0);
    expect(sumaCuadrados).toBeCloseTo(r.hhiPost, 10);
    expect(r.hhiPost).toBeCloseTo(4200, 10);
  });

  it('sin operación, el mercado post es igual al pre', () => {
    const r = analizarOperacion(actores, []);
    expect(r.actoresPost).toHaveLength(4);
    expect(r.actoresPost.every((a) => !a.esEntidadFusionada)).toBe(true);
  });

  it('cuenta los competidores significativos según el umbral indicado', () => {
    const r = analizarOperacion(actores, [], { umbralSignificativo: 25 });
    expect(r.numSignificativos).toBe(2); // 40 % y 30 %
    expect(r.numActores).toBe(4);
    expect(r.cr4).toBeCloseTo(100, 10);
  });
});

describe('detectarColumnas — respaldo por contenido', () => {
  it('usa las filas de muestra cuando los encabezados no dicen nada', () => {
    const { colEmpresa, colVentas } = detectarColumnas(
      ['Columna 1', 'Columna 2'],
      [
        ['Alfa S.A.', '1.000.000'],
        ['Beta Ltda.', '500.000'],
      ]
    );
    expect(colEmpresa).toBe(0);
    expect(colVentas).toBe(1);
  });

  it('no asigna la misma columna a empresa y a ventas', () => {
    const { colEmpresa, colVentas } = detectarColumnas(['Ventas por empresa', 'Monto'], []);
    expect(colEmpresa).toBe(0);
    expect(colVentas).not.toBe(0);
  });
});
