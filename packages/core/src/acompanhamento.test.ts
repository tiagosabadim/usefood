import { describe, expect, it } from 'vitest';
import { etapasDoPedido, fraseDoPedido } from './acompanhamento';

const estados = (tipo: string, s: Parameters<typeof etapasDoPedido>[1]) =>
  etapasDoPedido(tipo, s).map((e) => e.estado);

describe('etapasDoPedido', () => {
  it('entrega: aguardando, preparo, saiu e entregue', () => {
    expect(estados('delivery', 'aguardando')).toEqual(['atual', 'futuro', 'futuro', 'futuro']);
    expect(estados('delivery', 'pronto')).toEqual(['feito', 'atual', 'futuro', 'futuro']);
    expect(estados('delivery', 'em_entrega')).toEqual(['feito', 'feito', 'atual', 'futuro']);
    expect(estados('delivery', 'concluido')).toEqual(['feito', 'feito', 'feito', 'feito']);
  });

  it('retirada: pronto já é a terceira etapa', () => {
    expect(etapasDoPedido('retirada', 'pronto')[2]).toEqual({
      rotulo: 'Pronto para retirar',
      estado: 'atual',
    });
  });

  it('cancelado não acende nenhuma etapa', () => {
    expect(estados('delivery', 'cancelado')).toEqual(['futuro', 'futuro', 'futuro', 'futuro']);
  });
});

describe('fraseDoPedido', () => {
  it('fala com o cliente', () => {
    expect(fraseDoPedido('retirada', 'pronto')).toBe('Pronto! Pode retirar na loja');
    expect(fraseDoPedido('delivery', 'em_entrega')).toBe('Saiu para entrega');
  });
});
