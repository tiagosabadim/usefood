import {
  adicionarItem,
  detalheDoItem,
  dividirIgual,
  formatarPreco,
  itemSimples,
  lerPreco,
  precoParaCampo,
  quantidadeDoProduto,
  quantidadeTotal,
  removerUnidade,
  somarUnidade,
  subtotalCentavos,
  sugestoesDeNotas,
  taxaServicoCentavos,
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
  Switch,
  TextField,
  type Option,
} from '@usefood/ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MontarItem, type GrupoDeOpcoes, type OpcaoTamanho } from './montar-item';

type Categoria = Pick<Tables<'categories'>, 'id' | 'name'>;
type Produto = Pick<Tables<'products'>, 'id' | 'category_id' | 'name' | 'price_cents'>;
type Identificacao = 'senha' | 'nome' | 'mesa';
type Metodo = Enums<'payment_method'>;
interface Opcoes {
  tamanhos: OpcaoTamanho[];
  grupos: GrupoDeOpcoes[];
}
interface PedidoCriado {
  id: string;
  numero: number;
  identificador: string;
  totalCentavos: number;
}
interface PagamentoFeito {
  metodo: Metodo;
  valorCentavos: number;
  trocoCentavos: number;
}

const METODOS: Option<Metodo>[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Crédito' },
  { value: 'debito', label: 'Débito' },
];
const IDENTIFICACOES: Option<Identificacao>[] = [
  { value: 'senha', label: 'Senha' },
  { value: 'nome', label: 'Nome' },
  { value: 'mesa', label: 'Mesa' },
];
const DIVISOES: Option<'1' | '2' | '3' | '4'>[] = [
  { value: '1', label: 'Inteira' },
  { value: '2', label: '÷ 2' },
  { value: '3', label: '÷ 3' },
  { value: '4', label: '÷ 4' },
];
const ERROS_CONHECIDOS = new Set(['P0001', 'P0002', '22023', '42501']);
const SEM_OPCOES: Opcoes = { tamanhos: [], grupos: [] };

function mensagem(erro: { code?: string; message?: string }): string {
  return erro.code && ERROS_CONHECIDOS.has(erro.code) && erro.message
    ? erro.message
    : 'Não deu certo agora. Confira a internet e tente de novo.';
}
const rotuloDoMetodo = (m: Metodo) => METODOS.find((x) => x.value === m)?.label ?? m;

