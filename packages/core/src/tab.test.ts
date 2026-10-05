import { describe, expect, it } from 'vitest';
import {
  DADOS_INICIAIS,
  identificacaoPara,
  parametrosDoPedido,
  rotuloDaConta,
  rotuloDoTipo,
  taxaPadrao,
} from './tab';

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

describe('parametrosDoPedido', () => {
  const senha = { chamarPor: 'senha', balcao: 'cliente_busca' } as const;
  const entrega = {
    ...DADOS_INICIAIS,
    tipo: 'delivery' as const,
    identificador: 'Maria',
    celular: '(17) 99123-4567',
    taxaEntrega: '5',
    endereco: { ...DADOS_INICIAIS.endereco, rua: 'Rua A', numero: '10', bairro: 'Centro' },
  };

  it('delivery sem endereço avisa o que falta', () => {
    const p = parametrosDoPedido({ ...entrega, endereco: DADOS_INICIAIS.endereco }, senha);
    expect(p).toEqual({ ok: false, motivo: 'Para entregar, preencha rua, número e bairro.' });
  });
  const nome = { chamarPor: 'nome', balcao: 'cliente_busca' } as const;

  it('balcão com senha não pede nada', () => {
    const p = parametrosDoPedido(DADOS_INICIAIS, senha);
    expect(p.ok && p.p_identificador_tipo).toBe('senha');
    expect(p.ok && p.p_identificador).toBeNull();
  });

  it('para viagem chamando por nome exige o nome', () => {
    expect(parametrosDoPedido({ ...DADOS_INICIAIS, tipo: 'retirada' }, nome)).toEqual({
      ok: false,
      motivo: 'Digite o nome do cliente.',
    });
    const p = parametrosDoPedido(
      { ...DADOS_INICIAIS, tipo: 'retirada', identificador: ' Ana ' },
      nome,
    );
    expect(p.ok && p.p_identificador).toBe('Ana');
  });

  it('delivery leva a forma de pagamento e o troco', () => {
    const p = parametrosDoPedido({ ...entrega, previsto: 'dinheiro', trocoPara: '100' }, senha);
    expect(p.ok && [p.p_pagamento_previsto, p.p_troco_para_cents]).toEqual(['dinheiro', 10000]);
    expect(p.ok && p.p_endereco?.bairro).toBe('Centro');
    expect(p.ok && p.p_taxa_entrega_cents).toBe(500);
    expect(p.ok && p.p_celular).toBe('17991234567');
  });

  it('troco inválido é avisado', () => {
    const p = parametrosDoPedido({ ...entrega, previsto: 'dinheiro', trocoPara: 'abc' }, senha);
    expect(p.ok).toBe(false);
  });

  it('mesa não leva forma de pagamento prevista', () => {
    const p = parametrosDoPedido(
      { ...DADOS_INICIAIS, tipo: 'mesa', identificador: '5', previsto: 'pix' },
      senha,
    );
    expect(p.ok && p.p_pagamento_previsto).toBeNull();
  });
});
