import { formatarPreco, lerPreco } from '@usefood/core';
import type { AppSupabaseClient, Tables } from '@usefood/db';
import {
  Alert,
  Button,
  EmptyState,
  Panel,
  SegmentedControl,
  StatusPill,
  Switch,
  TextField,
} from '@usefood/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { Adicionais, type Grupo, type ItemAdicional } from './adicionais';
import { EditorProduto, type PracaResumo } from './editor-produto';
import { urlDaFoto } from './foto';
import { Tela, Titulo } from './tela';

type Categoria = Pick<Tables<'categories'>, 'id' | 'name' | 'position'>;
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
>;
interface NovoProduto {
  nome: string;
  precoCentavos: number;
  descricao: string;
}

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
  const [produtoNaCategoria, setProdutoNaCategoria] = useState<string | null>(null);
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
        .select('id, name, position')
        .eq('restaurant_id', loja.id)
        .order('position')
        .order('created_at'),
      supabase
        .from('products')
        .select(
          'id, category_id, name, description, price_cents, promo_price_cents, promo_ends_at, is_active, position, photo_path, station_id',
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

  async function criarCategoria(nome: string): Promise<boolean> {
    setErro('');
    const { error } = await supabase
      .from('categories')
      .insert({ restaurant_id: loja.id, name: nome, position: categorias.length });
    if (error) {
      setErro('Não foi possível salvar a categoria. Tente de novo.');
      return false;
    }
    setCriandoCategoria(false);
    recarregar();
    return true;
  }

  async function criarProduto(categoriaId: string, novo: NovoProduto): Promise<boolean> {
    setErro('');
    const { error } = await supabase.from('products').insert({
      restaurant_id: loja.id,
      category_id: categoriaId,
      name: novo.nome,
      description: novo.descricao || null,
      price_cents: novo.precoCentavos,
      position: produtos.filter((p) => p.category_id === categoriaId).length,
    });
    if (error) {
      setErro('Não foi possível salvar o produto. Tente de novo.');
      return false;
    }
    setProdutoNaCategoria(null);
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

          {categorias.map((categoria) => {
            const itens = produtos.filter((p) => p.category_id === categoria.id);
            return (
              <Panel
                key={categoria.id}
                id={`cat-${categoria.id}`}
                className="gap-2"
                title={categoria.name}
                actions={
                  <span className="text-caption text-ink-muted">
                    {itens.length === 1 ? '1 produto' : `${itens.length} produtos`}
                  </span>
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

                {podeEditar &&
                  (produtoNaCategoria === categoria.id ? (
                    <NovoProdutoForm
                      onSalvar={(novo) => criarProduto(categoria.id, novo)}
                      onCancelar={() => setProdutoNaCategoria(null)}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      className="self-start px-0 text-brand-text"
                      onClick={() => setProdutoNaCategoria(categoria.id)}
                    >
                      + Novo produto
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
          onAlterado={recarregar}
          onFechar={() => setEditando(null)}
        />
      )}
    </Tela>
  );
}

function NovaCategoria({
  onSalvar,
  onCancelar,
}: {
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
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      <TextField
        label="Nome da categoria"
        hint="Exemplos: Pastéis, Lanches, Bebidas"
        required
        maxLength={60}
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
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

function NovoProdutoForm({
  onSalvar,
  onCancelar,
}: {
  onSalvar: (novo: NovoProduto) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const precoCentavos = lerPreco(preco);
  const erroPreco =
    tentou && precoCentavos === null ? 'Digite o preço, por exemplo 14,90.' : undefined;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setTentou(true);
    if (precoCentavos === null || !nome.trim()) return;
    setSalvando(true);
    await onSalvar({ nome: nome.trim(), precoCentavos, descricao: descricao.trim() });
    setSalvando(false);
  }

  return (
    <form
      onSubmit={enviar}
      className="mt-2 flex flex-col gap-4 rounded-md border border-line bg-canvas p-4"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <TextField
          label="Nome do produto"
          required
          maxLength={80}
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <TextField
          label="Preço"
          inputMode="decimal"
          placeholder="0,00"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          error={erroPreco}
          hint={precoCentavos !== null ? formatarPreco(precoCentavos) : 'Em reais'}
        />
      </div>
      <TextField
        label="Descrição (opcional)"
        hint="O que vem no prato. Aparece para o cliente no cardápio."
        maxLength={500}
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />
      <div className="flex gap-3">
        <Button type="submit" loading={salvando} disabled={!nome.trim()}>
          Salvar produto
        </Button>
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
