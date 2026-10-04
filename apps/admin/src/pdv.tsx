import {
  adicionarItem,
  detalheDoItem,
  formatarPreco,
  itemSimples,
  lerPreco,
  quantidadeDoProduto,
  quantidadeTotal,
  removerUnidade,
  identificacaoPara,
  rotuloDaConta,
  rotuloDoTipo,
  somarUnidade,
  subtotalCentavos,
  type Atendimento,
  type ItemCarrinho,
  type NovoItem,
} from '@usefood/core';
import type { AppSupabaseClient, Enums, Tables } from '@usefood/db';
import {
  Alert,
  Button,
  ChoiceGrid,
  cn,
  Icon,
  ProductTile,
  QuantityStepper,
  SegmentedControl,
  TextField,
  type Option,
} from '@usefood/ui';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Cobranca, ContaPaga, METODOS, type Conta, type PagamentoFeito } from './cobranca';
import { ContasAbertas } from './contas-abertas';
import { urlDaFoto } from './foto';
import { MontarItem, type GrupoDeOpcoes, type OpcaoTamanho } from './montar-item';
import { Salao } from './salao';

type Categoria = Pick<Tables<'categories'>, 'id' | 'name'>;
type Produto = Pick<
  Tables<'products'>,
  'id' | 'category_id' | 'name' | 'price_cents' | 'photo_path'
>;
type TipoPedido = Enums<'order_type'>;
type Metodo = Enums<'payment_method'>;
interface Opcoes {
  tamanhos: OpcaoTamanho[];
  grupos: GrupoDeOpcoes[];
}
type Painel =
  | { tela: 'pedido' }
  | { tela: 'contas'; abrir?: string }
  | { tela: 'cobrando'; conta: Conta; pedidoId: string | null }
  | { tela: 'paga'; conta: Conta; pagamentos: PagamentoFeito[]; pedidoId: string | null };

const TIPOS: Option<TipoPedido>[] = (['balcao', 'mesa', 'retirada', 'delivery'] as const).map(
  (t) => ({
    value: t,
    label: rotuloDoTipo(t),
  }),
);
const ATENDIMENTO_PADRAO: Atendimento = { chamarPor: 'senha', balcao: 'cliente_busca' };
const ERROS_CONHECIDOS = new Set(['P0001', 'P0002', '22023', '42501']);
const SEM_OPCOES: Opcoes = { tamanhos: [], grupos: [] };
const CAMPOS_DA_CONTA =
  'id, type, identifier_type, identifier, subtotal_cents, service_fee_cents, total_cents, paid_cents, expected_method, change_for_cents';

function mensagem(erro: { code?: string; message?: string }): string {
  return erro.code && ERROS_CONHECIDOS.has(erro.code) && erro.message
    ? erro.message
    : 'Não deu certo agora. Confira a internet e tente de novo.';
}

/**
 * PDV: monta o pedido e decide o que fazer com ele.
 *   Enviar para a cozinha: lança e deixa a conta aberta (mesa, delivery, retirada, balcão "paga depois").
 *   Cobrar agora: lança e já cobra a conta (balcão de fast food).
 * A aba Contas abertas fecha mesas e recebe pedidos entregues.
 */
