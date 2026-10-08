import type { AppSupabaseClient, Tables } from '@usefood/db';

export type CategoriaDoCardapio = Pick<
  Tables<'categories'>,
  'id' | 'name' | 'parent_id' | 'cuisine'
>;

/** Seção do cardápio: a categoria principal, com os produtos dela e depois um grupo por subcategoria. */
export interface SecaoDoCardapio {
  categoria: CategoriaDoCardapio;
  grupos: { sub: CategoriaDoCardapio | null; produtos: ProdutoDoCardapio[] }[];
}

/**
 * Agrupa o cardápio para mostrar: só as categorias principais (as que têm produto nelas ou nas
 * subcategorias); dentro de cada uma, os produtos diretos e depois um grupo por subcategoria
 * (ex.: Pastel → Frango, Carne, Queijo). Mantém a ordem das categorias e dos produtos.
 */
export function agruparPorSecao(
  categorias: CategoriaDoCardapio[],
  produtos: ProdutoDoCardapio[],
): SecaoDoCardapio[] {
  const daCategoria = (id: string) => produtos.filter((p) => p.category_id === id);
  return categorias
    .filter((c) => !c.parent_id)
    .map((c) => ({
      categoria: c,
      grupos: [
        { sub: null, produtos: daCategoria(c.id) },
        ...categorias
          .filter((f) => f.parent_id === c.id)
          .map((f) => ({ sub: f, produtos: daCategoria(f.id) })),
      ].filter((g) => g.produtos.length > 0),
    }))
    .filter((s) => s.grupos.length > 0);
}

/** Produtos de uma seção na ordem de mostrar (os diretos e depois os de cada subcategoria). */
export const produtosDaSecao = (s: SecaoDoCardapio) => s.grupos.flatMap((g) => g.produtos);
export type ProdutoDoCardapio = Pick<
  Tables<'products'>,
  | 'id'
  | 'category_id'
  | 'name'
  | 'description'
  | 'price_cents'
  | 'photo_path'
  | 'is_featured'
  | 'is_combo'
> & {
  /** Combo: o que vem nele ("1× X-Burguer, 2× Batata"); null quando não é combo. */
  combo_texto: string | null;
  /** Preço sem a promoção, quando há promoção valendo (para mostrar riscado). price_cents já é o da promoção. */
  preco_original_cents: number | null;
};

/** Preço que vale agora: o da promoção, se existir, for menor e não tiver vencido (mesma regra do servidor). */
export function precoVigente(
  preco: number,
  promo: number | null,
  ate: string | null,
  agora = Date.now(),
): number {
  return promo != null && promo < preco && (!ate || new Date(ate).getTime() > agora)
    ? promo
    : preco;
}

export interface OpcaoTamanho {
  id: string;
  nome: string;
  precoCentavos: number;
}
export interface OpcaoAdicional {
  id: string;
  nome: string;
  precoCentavos: number;
}
export interface GrupoDeOpcoes {
  id: string;
  nome: string;
  minimo: number;
  maximo: number | null;
  itens: OpcaoAdicional[];
}
export interface OpcoesDoProduto {
  tamanhos: OpcaoTamanho[];
  grupos: GrupoDeOpcoes[];
}
export interface Cardapio {
  categorias: CategoriaDoCardapio[];
  produtos: ProdutoDoCardapio[];
  /** Tamanhos e adicionais por produto; produto sem opções não aparece no mapa. */
  opcoes: Map<string, OpcoesDoProduto>;
}

export const SEM_OPCOES: OpcoesDoProduto = { tamanhos: [], grupos: [] };

/** Produto com tamanho ou adicionais abre o "Montar item"; sem opções, entra direto no pedido. */
export function temOpcoes(cardapio: Cardapio, produtoId: string): boolean {
  const o = cardapio.opcoes.get(produtoId);
  return Boolean(o && (o.tamanhos.length > 0 || o.grupos.length > 0));
}

/** Cardápio ativo da loja para vender: categorias, produtos, tamanhos e adicionais. */
export async function carregarCardapio(
  supabase: AppSupabaseClient,
  lojaId: string,
): Promise<Cardapio> {
  const [cats, prods, tamanhos, ligacoes, grupos, itens, combos] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, parent_id, cuisine')
      .eq('restaurant_id', lojaId)
      .eq('is_active', true)
      .order('position')
      .order('created_at'),
    supabase
      .from('products')
      .select(
        'id, category_id, name, description, price_cents, promo_price_cents, promo_ends_at, photo_path, is_featured, is_combo',
      )
      .eq('restaurant_id', lojaId)
      .eq('is_active', true)
      .order('position')
      .order('created_at'),
    supabase
      .from('product_variants')
      .select('id, product_id, name, price_cents')
      .eq('restaurant_id', lojaId)
      .eq('is_active', true)
      .order('position'),
    supabase
      .from('product_modifier_groups')
      .select('product_id, group_id, position')
      .eq('restaurant_id', lojaId)
      .order('position'),
    supabase
      .from('modifier_groups')
      .select('id, name, min_select, max_select')
      .eq('restaurant_id', lojaId),
    supabase
      .from('modifiers')
      .select('id, group_id, name, price_cents')
      .eq('restaurant_id', lojaId)
      .eq('is_active', true)
      .order('position'),
    supabase
      .from('product_combo_items')
      .select('combo_id, item_id, quantity')
      .eq('restaurant_id', lojaId)
      .order('position'),
  ]);
  const erro =
    cats.error ??
    prods.error ??
    tamanhos.error ??
    ligacoes.error ??
    grupos.error ??
    itens.error ??
    combos.error;
  if (erro) throw new Error(erro.message);

  const porGrupo = new Map<string, GrupoDeOpcoes>(
    grupos.data!.map((g) => [
      g.id,
      { id: g.id, nome: g.name, minimo: g.min_select, maximo: g.max_select, itens: [] },
    ]),
  );
  for (const i of itens.data!)
    porGrupo.get(i.group_id)?.itens.push({ id: i.id, nome: i.name, precoCentavos: i.price_cents });

  const opcoes = new Map<string, OpcoesDoProduto>();
  const doProduto = (id: string) => {
    if (!opcoes.has(id)) opcoes.set(id, { tamanhos: [], grupos: [] });
    return opcoes.get(id)!;
  };
  for (const t of tamanhos.data!)
    doProduto(t.product_id).tamanhos.push({ id: t.id, nome: t.name, precoCentavos: t.price_cents });
  for (const l of ligacoes.data!) {
    const grupo = porGrupo.get(l.group_id);
    // Grupo sem itens só entra se for obrigatório (o banco recusa o pedido e avisa)
    if (grupo && (grupo.itens.length > 0 || grupo.minimo > 0))
      doProduto(l.product_id).grupos.push(grupo);
  }
  const produtos: ProdutoDoCardapio[] = prods.data!.map(
    ({ promo_price_cents, promo_ends_at, ...p }) => {
      const vigente = precoVigente(p.price_cents, promo_price_cents, promo_ends_at);
      const doCombo = p.is_combo ? combos.data!.filter((x) => x.combo_id === p.id) : [];
      const texto = doCombo
        .map((x) => {
          const item = prods.data!.find((q) => q.id === x.item_id);
          return item ? `${x.quantity}× ${item.name}` : null;
        })
        .filter(Boolean)
        .join(', ');
      return {
        ...p,
        price_cents: vigente,
        preco_original_cents: vigente < p.price_cents ? p.price_cents : null,
        combo_texto: texto || null,
      };
    },
  );
  return { categorias: cats.data!, produtos, opcoes };
}
