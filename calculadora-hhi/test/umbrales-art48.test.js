import { describe, it, expect } from 'vitest';
import { evaluarUmbralesArt48, ART48 } from '../src/umbrales-art48.js';

// UF de referencia usada en las pruebas: con 1.000 pesos por UF los montos en pesos
// se leen directamente como miles de UF, lo que hace los casos verificables a mano.
const UF = 1000;

describe('evaluarUmbralesArt48 — art. 48 inciso 2° DL 211', () => {
  it('exige que se cumplan ambos umbrales de forma copulativa', () => {
    // Conjunto: 3.000.000 UF (≥ 2.500.000). Individual: dos agentes sobre 450.000 UF.
    const r = evaluarUmbralesArt48(
      [
        { nombre: 'A', ventasChileCLP: 2_000_000 * UF },
        { nombre: 'B', ventasChileCLP: 1_000_000 * UF },
      ],
      UF
    );
    expect(r.cumpleConjunto).toBe(true);
    expect(r.cumpleIndividual).toBe(true);
    expect(r.debeNotificarse).toBe(true);
  });

  it('no obliga a notificar si el umbral conjunto no se alcanza', () => {
    const r = evaluarUmbralesArt48(
      [
        { nombre: 'A', ventasChileCLP: 1_000_000 * UF },
        { nombre: 'B', ventasChileCLP: 500_000 * UF },
      ],
      UF
    );
    expect(r.sumaUF).toBe(1_500_000);
    expect(r.cumpleConjunto).toBe(false);
    expect(r.cumpleIndividual).toBe(true);
    expect(r.debeNotificarse).toBe(false);
  });

  it('no obliga a notificar si solo un agente supera el umbral individual', () => {
    const r = evaluarUmbralesArt48(
      [
        { nombre: 'Grande', ventasChileCLP: 2_900_000 * UF },
        { nombre: 'Chico', ventasChileCLP: 100_000 * UF },
      ],
      UF
    );
    expect(r.cumpleConjunto).toBe(true);
    expect(r.sobreIndividual).toBe(1);
    expect(r.cumpleIndividual).toBe(false);
    expect(r.debeNotificarse).toBe(false);
  });

  it('trata los umbrales como "iguales o superiores" (criterio opuesto al párr. 35 de la Guía)', () => {
    const r = evaluarUmbralesArt48(
      [
        { nombre: 'A', ventasChileCLP: ART48.umbralIndividualUF * UF },
        { nombre: 'B', ventasChileCLP: (ART48.umbralConjuntoUF - ART48.umbralIndividualUF) * UF },
      ],
      UF
    );
    expect(r.sumaUF).toBe(ART48.umbralConjuntoUF);
    expect(r.cumpleConjunto).toBe(true);
    expect(r.detalle[0].superaIndividual).toBe(true); // exactamente 450.000 UF sí cuenta
    expect(r.debeNotificarse).toBe(true);
  });

  it('exige al menos dos agentes con ventas informadas', () => {
    expect(() => evaluarUmbralesArt48([{ nombre: 'A', ventasChileCLP: 100 }], UF)).toThrow(/al menos dos/);
  });

  it('rechaza un valor de UF inválido', () => {
    expect(() => evaluarUmbralesArt48([{ nombre: 'A', ventasChileCLP: 1 }], 0)).toThrow(/UF mayor a cero/);
    expect(() => evaluarUmbralesArt48([{ nombre: 'A', ventasChileCLP: 1 }], null)).toThrow(/UF mayor a cero/);
  });
});
