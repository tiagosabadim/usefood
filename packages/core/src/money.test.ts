import { describe, expect, it } from 'vitest';
import { formatarPreco, lerPreco, precoParaCampo } from './money';

describe('formatarPreco', () => {
  it('formata em reais', () => {
    expect(formatarPreco(1400)).toBe('R$\u00a014,00');
    expect(formatarPreco(123456)).toBe('R$\u00a01.234,56');
    expect(formatarPreco(0)).toBe('R$\u00a00,00');
  });
});

describe('lerPreco', () => {
  it('entende os jeitos comuns de digitar', () => {
    expect(lerPreco('14')).toBe(1400);
    expect(lerPreco('14,5')).toBe(1450);
    expect(lerPreco('14,90')).toBe(1490);
    expect(lerPreco('R$ 1.234,56')).toBe(123456);
    expect(lerPreco(' 9,99 ')).toBe(999);
  });

  it('recusa o que não é preço', () => {
    expect(lerPreco('')).toBeNull();
    expect(lerPreco('abc')).toBeNull();
    expect(lerPreco('14,999')).toBeNull();
    expect(lerPreco('-5')).toBeNull();
  });

  it('não perde centavos por arredondamento', () => {
    expect(lerPreco('0,29')).toBe(29);
    expect(lerPreco('1,15')).toBe(115);
  });
});

describe('precoParaCampo', () => {
  it('volta para o formato do campo', () => {
    expect(precoParaCampo(1490)).toBe('14,90');
  });
});