export function Pdv({
  supabase,
  loja,
  onVoltar,
  cabecalhoDoCaixa,
  avisos,
  modoInicial = 'cardapio',
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
  /** Situação do caixa e o botão que abre o painel do caixa. */
  cabecalhoDoCaixa?: ReactNode;
  /** Avisos de impressão, no topo da área de produtos. */
  avisos?: ReactNode;
  /** Abrir mostrando o cardápio ou o mapa do salão. */
  modoInicial?: 'cardapio' | 'salao';
}) {
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [opcoes, setOpcoes] = useState<Map<string, Opcoes>>(new Map());
  const [categoriaAtual, setCategoriaAtual] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [montando, setMontando] = useState<Produto | null>(null);

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [tipo, setTipo] = useState<TipoPedido>('balcao');
  const [atendimento, setAtendimento] = useState<Atendimento>(ATENDIMENTO_PADRAO);
  const [modo, setModo] = useState<'cardapio' | 'salao'>(modoInicial);
  const [identificador, setIdentificador] = useState('');
  const [previsto, setPrevisto] = useState<Metodo | null>(null);
  const [trocoPara, setTrocoPara] = useState('');

  const [painel, setPainel] = useState<Painel>({ tela: 'pedido' });
  const [contasAbertas, setContasAbertas] = useState(0);
  const [enviando, setEnviando] = useState<'cozinha' | 'cobrar' | null>(null);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState('');

  useEffect(() => {
    void supabase
      .from('restaurants')
      .select('call_by, counter_dine_in')
      .eq('id', loja.id)
      .single()
      .then(({ data }) => {
        if (data) setAtendimento({ chamarPor: data.call_by, balcao: data.counter_dine_in });
      });
  }, [supabase, loja.id]);

  useEffect(() => {
    let ativo = true;
    const loja_ = loja.id;
    void Promise.all([
      supabase
        .from('categories')
        .select('id, name')
        .eq('restaurant_id', loja_)
        .eq('is_active', true)
        .order('position')
        .order('created_at'),
      supabase
        .from('products')
        .select('id, category_id, name, price_cents, photo_path')
        .eq('restaurant_id', loja_)
        .eq('is_active', true)
        .order('position')
        .order('created_at'),
      supabase
        .from('product_variants')
        .select('id, product_id, name, price_cents')
        .eq('restaurant_id', loja_)
        .eq('is_active', true)
        .order('position'),
      supabase
        .from('product_modifier_groups')
        .select('product_id, group_id, position')
        .eq('restaurant_id', loja_)
        .order('position'),
      supabase
        .from('modifier_groups')
        .select('id, name, min_select, max_select')
        .eq('restaurant_id', loja_),
      supabase
        .from('modifiers')
        .select('id, group_id, name, price_cents')
        .eq('restaurant_id', loja_)
        .eq('is_active', true)
        .order('position'),
    ]).then(([cats, prods, tamanhos, ligacoes, grupos, itens]) => {
      if (!ativo) return;
      if (
        cats.error ||
        prods.error ||
        tamanhos.error ||
        ligacoes.error ||
        grupos.error ||
        itens.error
      ) {
        setFalhou(true);
        setCarregando(false);
        return;
      }
      const porGrupo = new Map<string, GrupoDeOpcoes>(
        grupos.data.map((g) => [
          g.id,
          { id: g.id, nome: g.name, minimo: g.min_select, maximo: g.max_select, itens: [] },
        ]),
      );
      for (const i of itens.data) {
        porGrupo
          .get(i.group_id)
          ?.itens.push({ id: i.id, nome: i.name, precoCentavos: i.price_cents });
      }
      const mapa = new Map<string, Opcoes>();
      const doProduto = (id: string) => {
        if (!mapa.has(id)) mapa.set(id, { tamanhos: [], grupos: [] });
        return mapa.get(id)!;
      };
      for (const t of tamanhos.data) {
        doProduto(t.product_id).tamanhos.push({
          id: t.id,
          nome: t.name,
          precoCentavos: t.price_cents,
        });
      }
      for (const l of ligacoes.data) {
        const grupo = porGrupo.get(l.group_id);
        if (grupo && (grupo.itens.length > 0 || grupo.minimo > 0))
          doProduto(l.product_id).grupos.push(grupo);
      }
      setCategorias(cats.data);
      setProdutos(prods.data);
      setOpcoes(mapa);
      setCategoriaAtual(cats.data[0]?.id ?? null);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [supabase, loja.id]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo) return produtos.filter((p) => p.name.toLowerCase().includes(termo));
    return produtos.filter((p) => p.category_id === categoriaAtual);
  }, [produtos, categoriaAtual, busca]);

  const subtotal = subtotalCentavos(carrinho);
  // Algum produto da grade tem foto: todos os blocos reservam o espaço, para a grade ficar alinhada
  const gradeComFotos = visiveis.some((p) => p.photo_path);
  const fotoDoProduto = (id: string) =>
    urlDaFoto(supabase, produtos.find((p) => p.id === id)?.photo_path ?? null);
  const ident = identificacaoPara(tipo, atendimento);
  const identificacaoFalta = ident.campo !== null && !identificador.trim();
  const trocoParaCentavos = trocoPara.trim() === '' ? null : lerPreco(trocoPara);
  const montandoPedido = painel.tela === 'pedido';

  function tocarProduto(p: Produto) {
    const o = opcoes.get(p.id) ?? SEM_OPCOES;
    if (o.tamanhos.length > 0 || o.grupos.length > 0) setMontando(p);
    else setCarrinho((c) => adicionarItem(c, itemSimples(p)));
  }

  function escolherTipo(novo: TipoPedido) {
    setTipo(novo);
    setIdentificador('');
    setPrevisto(null);
    setTrocoPara('');
  }

  function limparPedido() {
    setCarrinho([]);
    escolherTipo('balcao');
    setErro('');
  }

  const contarContas = useCallback((n: number) => setContasAbertas(n), []);

  async function lancar(destino: 'cozinha' | 'cobrar') {
    setErro('');
    setEnviado('');
    setEnviando(destino);
    const identificacao = ident.tipo;
    const { data, error } = await supabase.rpc('criar_pedido', {
      p_restaurant_id: loja.id,
      p_tipo: tipo,
      p_identificador_tipo: identificacao,
      p_identificador: ident.campo ? identificador.trim() : null,
      p_itens: carrinho.map((i) => ({
        product_id: i.productId,
        quantidade: i.quantidade,
        variant_id: i.tamanhoId,
        adicionais: i.adicionais.map((a) => a.id),
        observacao: i.observacao || null,
      })),
      p_pagamento_previsto: tipo === 'delivery' || tipo === 'retirada' ? previsto : null,
      p_troco_para_cents: previsto === 'dinheiro' ? trocoParaCentavos : null,
    });
    const linha = data?.[0];
    if (error || !linha) {
      setEnviando(null);
      setErro(error ? mensagem(error) : 'Não foi possível lançar o pedido.');
      return;
    }

    if (destino === 'cozinha') {
      setEnviando(null);
      setEnviado(
        `${rotuloDaConta(identificacao, linha.identificador)}: pedido #${String(linha.numero).padStart(3, '0')} enviado para a cozinha.`,
      );
      limparPedido();
      return;
    }

    const { data: conta } = await supabase
      .from('tabs')
      .select(CAMPOS_DA_CONTA)
      .eq('id', linha.conta_id)
      .single();
    setEnviando(null);
    limparPedido();
    if (conta) setPainel({ tela: 'cobrando', conta, pedidoId: linha.id });
  }

  async function imprimirDeNovo(pedidoId: string) {
    const { error } = await supabase.rpc('reimprimir_pedido', { p_pedido: pedidoId });
    return !error;
  }

  if (carregando || falhou) {
    return (
      <main className="flex min-h-dvh flex-col items-start gap-4 p-8">
        <Button variant="ghost" className="px-0" onClick={onVoltar}>
          ← {loja.name}
        </Button>
        <p className="text-body text-ink-muted">
          {falhou ? 'Não conseguimos carregar o cardápio. Confira a internet.' : 'Abrindo o PDV…'}
        </p>
      </main>
    );
  }

  if (produtos.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
        <h1 className="font-display text-title-screen text-ink">Cardápio vazio</h1>
        <p className="text-body text-ink-muted">
          Cadastre pelo menos um produto ativo no cardápio para começar a vender.
        </p>
        <Button className="self-start" onClick={onVoltar}>
          Voltar
        </Button>
      </main>
    );
  }

  const primarioEnviar = tipo !== 'balcao';

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-canvas lg:h-dvh lg:grid-cols-[112px_minmax(0,1fr)_420px]">
      <nav
        aria-label="Categorias"
        className="flex gap-2 overflow-x-auto bg-brand p-3 lg:flex-col lg:overflow-y-auto"
      >
        <button
          type="button"
          onClick={onVoltar}
          aria-label={`Sair do PDV e voltar para ${loja.name}`}
          className="flex min-h-14 shrink-0 items-center justify-center rounded-md px-4 text-brand-ink hover:bg-canvas/15"
        >
          <Icon name="voltar" />
        </button>
        {categorias.map((c) => {
          const selecionada = c.id === categoriaAtual && !busca;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={selecionada}
              onClick={() => {
                setCategoriaAtual(c.id);
                setBusca('');
              }}
              className={cn(
                'min-h-16 shrink-0 rounded-md px-3 text-label lg:min-h-20',
                selecionada ? 'bg-canvas text-brand-text' : 'text-brand-ink hover:bg-canvas/15',
              )}
            >
              {c.name}
            </button>
          );
        })}
      </nav>

      <main className="flex min-w-0 flex-col gap-5 p-5 lg:overflow-y-auto lg:p-6">
        {avisos}
        <SegmentedControl
          label="Área principal"
          className="self-start"
          options={[
            { value: 'cardapio', label: 'Cardápio' },
            { value: 'salao', label: 'Salão' },
          ]}
          value={modo}
          onChange={setModo}
        />
        {modo === 'salao' && (
          <Salao
            supabase={supabase}
            lojaId={loja.id}
            onMesaLivre={(label) => {
              escolherTipo('mesa');
              setIdentificador(label);
              setModo('cardapio');
              setPainel({ tela: 'pedido' });
            }}
            onMesaOcupada={(contaId) => setPainel({ tela: 'contas', abrir: contaId })}
          />
        )}
        <div
          className={cn(
            'flex flex-wrap items-end justify-between gap-4',
            modo === 'salao' && 'hidden',
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="text-caption text-ink-muted">{loja.name}</span>
            <h1 className="font-display text-title-screen text-ink">
              {busca
                ? 'Busca'
                : (categorias.find((c) => c.id === categoriaAtual)?.name ?? 'Produtos')}
            </h1>
          </div>
          {cabecalhoDoCaixa}
          <TextField
            label="Buscar produto"
            className="w-full sm:w-72"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome do produto"
          />
        </div>

        {modo === 'salao' ? null : visiveis.length === 0 ? (
          <p className="text-body text-ink-muted">Nenhum produto aqui.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {visiveis.map((p) => {
              const o = opcoes.get(p.id) ?? SEM_OPCOES;
              const menor = o.tamanhos.length
                ? Math.min(...o.tamanhos.map((t) => t.precoCentavos))
                : p.price_cents;
              return (
                <ProductTile
                  key={p.id}
                  name={p.name}
                  priceLabel={
                    o.tamanhos.length > 1
                      ? `a partir de ${formatarPreco(menor)}`
                      : formatarPreco(menor)
                  }
                  imageUrl={urlDaFoto(supabase, p.photo_path)}
                  showImage={gradeComFotos}
                  quantity={quantidadeDoProduto(carrinho, p.id)}
                  disabled={!montandoPedido}
                  onClick={() => tocarProduto(p)}
                />
              );
            })}
          </div>
        )}
      </main>

      <aside
        aria-label="Pedido e contas"
        className="flex flex-col border-t border-line bg-surface lg:border-t-0 lg:border-l"
      >
        {(painel.tela === 'pedido' || painel.tela === 'contas') && (
          <div className="border-b border-line p-4">
            <SegmentedControl
              label="Painel do PDV"
              options={[
                { value: 'pedido', label: 'Novo pedido' },
                {
                  value: 'contas',
                  label: contasAbertas ? `Contas abertas (${contasAbertas})` : 'Contas abertas',
                },
              ]}
              value={painel.tela}
              onChange={(t) => setPainel({ tela: t })}
            />
          </div>
        )}

        {painel.tela === 'contas' && (
          <ContasAbertas
            supabase={supabase}
            lojaId={loja.id}
            onQuantidade={contarContas}
            abrirContaId={painel.abrir ?? null}
            onCobrar={(conta) => setPainel({ tela: 'cobrando', conta, pedidoId: null })}
            onNovaRodada={(mesa) => {
              escolherTipo('mesa');
              setIdentificador(mesa);
              setModo('cardapio');
              setPainel({ tela: 'pedido' });
            }}
          />
        )}

        {painel.tela === 'cobrando' && (
          <Cobranca
            supabase={supabase}
            conta={painel.conta}
            onVoltar={() => setPainel({ tela: painel.pedidoId ? 'pedido' : 'contas' })}
            onPaga={(pagamentos) =>
              setPainel({
                tela: 'paga',
                conta: painel.conta,
                pagamentos,
                pedidoId: painel.pedidoId,
              })
            }
          />
        )}

        {painel.tela === 'paga' && (
          <ContaPaga
            conta={painel.conta}
            pagamentos={painel.pagamentos}
            onNovo={() => setPainel({ tela: 'pedido' })}
            onImprimirDeNovo={painel.pedidoId ? () => imprimirDeNovo(painel.pedidoId!) : undefined}
          />
        )}

        {painel.tela === 'pedido' && (
          <>
            <div className="flex flex-col gap-3 border-b border-line p-5">
              <SegmentedControl
                label="Tipo do pedido"
                options={TIPOS}
                value={tipo}
                onChange={escolherTipo}
              />
              {ident.campo ? (
                <TextField
                  label={ident.campo.rotulo}
                  inputMode={ident.campo.numerico ? 'numeric' : 'text'}
                  maxLength={40}
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                />
              ) : (
                <p className="text-caption text-ink-muted">
                  A senha sai sozinha e é chamada quando o pedido ficar pronto.
                </p>
              )}
              {(tipo === 'delivery' || tipo === 'retirada') && (
                <div className="flex flex-col gap-2">
                  <span className="text-label text-ink">Como vai pagar</span>
                  <ChoiceGrid
                    label="Como o cliente vai pagar"
                    columns={4}
                    options={METODOS}
                    value={previsto}
                    onChange={setPrevisto}
                  />
                  {previsto === 'dinheiro' && (
                    <TextField
                      label="Troco para (opcional)"
                      inputMode="decimal"
                      placeholder="Ex.: 100,00"
                      value={trocoPara}
                      onChange={(e) => setTrocoPara(e.target.value)}
                      error={
                        trocoPara && trocoParaCentavos === null
                          ? 'Digite um valor, por exemplo 100,00.'
                          : undefined
                      }
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col px-5 lg:overflow-y-auto">
              <Alert tone="sucesso" className="mt-4">
                {enviado}
              </Alert>
              {carrinho.length === 0 ? (
                <p className="py-8 text-body text-ink-muted">
                  Toque nos produtos para montar o pedido.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {carrinho.map((i) => {
                    const detalhe = detalheDoItem(i);
                    return (
                      <li key={i.chave} className="flex items-center gap-3 py-3">
                        {fotoDoProduto(i.productId) && (
                          <img
                            src={fotoDoProduto(i.productId)!}
                            alt=""
                            loading="lazy"
                            className="aspect-[4/3] w-12 shrink-0 rounded-sm object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-body-strong text-ink">{i.nome}</p>
                          {detalhe && <p className="text-caption text-ink-muted">{detalhe}</p>}
                          <p className="text-caption text-ink-muted tabular-nums">
                            {formatarPreco(i.precoCentavos * i.quantidade)}
                          </p>
                        </div>
                        <QuantityStepper
                          value={i.quantidade}
                          itemName={i.nome}
                          onDecrement={() => setCarrinho((c) => removerUnidade(c, i.chave))}
                          onIncrement={() => setCarrinho((c) => somarUnidade(c, i.chave))}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-line bg-surface-strong p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-body-strong text-ink">
                  Total ·{' '}
                  {quantidadeTotal(carrinho) === 1
                    ? '1 item'
                    : `${quantidadeTotal(carrinho)} itens`}
                </span>
                <span className="font-display text-display text-ink tabular-nums">
                  {formatarPreco(subtotal)}
                </span>
              </div>
              {tipo === 'mesa' && (
                <p className="text-caption text-ink-muted">
                  A taxa de serviço entra no fechamento da conta.
                </p>
              )}
              <Alert>{erro}</Alert>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={primarioEnviar ? 'primary' : 'secondary'}
                  className="h-target-pdv"
                  disabled={carrinho.length === 0 || identificacaoFalta || enviando !== null}
                  loading={enviando === 'cozinha'}
                  onClick={() => void lancar('cozinha')}
                >
                  Enviar para a cozinha
                </Button>
                <Button
                  variant={primarioEnviar ? 'secondary' : 'primary'}
                  className="h-target-pdv"
                  disabled={carrinho.length === 0 || identificacaoFalta || enviando !== null}
                  loading={enviando === 'cobrar'}
                  onClick={() => void lancar('cobrar')}
                >
                  Cobrar agora
                </Button>
              </div>
              <div className="flex items-center justify-between">
                {identificacaoFalta && carrinho.length > 0 ? (
                  <p className="text-caption text-ink-muted">
                    {ident.tipo === 'mesa'
                      ? 'Digite o número da mesa.'
                      : 'Digite o nome do cliente.'}
                  </p>
                ) : (
                  <span />
                )}
                <Button
                  variant="ghost"
                  disabled={carrinho.length === 0}
                  onClick={() => setCarrinho([])}
                >
                  Limpar
                </Button>
              </div>
            </div>
          </>
        )}
      </aside>

      {montando && (
        <MontarItem
          produto={montando}
          fotoUrl={urlDaFoto(supabase, montando.photo_path)}
          tamanhos={opcoes.get(montando.id)?.tamanhos ?? []}
          grupos={opcoes.get(montando.id)?.grupos ?? []}
          onFechar={() => setMontando(null)}
          onAdicionar={(item: NovoItem) => {
            setCarrinho((c) => adicionarItem(c, item));
            setMontando(null);
            setEnviado('');
          }}
        />
      )}
    </div>
  );
}
