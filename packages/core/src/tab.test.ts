import { describe, expect, it } from 'vitest';
import { identificacaoPara, rotuloDaConta, rotuloDoTipo, taxaPadrao } from './tab';

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

describe('identificacaoPara', () => {
  const senha = { chamarPor: 'senha', balcao: 'cliente_busca' } as const;
  const nome = { chamarPor: 'nome', balcao: 'cliente_busca' } as const;
  const garcom = { chamarPor: 'senha', balcao: 'garcom_leva' } as const;

  it('mesa sempre pede o número', () => {
    expect(identificacaoPara('mesa', senha)).toEqual({
      tipo: 'mesa',
      campo: { rotulo: 'Número da mesa', numerico: true },
    });
  });

  it('balcão e para viagem seguem a chamada da loja', () => {
    expect(identificacaoPara('balcao', senha)).toEqual({ tipo: 'senha', campo: null });
    expect(identificacaoPara('retirada', nome).tipo).toBe('nome');
  });

  it('com garçom levando, o balcão pede a mesa e não chama ninguém', () => {
    expect(identificacaoPara('balcao', garcom).tipo).toBe('mesa');
    expect(identificacaoPara('retirada', garcom).tipo).toBe('senha');
  });

  it('delivery pede o nome', () => {
    expect(identificacaoPara('delivery', senha).tipo).toBe('nome');
  });
});
