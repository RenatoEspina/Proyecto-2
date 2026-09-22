import { describe, it, expect } from 'vitest';
import { nivelConcentracion, veredictoFNE, NIVEL, VEREDICTO } from '../src/clasificador-fne.js';

describe('nivelConcentracion', () => {
  it('clasifica < 1500 como desconcentrado', () => {
    expect(nivelConcentracion(1499)).toBe(NIVEL.DESCONCENTRADO);
  });
  it('clasifica [1500,2500) como moderadamente concentrado', () => {
    expect(nivelConcentracion(1500)).toBe(NIVEL.MODERADAMENTE_CONCENTRADO);
    expect(nivelConcentracion(2499)).toBe(NIVEL.MODERADAMENTE_CONCENTRADO);
  });
  it('clasifica >= 2500 como altamente concentrado', () => {
    expect(nivelConcentracion(2500)).toBe(NIVEL.ALTAMENTE_CONCENTRADO);
  });
});

describe('veredictoFNE — árbol de decisión párrafo 35', () => {
  it('T1: HHI post 2500, delta 0 → descarte (2500 alto, delta<100)', () => {
    expect(veredictoFNE(2500, 0, 2)).toBe(VEREDICTO.DESCARTE);
  });

  it('T2: HHI post 4200, delta 1200 → análisis en profundidad', () => {
    expect(veredictoFNE(4200, 1200, 2)).toBe(VEREDICTO.ANALISIS_PROFUNDIDAD);
  });

  it('T4: HHI post 100 → descarte (desconcentrado)', () => {
    expect(veredictoFNE(100, 0, 2)).toBe(VEREDICTO.DESCARTE);
  });

  it('T6: HHI post 3400, delta 800 → análisis en profundidad', () => {
    expect(veredictoFNE(3400, 800, 2)).toBe(VEREDICTO.ANALISIS_PROFUNDIDAD);
  });

  it('T7 (caso límite, el más importante): HHI post 2000, delta EXACTAMENTE 200 → análisis, no descarte', () => {
    // párr. 36: los umbrales que se "igualen o sobrepasen" activan el análisis.
    // delta < 200 sería descarte; delta === 200 NO es < 200, por lo tanto no cae en el safe harbour.
    expect(veredictoFNE(2000, 200, 2)).toBe(VEREDICTO.ANALISIS_PROFUNDIDAD);
  });

  it('T8: HHI post 2000, delta 150 → descarte (150 < 200)', () => {
    expect(veredictoFNE(2000, 150, 2)).toBe(VEREDICTO.DESCARTE);
  });

  it('un HHI post de exactamente 1500 con delta de exactamente 200 no cae en el safe harbour', () => {
    expect(veredictoFNE(1500, 200, 2)).toBe(VEREDICTO.ANALISIS_PROFUNDIDAD);
  });

  it('HHI post >= 2500 con delta exactamente 100 no cae en el safe harbour', () => {
    expect(veredictoFNE(2500, 100, 2)).toBe(VEREDICTO.ANALISIS_PROFUNDIDAD);
  });

  it('con menos de 2 partes seleccionadas, el veredicto es SIN_OPERACION', () => {
    expect(veredictoFNE(3000, 0, 1)).toBe(VEREDICTO.SIN_OPERACION);
    expect(veredictoFNE(3000, 0, 0)).toBe(VEREDICTO.SIN_OPERACION);
  });
});
