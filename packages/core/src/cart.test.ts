import { describe, expect, it } from 'vitest';
import {
  adicionarItem,
  chaveDoItem,
  detalheDoItem,
  dividirIgual,
  itemSimples,
  problemaNaEscolha,
  quantidadeDoProduto,
  quantidadeTotal,
  removerUnidade,
  somarUnidade,
  subtotalCentavos,
  sugestoesDeNotas,
  taxaServicoCentavos,
  type NovoItem,
} from './cart';

const pastel = itemSimples({ id: 'p1', name: 'Pastel de carne', price_cents: 1400 });
const caldo = itemSimples({ id: 'p2', name: 'Caldo de cana', price_cents: 900 });
const pizzaGrande: NovoItem = {
  productId: 'pz',
  nome: 'Pizza',
  precoCentavos: 4500,
  tamanhoId: 'g',
  tamanhoNome: 'Grande',
  adicionais: [],
  observacao: '',
};

describe('carrinho do PDV', () => {
  it('tocar duas vezes no mesmo item soma a quantidade', () => {
    const c = adicionarItem(adicionarItem([], pastel), pastel);
    expect(c).toHaveLength(1);
    expect(c[0]?.quantidade).toBe(2);
  });

  it('mesmo produto com opções diferentes vira outra linha', () => {
    const media = { ...pizzaGrande, tamanhoId: 'm', tamanhoNome: 'Média', precoCentavos: 3500 };
    const c = adicionarItem(adicionarItem([], pizzaGrande), media);
    expect(c).toHaveLength(2);
    expect(quantidadeDoProduto(c, 'pz')).toBe(2);
  });

  it('a ordem dos adicionais não muda a linha', () => {
    const a = { id: 'a', nome: 'Bacon', precoCentavos: 400 };
    const b = { id: 'b', nome: 'Ovo', precoCentavos: 250 };
    expect(chaveDoItem({ ...pastel, adicionais: [a, b] })).toBe(
      chaveDoItem({ ...pastel, adicionais: [b, a] }),
    );
  });

  it('soma subtotal e quantidade', () => {
    const c = adicionarItem(adicionarItem(adicionarItem([], pastel), pastel), caldo);
    expect(subtotalCentavos(c)).toBe(3700);
    expect(quantidadeTotal(c)).toBe(3);
  });

  it('mais e menos pela linha; a última unidade remove a linha', () => {
    let c = adicionarItem([], caldo);
    const chave = c[0]!.chave;
    c = somarUnidade(c, chave);
    expect(c[0]?.quantidade).toBe(2);
    c = removerUnidade(removerUnidade(c, chave), chave);
    expect(c).toEqual([]);
  });

  it('detalhe junta tamanho, adicionais e observação', () => {
    expect(
      detalheDoItem({
        tamanhoNome: 'Grande',
        adicionais: [{ id: 'a', nome: 'Catupiry', precoCentavos: 800 }],
        observacao: 'sem cebola',
      }),
    ).toBe('Grande · Catupiry · sem cebola');
  });

  it('taxa de serviço igual à do banco', () => {
    expect(taxaServicoCentavos(1400)).toBe(140);
    expect(taxaServicoCentavos(1555)).toBe(156);
  });
});

describe('sugestoesDeNotas', () => {
  it('sugere as notas mais prováveis', () => {
    expect(sugestoesDeNotas(3700)).toEqual([4000, 5000, 10000]);
    expect(sugestoesDeNotas(5000)).toEqual([10000]);
  });
});

describe('dividirIgual', () => {
  it('divide e distribui os centavos que sobram', () => {
    expect(dividirIgual(2650, 2)).toEqual([1325, 1325]);
    expect(dividirIgual(1000, 3)).toEqual([334, 333, 333]);
    expect(dividirIgual(1000, 3).reduce((a, b) => a + b)).toBe(1000);
  });
});

describe('problemaNaEscolha', () => {
  const grupos = [
    { id: 'ponto', nome: 'Ponto', minimo: 1, maximo: 1 },
    { id: 'extras', nome: 'Extras', minimo: 0, maximo: 2 },
  ];
  it('aponta grupo obrigatório sem escolha e grupo acima do máximo', () => {
    expect(problemaNaEscolha(grupos, {})).toBe('Escolha uma opção em Ponto.');
    expect(problemaNaEscolha(grupos, { ponto: 1, extras: 3 })).toBe(
      'Em Extras, escolha no máximo 2.',
    );
  });
  it('escolha dentro das regras', () => {
    expect(problemaNaEscolha(grupos, { ponto: 1, extras: 2 })).toBeNull();
  });
});
