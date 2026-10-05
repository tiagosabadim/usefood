import { describe, expect, it } from 'vitest';
import { etapasDoPedido, fraseDoPedido } from './acompanhamento';

const estados = (tipo: string, s: Parameters<typeof etapasDoPedido>[1]) =>
  etapasDoPedido(tipo, s).map((e) => e.estado);

describe('etapasDoPedido', () => {
  it('entrega: seis etapas, do aceite até a porta', () => {
    expect(etapasDoPedido('delivery', 'aguardando').map((e) => e.rotulo)).toEqual([
      'Aguardando o restaurante aceitar',
      'Pedido aceito',
      'Em preparação',
      'Pronto',
      'Pedido a caminho',
      'Pedido entregue',
    ]);
    expect(estados('delivery', 'aguardando')).toEqual([
      'atual',
      'futuro',
      'futuro',
      'futuro',
      'futuro',
      'futuro',
    ]);
  });

  it('aceito: "Pedido aceito" já feito e "Em preparação" é a atual', () => {
    expect(estados('delivery', 'em_preparo')).toEqual([
      'feito',
      'feito',
      'atual',
      'futuro',
      'futuro',
      'futuro',
    ]);
  });

  it('a caminho e entregue', () => {
    expect(estados('delivery', 'em_entrega')).toEqual([
      'feito',
      'feito',
      'feito',
      'feito',
      'atual',
      'futuro',
    ]);
    expect(estados('delivery', 'concluido').every((e) => e === 'feito')).toBe(true);
  });

  it('retirada: pronto para retirar e retirado', () => {
    expect(etapasDoPedido('retirada', 'pronto')[3]).toEqual({
      rotulo: 'Pronto para retirar',
      estado: 'atual',
    });
    expect(estados('retirada', 'concluido')).toHaveLength(5);
  });

  it('recusado não acende nenhuma etapa', () => {
    expect(estados('delivery', 'cancelado').every((e) => e === 'futuro')).toBe(true);
  });
});

describe('fraseDoPedido', () => {
  it('fala com o cliente', () => {
    expect(fraseDoPedido('delivery', 'aguardando')).toBe('Aguardando o restaurante aceitar');
    expect(fraseDoPedido('delivery', 'em_preparo')).toBe('Pedido aceito · em preparação');
    expect(fraseDoPedido('delivery', 'em_entrega')).toBe('Pedido a caminho');
    expect(fraseDoPedido('retirada', 'pronto')).toBe('Pronto! Pode retirar na loja');
  });
});
