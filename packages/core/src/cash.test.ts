import { describe, expect, it } from 'vitest';
import { horaCurta, resultadoDoFechamento } from './cash';

describe('resultadoDoFechamento', () => {
  it('diz se bateu, sobrou ou faltou', () => {
    expect(resultadoDoFechamento(0)).toEqual({ texto: 'Bateu certinho', tom: 'sucesso' });
    expect(resultadoDoFechamento(350)).toEqual({ texto: 'Sobrou R$\u00a03,50', tom: 'destaque' });
    expect(resultadoDoFechamento(-200)).toEqual({ texto: 'Faltou R$\u00a02,00', tom: 'erro' });
  });
});

describe('horaCurta', () => {
  it('mostra a hora no fuso da loja', () => {
    expect(horaCurta('2026-10-02T11:12:00Z')).toBe('08:12');
  });
});
