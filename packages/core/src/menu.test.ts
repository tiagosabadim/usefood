import { describe, expect, it } from 'vitest';
import { dimensoesReduzidas, erroNaRegra, regraDoGrupo } from './menu';

describe('regraDoGrupo', () => {
  it('descreve as combinações em português', () => {
    expect(regraDoGrupo(0, null)).toBe('Opcional, sem limite');
    expect(regraDoGrupo(0, 3)).toBe('Opcional, até 3');
    expect(regraDoGrupo(1, 1)).toBe('Obrigatório, escolha 1');
    expect(regraDoGrupo(1, null)).toBe('Escolha pelo menos 1');
    expect(regraDoGrupo(1, 2)).toBe('Escolha de 1 a 2');
  });
});

describe('erroNaRegra', () => {
  it('aceita regras válidas (as mesmas que o banco aceita)', () => {
    expect(erroNaRegra(0, null)).toBeNull();
    expect(erroNaRegra(1, 1)).toBeNull();
    expect(erroNaRegra(0, 5)).toBeNull();
  });

  it('recusa máximo menor que o mínimo ou zero', () => {
    expect(erroNaRegra(2, 1)).toMatch(/2 ou mais/);
    expect(erroNaRegra(0, 0)).toMatch(/1 ou mais/);
  });
});

describe('dimensoesReduzidas', () => {
  it('reduz pelo lado maior e mantém a proporção', () => {
    expect(dimensoesReduzidas(4000, 3000, 1200)).toEqual({ largura: 1200, altura: 900 });
    expect(dimensoesReduzidas(1080, 1920, 1200)).toEqual({ largura: 675, altura: 1200 });
  });

  it('não aumenta foto pequena', () => {
    expect(dimensoesReduzidas(800, 600, 1200)).toEqual({ largura: 800, altura: 600 });
  });
});
