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
  const [editandoCategoria, setEditandoCategoria] = useState<string | null>(null);
  const [excluindoCategoria, setExcluindoCategoria] = useState<string | null>(null);

  async function salvarCategoria(
    id: string,
    dados: { nome: string; cozinha: string | null; mae: string | null },
  ): Promise<boolean> {
    setErro('');
    const { error } = await supabase
      .from('categories')
      .update({
        name: dados.nome,
        cuisine: (dados.cozinha || null) as Enums<'cuisine_type'> | null,
        parent_id: dados.mae || null,
      })
      .eq('id', id);
    if (error) {
      setErro(
        error.code === '22023'
          ? error.message
          : 'Não foi possível salvar a categoria. Tente de novo.',
      );
      return false;
    }
    setEditandoCategoria(null);
    recarregar();
    return true;
  }

  async function excluirCategoria(id: string): Promise<boolean> {
    setErro('');
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      setErro(
        error.code === '23503'
          ? 'Esta categoria ainda tem produtos. Mova os produtos para outra categoria (no editor do produto) ou exclua-os antes.'
          : 'Não foi possível excluir a categoria. Tente de novo.',
      );
      return false;
    }
    setExcluindoCategoria(null);
    recarregar();
    return true;
  }

  // Ordem: troca de lugar com a vizinha (entre as principais ou entre as subcategorias da mesma)
  async function mover(categoria: Categoria, direcao: -1 | 1) {
    const irmas = categorias
      .filter((x) => (x.parent_id ?? null) === (categoria.parent_id ?? null))
      .sort((a, b) => a.position - b.position);
    const i = irmas.findIndex((x) => x.id === categoria.id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= irmas.length) return;
    const nova = [...irmas];
    [nova[i], nova[j]] = [nova[j]!, nova[i]!];
    setErro('');
    const resultados = await Promise.all(
      nova.map((x, posicao) =>
        supabase.from('categories').update({ position: posicao }).eq('id', x.id),
      ),
    );
    if (resultados.some((r) => r.error)) setErro('Não foi possível mudar a ordem. Tente de novo.');
    recarregar();
  }

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
                    {podeEditar && (
                      <span className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          className="h-9 px-2"
                          aria-label={`Subir ${categoria.name}`}
                          onClick={() => void mover(categoria, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-9 px-2"
                          aria-label={`Descer ${categoria.name}`}
                          onClick={() => void mover(categoria, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-9 px-3 text-brand-text"
                          onClick={() => {
                            setExcluindoCategoria(null);
                            setEditandoCategoria(
                              editandoCategoria === categoria.id ? null : categoria.id,
                            );
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-9 px-3 text-danger"
                          onClick={() => {
                            setEditandoCategoria(null);
                            setExcluindoCategoria(
                              excluindoCategoria === categoria.id ? null : categoria.id,
                            );
                          }}
                        >
                          Excluir
                        </Button>
                      </span>
                    )}
                  </div>
                }
              >
                {editandoCategoria === categoria.id && (
                  <EditarCategoria
                    categoria={categoria}
                    principais={categorias.filter((x) => !x.parent_id && x.id !== categoria.id)}
                    temSubcategorias={categorias.some((x) => x.parent_id === categoria.id)}
                    onSalvar={(dados) => salvarCategoria(categoria.id, dados)}
                    onCancelar={() => setEditandoCategoria(null)}
                  />
                )}
                {excluindoCategoria === categoria.id && (
                  <ExcluirCategoria
                    nome={categoria.name}
                    produtos={
                      itens.length +
                      produtos.filter((p) =>
                        categorias.some(
                          (x) => x.parent_id === categoria.id && x.id === p.category_id,
                        ),
                      ).length
                    }
                    subcategorias={categorias.filter((x) => x.parent_id === categoria.id).length}
                    onExcluir={() => excluirCategoria(categoria.id)}
                    onCancelar={() => setExcluindoCategoria(null)}
                  />
                )}
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

/** Editar categoria: nome, categoria no app e "dentro de" (subcategoria de outra ou principal). */
function EditarCategoria({
  categoria,
  principais,
  temSubcategorias,
  onSalvar,
  onCancelar,
}: {
  categoria: Categoria;
  principais: Categoria[];
  temSubcategorias: boolean;
  onSalvar: (dados: {
    nome: string;
    cozinha: string | null;
    mae: string | null;
  }) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(categoria.name);
  const [cozinha, setCozinha] = useState(categoria.cuisine ?? '');
  const [mae, setMae] = useState(categoria.parent_id ?? '');
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    await onSalvar({ nome: nome.trim(), cozinha: cozinha || null, mae: mae || null });
    setSalvando(false);
  }
  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-lg border border-line bg-canvas p-4"
    >
      <TextField
        label="Nome da categoria"
        required
        maxLength={60}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Categoria no app"
          options={[
            { value: '', label: mae ? 'Igual à categoria de cima' : 'Nenhuma' },
            ...COZINHAS.map((z) => ({ value: z.valor, label: z.rotulo })),
          ]}
          value={cozinha}
          onChange={setCozinha}
        />
        <SelectField
          label="Dentro de"
          hint={
            temSubcategorias
              ? 'Esta categoria tem subcategorias, por isso fica como principal.'
              : undefined
          }
          disabled={temSubcategorias}
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
          Salvar
        </Button>
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Excluir categoria: só sem produtos; as subcategorias vazias saem junto. */
function ExcluirCategoria({
  nome,
  produtos,
  subcategorias,
  onExcluir,
  onCancelar,
}: {
  nome: string;
  produtos: number;
  subcategorias: number;
  onExcluir: () => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [excluindo, setExcluindo] = useState(false);
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-danger bg-danger-soft p-4"
    >
      {produtos > 0 ? (
        <p className="text-body text-danger">
          "{nome}" tem {produtos === 1 ? '1 produto' : `${produtos} produtos`}
          {subcategorias > 0 ? ' (contando as subcategorias)' : ''}. Mova os produtos para outra
          categoria, pelo campo Categoria no editor do produto, ou exclua-os antes.
        </p>
      ) : (
        <p className="text-body text-danger">
          Excluir a categoria "{nome}"?
          {subcategorias > 0
            ? ` As ${subcategorias === 1 ? 'subcategoria vazia sai' : `${subcategorias} subcategorias vazias saem`} junto.`
            : ''}
        </p>
      )}
      <div className="flex gap-3">
        {produtos === 0 && (
          <Button
            variant="danger"
            loading={excluindo}
            onClick={async () => {
              setExcluindo(true);
              await onExcluir();
              setExcluindo(false);
            }}
          >
            Sim, excluir
          </Button>
        )}
        <Button variant="ghost" onClick={onCancelar}>
          {produtos > 0 ? 'Entendi' : 'Cancelar'}
        </Button>
      </div>
    </div>
  );
}
