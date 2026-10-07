import { COZINHAS, formatarPreco } from '@usefood/core';
import { precoVigente } from '@usefood/pedidos';
import type { AppSupabaseClient, Tables, Enums } from '@usefood/db';
import {
  Alert,
  Button,
  cn,
  EmptyState,
  Panel,
  SegmentedControl,
  SelectField,
  StatusPill,
  Switch,
  TextField,
} from '@usefood/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { Adicionais, type Grupo, type ItemAdicional } from './adicionais';
import { EditorProduto, type PracaResumo } from './editor-produto';
import { urlDaFoto } from './foto';
import { Tela, Titulo } from './tela';

type Categoria = Pick<Tables<'categories'>, 'id' | 'name' | 'position' | 'cuisine' | 'parent_id'>;
type Produto = Pick<
  Tables<'products'>,
  | 'id'
  | 'category_id'
  | 'name'
  | 'description'
  | 'price_cents'
  | 'promo_price_cents'
  | 'promo_ends_at'
  | 'is_active'
  | 'position'
  | 'photo_path'
  | 'station_id'
  | 'is_featured'
  | 'is_combo'
>;

/** Categorias e produtos da loja. Dono e gerente editam; o resto da equipe só consulta. */
export function Cardapio({
  supabase,
  loja,
  podeEditar,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  podeEditar: boolean;
  onVoltar: () => void;
}) {
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'pronto'>('carregando');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [versao, setVersao] = useState(0);
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<'produtos' | 'adicionais'>('produtos');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [itensAdicionais, setItensAdicionais] = useState<ItemAdicional[]>([]);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [pracas, setPracas] = useState<PracaResumo[]>([]);

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      supabase
        .from('categories')
        .select('id, name, position, cuisine, parent_id')
        .eq('restaurant_id', loja.id)
        .order('position')
        .order('created_at'),
      supabase
        .from('products')
        .select(
          'id, category_id, name, description, price_cents, promo_price_cents, promo_ends_at, is_featured, is_combo, is_active, position, photo_path, station_id',
        )
        .eq('restaurant_id', loja.id)
        .order('position')
        .order('created_at'),
      supabase
        .from('stations')
        .select('id, name')
        .eq('restaurant_id', loja.id)
        .order('position')
        .order('created_at'),
      supabase
        .from('modifier_groups')
        .select('id, name, min_select, max_select')
        .eq('restaurant_id', loja.id)
        .order('position')
        .order('created_at'),
      supabase
        .from('modifiers')
        .select('id, group_id, name, price_cents')
        .eq('restaurant_id', loja.id)
        .order('position')
        .order('created_at'),
    ]).then(([cats, prods, prcs, grps, mods]) => {
      if (!ativo) return;
      if (cats.error || prods.error || prcs.error || grps.error || mods.error) {
        setEstado('erro');
        return;
      }
      setCategorias(cats.data);
      setProdutos(prods.data);
      setPracas(prcs.data);
      setGrupos(grps.data);
      setItensAdicionais(mods.data);
      setEstado('pronto');
    });
    return () => {
      ativo = false;
    };
  }, [supabase, loja.id, versao]);

  const recarregar = () => setVersao((v) => v + 1);
  const [subcategoriaEm, setSubcategoriaEm] = useState<string | null>(null);

  // Principais na ordem, cada uma seguida das subcategorias
  const ordenadas = categorias
    .filter((c) => !c.parent_id)
    .flatMap((c) => [c, ...categorias.filter((f) => f.parent_id === c.id)]);

  async function mudarCozinha(categoriaId: string, cozinha: string) {
    setErro('');
    const { error } = await supabase
      .from('categories')
      .update({ cuisine: (cozinha || null) as Enums<'cuisine_type'> | null })
      .eq('id', categoriaId);
    if (error) return setErro('Não foi possível mudar a categoria no app. Tente de novo.');
    recarregar();
  }

  async function criarCategoria(
    nome: string,
    cozinha: string | null,
    mae: string | null,
  ): Promise<boolean> {
    setErro('');
    const { error } = await supabase.from('categories').insert({
      restaurant_id: loja.id,
      name: nome,
      position: categorias.length,
      cuisine: (cozinha || null) as Enums<'cuisine_type'> | null,
      parent_id: mae || null,
    });
    if (error) {
      setErro('Não foi possível salvar a categoria. Tente de novo.');
      return false;
    }
    setCriandoCategoria(false);
    recarregar();
    return true;
  }

  async function alternarDisponivel(produto: Produto, disponivel: boolean) {
    setErro('');
    // Muda na tela na hora; se o banco recusar, volta como estava.
    setProdutos((lista) =>
      lista.map((p) => (p.id === produto.id ? { ...p, is_active: disponivel } : p)),
    );
    const { error } = await supabase
      .from('products')
      .update({ is_active: disponivel })
      .eq('id', produto.id);
    if (error) {
      setProdutos((lista) =>
        lista.map((p) => (p.id === produto.id ? { ...p, is_active: produto.is_active } : p)),
      );
      setErro(`Não foi possível ${disponivel ? 'ativar' : 'pausar'} ${produto.name}.`);
    }
  }

  return (
    <Tela larga>
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="self-start px-0 lg:hidden" onClick={onVoltar}>
          ← {loja.name}
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Titulo
            titulo="Cardápio"
            texto={
              podeEditar
                ? 'Organize em categorias e pause um produto quando ele acabar.'
                : 'Só o dono e o gerente podem alterar o cardápio.'
            }
          />
          {podeEditar &&
            estado === 'pronto' &&
            aba === 'produtos' &&
            categorias.length > 0 &&
            !criandoCategoria && (
              <Button variant="secondary" onClick={() => setCriandoCategoria(true)}>
                Nova categoria
              </Button>
            )}
        </div>
      </div>

      <SegmentedControl
        label="Parte do cardápio"
        className="self-start"
        options={[
          { value: 'produtos', label: 'Produtos' },
          { value: 'adicionais', label: 'Adicionais' },
        ]}
        value={aba}
        onChange={setAba}
      />

      <Alert>{erro}</Alert>

      {estado === 'pronto' && aba === 'adicionais' && (
        <Adicionais
          supabase={supabase}
          lojaId={loja.id}
          grupos={grupos}
          itens={itensAdicionais}
          podeEditar={podeEditar}
          onAlterado={recarregar}
        />
      )}

      {estado === 'carregando' && (
        <p className="text-body text-ink-muted">Carregando o cardápio…</p>
      )}

      {estado === 'erro' && (
        <div className="flex flex-col gap-4">
          <Alert>Não conseguimos carregar o cardápio. Confira a internet e tente de novo.</Alert>
          <Button className="self-start" onClick={recarregar}>
            Tentar de novo
          </Button>
        </div>
      )}

      {estado === 'pronto' && aba === 'produtos' && (
        <div className="flex flex-col gap-6">
          {criandoCategoria && (
            <NovaCategoria
              principais={categorias.filter((c) => !c.parent_id)}
              onSalvar={criarCategoria}
              onCancelar={() => setCriandoCategoria(false)}
            />
          )}

          {categorias.length === 0 && !criandoCategoria && (
            <EmptyState
              title="Comece pelas categorias"
              description="Categorias organizam o cardápio, como Pastéis, Bebidas e Sobremesas. Depois é só colocar os produtos dentro de cada uma."
              action={
                podeEditar && (
                  <Button onClick={() => setCriandoCategoria(true)}>
                    Criar a primeira categoria
                  </Button>
                )
              }
            />
          )}

          {ordenadas.map((categoria) => {
            const itens = produtos.filter((p) => p.category_id === categoria.id);
            const mae = categoria.parent_id
              ? categorias.find((c) => c.id === categoria.parent_id)
              : undefined;
            return (
              <Panel
                key={categoria.id}
                id={`cat-${categoria.id}`}
                className={cn('gap-2', mae && 'ml-4 border-l-4 border-l-brand-soft sm:ml-10')}
                title={mae ? `${mae.name} › ${categoria.name}` : categoria.name}
                actions={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <SelectField
                      label={`Categoria no app de ${categoria.name}`}
                      className="w-44 [&>label]:sr-only"
                      options={[
                        { value: '', label: mae ? 'No app: igual à mãe' : 'No app: nenhuma' },
                        ...COZINHAS.map((z) => ({ value: z.valor, label: `No app: ${z.rotulo}` })),
                      ]}
                      value={categoria.cuisine ?? ''}
                      onChange={(v) => void mudarCozinha(categoria.id, v)}
                    />
                    <span className="text-caption text-ink-muted">
                      {itens.length === 1 ? '1 produto' : `${itens.length} produtos`}
                    </span>
                  </div>
                }
              >
                {itens.length > 0 && (
                  <ul className="flex flex-col divide-y divide-line">
                    {itens.map((produto) => (
                      <li key={produto.id} className="flex items-center gap-4 py-3">
                        <div className="flex aspect-[4/3] w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-strong">
                          {produto.photo_path && (
                            <img
                              src={urlDaFoto(supabase, produto.photo_path) ?? undefined}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {podeEditar ? (
                            <button
                              type="button"
                              onClick={() => setEditando(produto)}
                              className="text-left text-body-strong text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            >
                              {produto.name}
                            </button>
                          ) : (
                            <p className="text-body-strong text-ink">{produto.name}</p>
                          )}
                          <EtiquetasDoProduto produto={produto} />
                          {produto.description && (
                            <p className="truncate text-caption text-ink-muted">
                              {produto.description}
                            </p>
                          )}
                        </div>
                        <span className="text-body-strong text-ink tabular-nums">
                          {formatarPreco(produto.price_cents)}
                        </span>
                        {podeEditar ? (
                          <Switch
                            checked={produto.is_active}
                            onChange={(v) => void alternarDisponivel(produto, v)}
                            label={`${produto.name}: disponível`}
                          />
                        ) : (
                          !produto.is_active && <StatusPill>Pausado</StatusPill>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {podeEditar && (
                  <Button
                    variant="ghost"
                    className="self-start px-0 text-brand-text"
                    onClick={() =>
                      setEditando({
                        id: '',
                        category_id: categoria.id,
                        name: '',
                        description: null,
                        price_cents: 0,
                        photo_path: null,
                        station_id: pracas[0]?.id ?? null,
                        promo_price_cents: null,
                        promo_ends_at: null,
                        is_featured: false,
                        is_combo: false,
                        is_active: true,
                        position: itens.length,
                      })
                    }
                  >
                    + Novo produto
                  </Button>
                )}
                {podeEditar &&
                  !mae &&
                  (subcategoriaEm === categoria.id ? (
                    <NovaSubcategoria
                      mae={categoria.name}
                      onSalvar={async (nome) => {
                        const ok = await criarCategoria(nome, null, categoria.id);
                        if (ok) setSubcategoriaEm(null);
                        return ok;
                      }}
                      onCancelar={() => setSubcategoriaEm(null)}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      className="self-start px-0 text-ink-muted"
                      onClick={() => setSubcategoriaEm(categoria.id)}
                    >
                      + Subcategoria (ex.: sabores)
                    </Button>
                  ))}
              </Panel>
            );
          })}
        </div>
      )}
      {editando && (
        <EditorProduto
          supabase={supabase}
          lojaId={loja.id}
          produto={editando}
          grupos={grupos}
          pracas={pracas}
          produtosDaLoja={produtos
            .filter((p) => !p.is_combo)
            .map((p) => ({ id: p.id, nome: p.name }))}
          categorias={ordenadas.map((c) => {
            const mae = c.parent_id ? categorias.find((m) => m.id === c.parent_id) : undefined;
            return { id: c.id, nome: mae ? `${mae.name} › ${c.name}` : c.name };
          })}
          onAlterado={recarregar}
          onFechar={() => setEditando(null)}
        />
      )}
    </Tela>
  );
}

function NovaCategoria({
  principais,
  onSalvar,
  onCancelar,
}: {
  principais: Categoria[];
  onSalvar: (nome: string, cozinha: string | null, mae: string | null) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [cozinha, setCozinha] = useState('');
  const [mae, setMae] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    await onSalvar(nome.trim(), cozinha || null, mae || null);
    setSalvando(false);
  }

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      <TextField
        label="Nome da categoria"
        hint="Exemplos: Hambúrgueres, Pizzas doces, Bebidas"
        required
        maxLength={60}
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Categoria no app"
          hint="Onde os produtos dela aparecem no app de delivery."
          options={[
            { value: '', label: mae ? 'Igual à categoria de cima' : 'Nenhuma' },
            ...COZINHAS.map((z) => ({ value: z.valor, label: z.rotulo })),
          ]}
          value={cozinha}
          onChange={setCozinha}
        />
        <SelectField
          label="Dentro de (opcional)"
          hint="Para criar uma subcategoria, como Lanches › Artesanais."
          options={[
            { value: '', label: 'Nenhuma (categoria principal)' },
            ...principais.map((p) => ({ value: p.id, label: p.name })),
          ]}
          value={mae}
          onChange={setMae}
        />
      </div>
      <div className="flex gap-3">
        <Button type="submit" loading={salvando} disabled={!nome.trim()}>
          Salvar categoria
        </Button>
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Etiquetas do produto no cardápio: desconto da promoção valendo, destaque e pausado. */
function EtiquetasDoProduto({ produto }: { produto: Produto }) {
  const vigente = precoVigente(
    produto.price_cents,
    produto.promo_price_cents,
    produto.promo_ends_at,
  );
  const desconto =
    vigente < produto.price_cents
      ? Math.round(((produto.price_cents - vigente) / produto.price_cents) * 100)
      : 0;
  if (!desconto && !produto.is_featured && !produto.is_combo && produto.is_active) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {desconto > 0 && (
        <span className="rounded-pill bg-brand px-2 py-0.5 text-micro font-bold text-brand-ink">
          -{desconto}% · {formatarPreco(vigente)}
        </span>
      )}
      {produto.is_combo && (
        <span className="rounded-pill bg-ink px-2 py-0.5 text-micro font-bold text-canvas">
          Combo
        </span>
      )}
      {produto.is_featured && (
        <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-micro font-bold text-brand-text">
          Destaque
        </span>
      )}
      {!produto.is_active && (
        <span className="rounded-pill bg-surface-strong px-2 py-0.5 text-micro font-bold text-ink-muted">
          Pausado
        </span>
      )}
    </span>
  );
}

/** Subcategoria dentro de uma categoria (ex.: Pastel › Frango): só o nome; a categoria do app vem da de cima. */
function NovaSubcategoria({
  mae,
  onSalvar,
  onCancelar,
}: {
  mae: string;
  onSalvar: (nome: string) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    await onSalvar(nome.trim());
    setSalvando(false);
  }
  return (
    <form
      onSubmit={enviar}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-canvas p-4"
    >
      <TextField
        label={`Subcategoria de ${mae}`}
        hint="Exemplos: Frango, Carne, Queijo"
        required
        maxLength={60}
        autoFocus
        className="min-w-48 flex-1"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Button type="submit" loading={salvando} disabled={!nome.trim()}>
        Criar
      </Button>
      <Button variant="ghost" onClick={onCancelar}>
        Cancelar
      </Button>
    </form>
  );
}
