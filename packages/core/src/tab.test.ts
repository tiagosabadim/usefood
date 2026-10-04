import { describe, expect, it } from 'vitest';
import { rotuloDaConta, rotuloDoTipo, taxaPadrao } from './tab';

describe('rotuloDaConta', () => {
  it('nomeia a conta pelo identificador', () => {
    expect(rotuloDaConta('mesa', '12')).toBe('Mesa 12');
    expect(rotuloDaConta('senha', '047')).toBe('Senha 047');
    expect(rotuloDaConta('nome', 'João')).toBe('João');
    expect(rotuloDaConta('comanda', '230')).toBe('Comanda 230');
  });
});

describe('tipo e taxa', () => {
  it('só a mesa começa com a taxa ligada', () => {
    expect(taxaPadrao('mesa')).toBe(true);
    expect(taxaPadrao('balcao')).toBe(false);
    expect(rotuloDoTipo('delivery')).toBe('Delivery');
  });
});
