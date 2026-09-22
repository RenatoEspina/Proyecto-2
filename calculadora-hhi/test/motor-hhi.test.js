import { describe, it, expect } from 'vitest';
import { calcularCuotas, hhi, analizarOperacion } from '../src/motor-hhi.js';

function actores(ventas) {
  return ventas.map((v, i) => ({ id: `e${i}`, nombre: `Empresa ${i}`, ventas: v }));
}

describe('calcularCuotas', () => {
  it('calcula cuotas en puntos porcentuales que suman 100', () => {
    const cuotas = calcularCuotas(actores([400, 300, 200, 100]));
    expect(cuotas.map((c) => c.cuota)).toEqual([40, 30, 20, 10]);
  });

  it('lanza error si el mercado tiene tamaño cero', () => {
    expect(() => calcularCuotas(actores([0, 0, 0]))).toThrow(/mayor a cero/);
  });
});

describe('hhi', () => {
  it('suma los cuadrados de las cuotas', () => {
    expect(hhi([40, 30, 20, 10])).toBe(1600 + 900 + 400 + 100);
  });
});

describe('analizarOperacion — casos de prueba del plan (§10)', () => {
  it('T1: 250,250,250,250 sin partes → HHI 2500, delta 0', () => {
    const r = analizarOperacion(actores([250, 250, 250, 250]), []);
    expect(r.hhiPre).toBeCloseTo(2500, 6);
    expect(r.delta).toBe(0);
    expect(r.hhiPost).toBeCloseTo(2500, 6);
  });

  it('T2: 400,300,200,100 con B+C → HHI pre 3000, delta 1200, post 4200', () => {
    const act = actores([400, 300, 200, 100]);
    const r = analizarOperacion(act, [act[1].id, act[2].id]);
    expect(r.hhiPre).toBeCloseTo(3000, 6);
    expect(r.delta).toBeCloseTo(1200, 6);
    expect(r.hhiPost).toBeCloseTo(4200, 6);
    // Verificación cruzada: para 2 partes, ΔIHH = 2 · s1 · s2
    expect(r.delta).toBeCloseTo(2 * 30 * 20, 6);
  });

  it('T3: una sola empresa → HHI 10000', () => {
    const r = analizarOperacion(actores([1000]), []);
    expect(r.hhiPre).toBeCloseTo(10000, 6);
  });

  it('T4: 100 empresas de 10 c/u → HHI 100', () => {
    const r = analizarOperacion(actores(Array(100).fill(10)), []);
    expect(r.hhiPre).toBeCloseTo(100, 6);
  });

  it('T5: 1,1,1 → HHI 3333.33...', () => {
    const r = analizarOperacion(actores([1, 1, 1]), []);
    expect(r.hhiPre).toBeCloseTo(3333.3333333, 5);
  });

  it('T6: 300,300,200,200 con C+D → HHI pre 2600, delta 800, post 3400', () => {
    const act = actores([300, 300, 200, 200]);
    const r = analizarOperacion(act, [act[2].id, act[3].id]);
    expect(r.hhiPre).toBeCloseTo(2600, 6);
    expect(r.delta).toBeCloseTo(800, 6);
    expect(r.hhiPost).toBeCloseTo(3400, 6);
  });

  it('T7 (caso límite): 200,200,200,200,100,100 con E+F → delta exactamente 200', () => {
    const act = actores([200, 200, 200, 200, 100, 100]);
    const r = analizarOperacion(act, [act[4].id, act[5].id]);
    expect(r.hhiPre).toBeCloseTo(1800, 6);
    expect(r.delta).toBeCloseTo(200, 6);
    expect(r.hhiPost).toBeCloseTo(2000, 6);
  });

  it('T8: 200,200,200,200,150,50 con E+F → delta 150, post 2000', () => {
    const act = actores([200, 200, 200, 200, 150, 50]);
    const r = analizarOperacion(act, [act[4].id, act[5].id]);
    expect(r.hhiPre).toBeCloseTo(1850, 6);
    expect(r.delta).toBeCloseTo(150, 6);
    expect(r.hhiPost).toBeCloseTo(2000, 6);
  });

  it('T9: mercado de tamaño cero lanza error', () => {
    expect(() => analizarOperacion(actores([0, 0, 0]), [])).toThrow();
  });

  it('con menos de 2 partes seleccionadas, delta es 0', () => {
    const act = actores([400, 300, 200, 100]);
    const r = analizarOperacion(act, [act[0].id]);
    expect(r.delta).toBe(0);
    expect(r.numPartes).toBe(1);
  });

  it('no redondea en pasos intermedios (RNF-04)', () => {
    const act = actores([1, 1, 1]);
    const r = analizarOperacion(act, []);
    // 100/3 tiene decimales infinitos; el resultado no debe estar redondeado a enteros.
    expect(Number.isInteger(r.hhiPre)).toBe(false);
  });
});
