import { describe, expect, it } from 'vitest';
import {
  adicionarItem,
  quantidadeTotal,
  removerUnidade,
  subtotalCentavos,
  sugestoesDeNotas,
  taxaServicoCentavos,
} from './cart';

const pastel = { id: 'p1', name: 'Pastel de carne', price_cents: 1400 };
const caldo = { id: 'p2', name: 'Caldo de cana', price_cents: 900 };

describe('carrinho do PDV', () => {
  it('tocar duas vezes no mesmo produto soma a quantidade', () => {
    const c = adicionarItem(adicionarItem([], pastel), pastel);
    expect(c).toHaveLength(1);
    expect(c[0]?.quantidade).toBe(2);
  });

  it('soma subtotal e quantidade', () => {
    const c = adicionarItem(adicionarItem(adicionarItem([], pastel), pastel), caldo);
    expect(subtotalCentavos(c)).toBe(3700);
    expect(quantidadeTotal(c)).toBe(3);
  });

  it('tirar a última unidade remove o item', () => {
    const c = removerUnidade(adicionarItem([], caldo), 'p2');
    expect(c).toEqual([]);
  });

  it('taxa de serviço igual à do banco', () => {
    expect(taxaServicoCentavos(1400)).toBe(140);
    expect(taxaServicoCentavos(1555)).toBe(156);
  });
});

describe('sugestoesDeNotas', () => {
  it('sugere as notas mais prováveis', () => {
    expect(sugestoesDeNotas(3700)).toEqual([4000, 5000, 10000]);
    expect(sugestoesDeNotas(1540)).toEqual([2000, 5000, 10000]);
  });

  it('valor redondo não sugere o próprio valor', () => {
    expect(sugestoesDeNotas(5000)).toEqual([10000]);
  });
});
