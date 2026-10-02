/** Item do pedido em montagem no PDV. O preço aqui é só para mostrar: o banco recalcula. */
export interface ItemCarrinho {
  productId: string;
  nome: string;
  precoCentavos: number;
  quantidade: number;
}

export function adicionarItem(
  carrinho: readonly ItemCarrinho[],
  produto: { id: string; name: string; price_cents: number },
): ItemCarrinho[] {
  const existe = carrinho.find((i) => i.productId === produto.id);
  if (existe) {
    return carrinho.map((i) =>
      i.productId === produto.id ? { ...i, quantidade: Math.min(i.quantidade + 1, 999) } : i,
    );
  }
  return [
    ...carrinho,
    {
      productId: produto.id,
      nome: produto.name,
      precoCentavos: produto.price_cents,
      quantidade: 1,
    },
  ];
}

/** Tira uma unidade; com zero, o item sai do pedido. */
export function removerUnidade(
  carrinho: readonly ItemCarrinho[],
  productId: string,
): ItemCarrinho[] {
  return carrinho
    .map((i) => (i.productId === productId ? { ...i, quantidade: i.quantidade - 1 } : i))
    .filter((i) => i.quantidade > 0);
}

export function subtotalCentavos(carrinho: readonly ItemCarrinho[]): number {
  return carrinho.reduce((soma, i) => soma + i.precoCentavos * i.quantidade, 0);
}

export function quantidadeTotal(carrinho: readonly ItemCarrinho[]): number {
  return carrinho.reduce((soma, i) => soma + i.quantidade, 0);
}

/** Mesma regra do banco: 10% sobre o subtotal, arredondado ao centavo. */
export function taxaServicoCentavos(subtotal: number): number {
  return Math.round(subtotal * 0.1);
}

/** Notas que o cliente provavelmente vai entregar: arredonda para 10, 50 e 100 reais. */
export function sugestoesDeNotas(totalCentavos: number): number[] {
  const valores = [1000, 5000, 10000]
    .map((nota) => Math.ceil(totalCentavos / nota) * nota)
    .filter((v) => v > totalCentavos);
  return [...new Set(valores)].slice(0, 3);
}