/** Venda de balcão: tocar nos produtos, montar opções, identificar e cobrar (inteira ou em partes). */
export function Pdv({
  supabase,
  loja,
  onVoltar,
  cabecalhoDoCaixa,
  avisos,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
  /** Situação do caixa e o botão que abre o painel do caixa. */
  cabecalhoDoCaixa?: ReactNode;
  /** Avisos de impressão, no topo da área de produtos. */
  avisos?: ReactNode;
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
  const [identificacao, setIdentificacao] = useState<Identificacao>('senha');
  const [identificador, setIdentificador] = useState('');
  const [taxa, setTaxa] = useState(false);

  const [etapa, setEtapa] = useState<'montando' | 'cobrando' | 'concluido'>('montando');
  const [pedidoCriado, setPedidoCriado] = useState<PedidoCriado | null>(null);
  const [pagamentos, setPagamentos] = useState<PagamentoFeito[]>([]);
  const [dividirPor, setDividirPor] = useState(1);
  const [parteDigitada, setParteDigitada] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [recebido, setRecebido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [reimpresso, setReimpresso] = useState<'nao' | 'enviando' | 'sim'>('nao');

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
        .select('id, category_id, name, price_cents')
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
  const taxaCentavos = taxa ? taxaServicoCentavos(subtotal) : 0;
  // Depois que o pedido existe, vale o total calculado pelo banco.
  const total = pedidoCriado?.totalCentavos ?? subtotal + taxaCentavos;
  const pago = pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
  const falta = total - pago;
  const pessoasRestantes = Math.max(1, dividirPor - pagamentos.length);
  const parteSugerida = dividirIgual(falta, pessoasRestantes)[0] ?? falta;
  const parte = parteDigitada === null ? parteSugerida : lerPreco(parteDigitada);
  const parteValida = parte !== null && parte > 0 && parte <= falta;
  const recebidoCentavos = lerPreco(recebido);
  const troco =
    metodo === 'dinheiro' && recebidoCentavos !== null && parte !== null
      ? recebidoCentavos - parte
      : 0;
  const identificacaoFalta = identificacao !== 'senha' && !identificador.trim();
  const podeConfirmar =
    metodo !== null &&
    parteValida &&
    (metodo !== 'dinheiro' ||
      (recebidoCentavos !== null && parte !== null && recebidoCentavos >= parte));

  function tocarProduto(p: Produto) {
    const o = opcoes.get(p.id) ?? SEM_OPCOES;
    if (o.tamanhos.length > 0 || o.grupos.length > 0) setMontando(p);
    else setCarrinho((c) => adicionarItem(c, itemSimples(p)));
  }

  function escolherIdentificacao(tipo: Identificacao) {
    setIdentificacao(tipo);
    setIdentificador('');
    setTaxa(tipo === 'mesa');
  }

  function novoPedido() {
    setCarrinho([]);
    setIdentificacao('senha');
    setIdentificador('');
    setTaxa(false);
    setEtapa('montando');
    setPedidoCriado(null);
    setPagamentos([]);
    setDividirPor(1);
    setParteDigitada(null);
    setMetodo(null);
    setRecebido('');
    setErro('');
    setReimpresso('nao');
  }

  async function imprimirDeNovo() {
    if (!pedidoCriado) return;
    setReimpresso('enviando');
    const { error } = await supabase.rpc('reimprimir_pedido', { p_pedido: pedidoCriado.id });
    setReimpresso(error ? 'nao' : 'sim');
  }

  async function confirmarPagamento() {
    if (!metodo || parte === null) return;
    setErro('');
    setEnviando(true);

    // 1. Cria o pedido uma vez só; as partes seguintes só registram pagamento.
    let pedido: PedidoCriado | null = pedidoCriado;
    if (!pedido) {
      const { data, error } = await supabase.rpc('criar_pedido', {
        p_restaurant_id: loja.id,
        p_tipo: identificacao === 'mesa' ? 'mesa' : 'balcao',
        p_identificador_tipo: identificacao,
        p_identificador: identificacao === 'senha' ? null : identificador.trim(),
        p_itens: carrinho.map((i) => ({
          product_id: i.productId,
          quantidade: i.quantidade,
          variant_id: i.tamanhoId,
          adicionais: i.adicionais.map((a) => a.id),
          observacao: i.observacao || null,
        })),
        p_taxa_servico: taxa,
      });
      const linha = data?.[0];
      if (error || !linha) {
        setEnviando(false);
        setErro(error ? mensagem(error) : 'Não foi possível criar o pedido.');
        return;
      }
      pedido = {
        id: linha.id,
        numero: linha.numero,
        identificador: linha.identificador,
        totalCentavos: linha.total_cents,
      };
      setPedidoCriado(pedido);
      if (linha.total_cents !== total) {
        setEnviando(false);
        setParteDigitada(null);
        setErro(
          `O total foi atualizado para ${formatarPreco(linha.total_cents)}. Confira e confirme de novo.`,
        );
        return;
      }
    }

    // 2. Registra esta parte (no dinheiro, o banco calcula o troco sobre o recebido)
    const { data, error } = await supabase.rpc('registrar_pagamento', {
      p_pedido: pedido.id,
      p_metodo: metodo,
      p_valor_cents: parte,
      p_recebido_cents: metodo === 'dinheiro' ? recebidoCentavos : null,
    });
    setEnviando(false);
    const resultado = data?.[0];
    if (error || !resultado) {
      setErro(error ? mensagem(error) : 'Não foi possível registrar o pagamento.');
      return;
    }
    setPagamentos((ps) => [
      ...ps,
      { metodo, valorCentavos: resultado.pago_cents - pago, trocoCentavos: resultado.troco_cents },
    ]);
    setMetodo(null);
    setRecebido('');
    setParteDigitada(null);
    if (resultado.falta_cents <= 0) setEtapa('concluido');
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

  const ultimoTroco = pagamentos.at(-1)?.trocoCentavos ?? 0;
  const listaDePagamentos = pagamentos.length > 0 && (
    <ul className="flex flex-col gap-1 text-body text-ink-muted">
      {pagamentos.map((p, i) => (
        <li key={i} className="flex justify-between">
          <span>
            {rotuloDoMetodo(p.metodo)}
            {p.trocoCentavos > 0 && ` · troco ${formatarPreco(p.trocoCentavos)}`}
          </span>
          <span className="tabular-nums">{formatarPreco(p.valorCentavos)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-canvas lg:h-dvh lg:grid-cols-[112px_minmax(0,1fr)_400px]">
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
        <div className="flex flex-wrap items-end justify-between gap-4">
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

        {visiveis.length === 0 ? (
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
                  quantity={quantidadeDoProduto(carrinho, p.id)}
                  disabled={etapa !== 'montando'}
                  onClick={() => tocarProduto(p)}
                />
              );
            })}
          </div>
        )}
      </main>

      <aside
        aria-label="Pedido atual"
        className="flex flex-col border-t border-line bg-surface lg:border-t-0 lg:border-l"
      >
        {etapa === 'concluido' && pedidoCriado ? (
          <div className="flex flex-1 flex-col justify-center gap-6 p-6">
            <div className="flex flex-col gap-2">
              <span className="text-caption text-ink-muted">
                Pedido #{String(pedidoCriado.numero).padStart(3, '0')} pago
              </span>
              <span className="font-display text-display text-ink">
                {identificacao === 'senha' && `Senha ${pedidoCriado.identificador}`}
                {identificacao === 'nome' && pedidoCriado.identificador}
                {identificacao === 'mesa' && `Mesa ${pedidoCriado.identificador}`}
              </span>
            </div>
            {listaDePagamentos}
            {ultimoTroco > 0 && (
              <div className="rounded-lg bg-sun p-5">
                <span className="text-label text-sun-ink">Troco</span>
                <p className="font-display text-display text-sun-ink tabular-nums">
                  {formatarPreco(ultimoTroco)}
                </p>
              </div>
            )}
            <Button className="h-target-pdv" onClick={novoPedido}>
              Novo pedido
            </Button>
            <Button
              variant="ghost"
              loading={reimpresso === 'enviando'}
              disabled={reimpresso === 'sim'}
              onClick={() => void imprimirDeNovo()}
            >
              {reimpresso === 'sim' ? 'Enviado para a cozinha de novo' : 'Imprimir de novo'}
            </Button>
          </div>
        ) : etapa === 'cobrando' ? (
          <div className="flex flex-1 flex-col gap-5 p-6 lg:overflow-y-auto">
            <div className="flex flex-col gap-1">
              <span className="text-caption text-ink-muted">
                {pagamentos.length ? `Falta pagar · total ${formatarPreco(total)}` : 'Cobrar'}
              </span>
              <span className="font-display text-display text-ink tabular-nums">
                {formatarPreco(falta)}
              </span>
            </div>

            {listaDePagamentos}

            <div className="flex flex-col gap-2">
              <span className="text-label text-ink">Dividir a conta</span>
              <SegmentedControl
                label="Dividir a conta"
                options={DIVISOES}
                value={String(dividirPor) as '1' | '2' | '3' | '4'}
                onChange={(v) => {
                  setDividirPor(Number(v));
                  setParteDigitada(null);
                }}
              />
            </div>
            {(dividirPor > 1 || pagamentos.length > 0) && (
              <TextField
                label="Valor desta parte"
                inputMode="decimal"
                value={parteDigitada ?? precoParaCampo(parteSugerida)}
                onChange={(e) => setParteDigitada(e.target.value)}
                error={!parteValida ? `Digite um valor de até ${formatarPreco(falta)}.` : undefined}
                hint={
                  dividirPor > 1 ? `Parte ${pagamentos.length + 1} de ${dividirPor}` : undefined
                }
              />
            )}

            <ChoiceGrid
              label="Forma de pagamento"
              options={METODOS}
              value={metodo}
              onChange={(m) => {
                setMetodo(m);
                setErro('');
              }}
            />
            {metodo === 'dinheiro' && parte !== null && (
              <div className="flex flex-col gap-3">
                <TextField
                  label="Valor recebido"
                  inputMode="decimal"
                  placeholder="0,00"
                  autoFocus
                  value={recebido}
                  onChange={(e) => setRecebido(e.target.value)}
                  error={
                    recebidoCentavos !== null && recebidoCentavos < parte
                      ? 'Valor menor que a parte.'
                      : undefined
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setRecebido(precoParaCampo(parte))}>
                    Valor exato
                  </Button>
                  {sugestoesDeNotas(parte).map((nota) => (
                    <Button
                      key={nota}
                      variant="secondary"
                      onClick={() => setRecebido(precoParaCampo(nota))}
                    >
                      {formatarPreco(nota)}
                    </Button>
                  ))}
                </div>
                {troco > 0 && (
                  <p className="text-body-strong text-ink">
                    Troco: <span className="tabular-nums">{formatarPreco(troco)}</span>
                  </p>
                )}
              </div>
            )}
            <Alert>{erro}</Alert>
            <div className="mt-auto flex flex-col gap-2">
              <Button
                className="h-target-pdv"
                disabled={!podeConfirmar}
                loading={enviando}
                onClick={() => void confirmarPagamento()}
              >
                {parte !== null && parte < falta
                  ? `Receber ${formatarPreco(parte)}`
                  : 'Confirmar pagamento'}
              </Button>
              {!pedidoCriado && (
                <Button variant="ghost" onClick={() => setEtapa('montando')}>
                  Voltar ao pedido
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-line p-5">
              <SegmentedControl
                label="Identificação do pedido"
                className="self-start"
                options={IDENTIFICACOES}
                value={identificacao}
                onChange={escolherIdentificacao}
              />
              {identificacao === 'senha' ? (
                <p className="text-caption text-ink-muted">
                  A senha sai sozinha quando o pedido for pago.
                </p>
              ) : (
                <TextField
                  label={identificacao === 'nome' ? 'Nome do cliente' : 'Número da mesa'}
                  inputMode={identificacao === 'mesa' ? 'numeric' : 'text'}
                  maxLength={40}
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                />
              )}
            </div>

            <div className="flex flex-1 flex-col px-5 lg:overflow-y-auto">
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
              <Switch checked={taxa} onChange={setTaxa} label="Taxa de serviço (10%)" showLabel />
              <div className="flex justify-between text-body text-ink-muted">
                <span>
                  Subtotal ·{' '}
                  {quantidadeTotal(carrinho) === 1
                    ? '1 item'
                    : `${quantidadeTotal(carrinho)} itens`}
                </span>
                <span className="tabular-nums">{formatarPreco(subtotal)}</span>
              </div>
              {taxa && (
                <div className="flex justify-between text-body text-ink-muted">
                  <span>Taxa de serviço</span>
                  <span className="tabular-nums">{formatarPreco(taxaCentavos)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-body-strong text-ink">Total</span>
                <span className="font-display text-display text-ink tabular-nums">
                  {formatarPreco(total)}
                </span>
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <Button
                  variant="secondary"
                  className="h-target-pdv"
                  disabled={carrinho.length === 0}
                  onClick={() => setCarrinho([])}
                >
                  Limpar
                </Button>
                <Button
                  className="h-target-pdv"
                  disabled={carrinho.length === 0 || identificacaoFalta}
                  onClick={() => {
                    setErro('');
                    setEtapa('cobrando');
                  }}
                >
                  Cobrar {formatarPreco(total)}
                </Button>
              </div>
              {identificacaoFalta && carrinho.length > 0 && (
                <p className="text-caption text-ink-muted">
                  {identificacao === 'nome'
                    ? 'Digite o nome do cliente para cobrar.'
                    : 'Digite o número da mesa para cobrar.'}
                </p>
              )}
            </div>
          </>
        )}
      </aside>

      {montando && (
        <MontarItem
          produto={montando}
          tamanhos={opcoes.get(montando.id)?.tamanhos ?? []}
          grupos={opcoes.get(montando.id)?.grupos ?? []}
          onFechar={() => setMontando(null)}
          onAdicionar={(item: NovoItem) => {
            setCarrinho((c) => adicionarItem(c, item));
            setMontando(null);
          }}
        />
      )}
    </div>
  );
}
