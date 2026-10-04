/** Adicional escolhido num item do pedido. */
export interface AdicionalEscolhido {
  id: string;
  nome: string;
  precoCentavos: number;
}

/**
 * Linha do pedido em montagem no PDV. O preço aqui é só para mostrar: o banco recalcula.
 * Mesmo produto com tamanho, adicionais ou observação diferentes vira outra linha.
 */
export interface ItemCarrinho {
  chave: string;
  productId: string;
  nome: string;
  /** Preço de uma unidade já com tamanho e adicionais. */
  precoCentavos: number;
  quantidade: number;
  tamanhoId: string | null;
  tamanhoNome: string | null;
  adicionais: AdicionalEscolhido[];
  observacao: string;
  /** Sai embalado para viagem (na mesa ou no balcão, por item). */
  paraViagem: boolean;
}

export type NovoItem = Omit<ItemCarrinho, 'chave' | 'quantidade'> & { quantidade?: number };

export function chaveDoItem(
  item: Pick<ItemCarrinho, 'productId' | 'tamanhoId' | 'adicionais' | 'observacao' | 'paraViagem'>,
): string {
  const adicionais = item.adicionais
    .map((a) => a.id)
    .sort()
    .join(',');
  return [
    item.productId,
    item.tamanhoId ?? '',
    adicionais,
    item.observacao.trim().toLowerCase(),
    item.paraViagem ? 'viagem' : '',
  ].join('|');
}

/** Item simples (sem tamanho nem adicionais) a partir de um produto. */
export function itemSimples(produto: { id: string; name: string; price_cents: number }): NovoItem {
  return {
    productId: produto.id,
    nome: produto.name,
    precoCentavos: produto.price_cents,
    tamanhoId: null,
    tamanhoNome: null,
    adicionais: [],
    observacao: '',
    paraViagem: false,
  };
}

export function adicionarItem(carrinho: readonly ItemCarrinho[], novo: NovoItem): ItemCarrinho[] {
  const chave = chaveDoItem(novo);
  const quantidade = novo.quantidade ?? 1;
  const existe = carrinho.find((i) => i.chave === chave);
  if (existe) {
    return carrinho.map((i) =>
      i.chave === chave ? { ...i, quantidade: Math.min(i.quantidade + quantidade, 999) } : i,
    );
  }
  return [...carrinho, { ...novo, observacao: novo.observacao.trim(), chave, quantidade }];
}

/** Uma unidade a mais de uma linha que já está no pedido. */
export function somarUnidade(carrinho: readonly ItemCarrinho[], chave: string): ItemCarrinho[] {
  return carrinho.map((i) =>
    i.chave === chave ? { ...i, quantidade: Math.min(i.quantidade + 1, 999) } : i,
  );
}

/** Tira uma unidade; com zero, a linha sai do pedido. */
export function removerUnidade(carrinho: readonly ItemCarrinho[], chave: string): ItemCarrinho[] {
  return carrinho
    .map((i) => (i.chave === chave ? { ...i, quantidade: i.quantidade - 1 } : i))
    .filter((i) => i.quantidade > 0);
}

/** Quantas unidades de um produto há no pedido, somando todas as linhas dele. */
export function quantidadeDoProduto(carrinho: readonly ItemCarrinho[], productId: string): number {
  return carrinho.filter((i) => i.productId === productId).reduce((s, i) => s + i.quantidade, 0);
}

/** "Grande · Bacon, Ovo · sem cebola" para mostrar embaixo do nome. */
export function detalheDoItem(
  item: Pick<ItemCarrinho, 'tamanhoNome' | 'adicionais' | 'observacao'>,
): string {
  return [item.tamanhoNome, item.adicionais.map((a) => a.nome).join(', '), item.observacao]
    .filter((parte) => parte && parte.trim())
    .join(' · ');
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

/** Divide em partes iguais; os centavos que sobram vão para as primeiras partes. */
export function dividirIgual(totalCentavos: number, pessoas: number): number[] {
  const n = Math.max(1, Math.floor(pessoas));
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Grupo de adicionais como o PDV precisa para validar a escolha. */
export interface GrupoParaEscolha {
  id: string;
  nome: string;
  minimo: number;
  maximo: number | null;
}

/** Mesma regra do banco: retorna o primeiro problema na escolha, ou null se está tudo certo. */
export function problemaNaEscolha(
  grupos: readonly GrupoParaEscolha[],
  escolhidosPorGrupo: Readonly<Record<string, number>>,
): string | null {
  for (const g of grupos) {
    const n = escolhidosPorGrupo[g.id] ?? 0;
    if (n < g.minimo)
      return g.minimo === 1
        ? `Escolha uma opção em ${g.nome}.`
        : `Em ${g.nome}, escolha pelo menos ${g.minimo}.`;
    if (g.maximo !== null && n > g.maximo) return `Em ${g.nome}, escolha no máximo ${g.maximo}.`;
  }
  return null;
}

/** Junta linhas que ficaram iguais (mesma chave) depois de mudar alguma marca. */
function fundir(linhas: readonly ItemCarrinho[]): ItemCarrinho[] {
  const resultado: ItemCarrinho[] = [];
  for (const l of linhas) {
    const chave = chaveDoItem(l);
    const igual = resultado.find((r) => r.chave === chave);
    if (igual) igual.quantidade = Math.min(igual.quantidade + l.quantidade, 999);
    else resultado.push({ ...l, chave });
  }
  return resultado;
}

/** Marca ou desmarca uma linha como para viagem. */
export function marcarParaViagem(
  carrinho: readonly ItemCarrinho[],
  chave: string,
  paraViagem: boolean,
): ItemCarrinho[] {
  return fundir(carrinho.map((i) => (i.chave === chave ? { ...i, paraViagem } : i)));
}

/** "Comer aqui" ou "Para viagem" para o pedido todo. */
export function marcarTudoParaViagem(
  carrinho: readonly ItemCarrinho[],
  paraViagem: boolean,
): ItemCarrinho[] {
  return fundir(carrinho.map((i) => ({ ...i, paraViagem })));
}

/** Situação do pedido: tudo para comer, tudo para viagem ou misturado. */
export function situacaoDeViagem(
  carrinho: readonly ItemCarrinho[],
): 'comer' | 'viagem' | 'misto' | null {
  if (carrinho.length === 0) return null;
  const viagem = carrinho.filter((i) => i.paraViagem).length;
  if (viagem === 0) return 'comer';
  return viagem === carrinho.length ? 'viagem' : 'misto';
}
