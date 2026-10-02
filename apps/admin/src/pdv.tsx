import {
  adicionarItem,
  formatarPreco,
  lerPreco,
  quantidadeTotal,
  removerUnidade,
  subtotalCentavos,
  sugestoesDeNotas,
  taxaServicoCentavos,
  type ItemCarrinho,
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
import { useEffect, useMemo, useState } from 'react';

type Categoria = Pick<Tables<'categories'>, 'id' | 'name'>;
type Produto = Pick<Tables<'products'>, 'id' | 'category_id' | 'name' | 'price_cents'>;
type Identificacao = 'senha' | 'nome' | 'mesa';
type Metodo = Enums<'payment_method'>;
interface PedidoCriado {
  id: string;
  numero: number;
  identificador: string;
  totalCentavos: number;
}
interface Concluido {
  numero: number;
  identificador: string;
  tipo: Identificacao;
  metodo: Metodo;
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
const ERROS_CONHECIDOS = new Set(['P0001', 'P0002', '22023', '42501']);

function mensagem(erro: { code?: string; message?: string }): string {
  return erro.code && ERROS_CONHECIDOS.has(erro.code) && erro.message
    ? erro.message
    : 'Não deu certo agora. Confira a internet e tente de novo.';
}

/** Venda de balcão: tocar nos produtos, identificar, cobrar. */
export function Pdv({
  supabase,
  loja,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categoriaAtual, setCategoriaAtual] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [identificacao, setIdentificacao] = useState<Identificacao>('senha');
  const [identificador, setIdentificador] = useState('');
  const [taxa, setTaxa] = useState(false);

  const [etapa, setEtapa] = useState<'montando' | 'cobrando' | 'concluido'>('montando');
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [recebido, setRecebido] = useState('');
  const [pedidoCriado, setPedidoCriado] = useState<PedidoCriado | null>(null);
  const [concluido, setConcluido] = useState<Concluido | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      supabase
        .from('categories')
        .select('id, name')
        .eq('restaurant_id', loja.id)
        .eq('is_active', true)
        .order('position')
        .order('created_at'),
      supabase
        .from('products')
        .select('id, category_id, name, price_cents')
        .eq('restaurant_id', loja.id)
        .eq('is_active', true)
        .order('position')
        .order('created_at'),
    ]).then(([cats, prods]) => {
      if (!ativo) return;
      if (cats.error || prods.error) {
        setFalhou(true);
      } else {
        setCategorias(cats.data);
        setProdutos(prods.data);
        setCategoriaAtual(cats.data[0]?.id ?? null);
      }
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
  const itens = quantidadeTotal(carrinho);
  const quantidadeNoCarrinho = (id: string) =>
    carrinho.find((i) => i.productId === id)?.quantidade ?? 0;

  const recebidoCentavos = lerPreco(recebido);
  const troco = metodo === 'dinheiro' && recebidoCentavos !== null ? recebidoCentavos - total : 0;
  const identificacaoFalta = identificacao !== 'senha' && !identificador.trim();
  const podeConfirmar =
    metodo !== null &&
    (metodo !== 'dinheiro' || (recebidoCentavos !== null && recebidoCentavos >= total));

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
    setMetodo(null);
    setRecebido('');
    setPedidoCriado(null);
    setConcluido(null);
    setErro('');
  }

  async function confirmarPagamento() {
    if (!metodo) return;
    setErro('');
    setEnviando(true);

    // 1. Cria o pedido uma vez só; se o pagamento falhar, tenta de novo sem duplicar o pedido.
    let pedido: PedidoCriado | null = pedidoCriado;
    if (!pedido) {
      const { data, error } = await supabase.rpc('criar_pedido', {
        p_restaurant_id: loja.id,
        p_tipo: identificacao === 'mesa' ? 'mesa' : 'balcao',
        p_identificador_tipo: identificacao,
        p_identificador: identificacao === 'senha' ? null : identificador.trim(),
        p_itens: carrinho.map((i) => ({ product_id: i.productId, quantidade: i.quantidade })),
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
        // O banco é a fonte da verdade: um preço pode ter mudado agora há pouco.
        setEnviando(false);
        setErro(
          `O total foi atualizado para ${formatarPreco(linha.total_cents)}. Confira e confirme de novo.`,
        );
        return;
      }
    }

    // 2. Registra o pagamento
    const valor =
      metodo === 'dinheiro' && recebidoCentavos !== null ? recebidoCentavos : pedido.totalCentavos;
    const { data, error } = await supabase.rpc('registrar_pagamento', {
      p_pedido: pedido.id,
      p_metodo: metodo,
      p_valor_cents: valor,
    });
    setEnviando(false);
    const resultado = data?.[0];
    if (error || !resultado) {
      setErro(error ? mensagem(error) : 'Não foi possível registrar o pagamento.');
      return;
    }
    setConcluido({
      numero: pedido.numero,
      identificador: pedido.identificador,
      tipo: identificacao,
      metodo,
      trocoCentavos: resultado.troco_cents,
    });
    setEtapa('concluido');
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

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-canvas lg:h-dvh lg:grid-cols-[112px_minmax(0,1fr)_400px]">
      {/* Trilho de categorias */}
      <nav
        aria-label="Categorias"
        className="flex gap-2 overflow-x-auto bg-brand p-3 lg:flex-col lg:overflow-y-auto lg:p-3"
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

      {/* Produtos */}
      <main className="flex min-w-0 flex-col gap-5 p-5 lg:overflow-y-auto lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-ink-muted">{loja.name} · Caixa</span>
            <h1 className="font-display text-title-screen text-ink">
              {busca
                ? 'Busca'
                : (categorias.find((c) => c.id === categoriaAtual)?.name ?? 'Produtos')}
            </h1>
          </div>
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
            {visiveis.map((p) => (
              <ProductTile
                key={p.id}
                name={p.name}
                priceLabel={formatarPreco(p.price_cents)}
                quantity={quantidadeNoCarrinho(p.id)}
                disabled={etapa !== 'montando'}
                onClick={() => setCarrinho((c) => adicionarItem(c, p))}
              />
            ))}
          </div>
        )}
      </main>

      {/* Pedido */}
      <aside
        aria-label="Pedido atual"
        className="flex flex-col border-t border-line bg-surface lg:border-t-0 lg:border-l"
      >
        {etapa === 'concluido' && concluido ? (
          <div className="flex flex-1 flex-col justify-center gap-6 p-6">
            <div className="flex flex-col gap-2">
              <span className="text-caption text-ink-muted">
                Pedido #{String(concluido.numero).padStart(3, '0')} pago
              </span>
              <span className="font-display text-display text-ink">
                {concluido.tipo === 'senha' && `Senha ${concluido.identificador}`}
                {concluido.tipo === 'nome' && concluido.identificador}
                {concluido.tipo === 'mesa' && `Mesa ${concluido.identificador}`}
              </span>
              <span className="text-body text-ink-muted">
                {METODOS.find((m) => m.value === concluido.metodo)?.label}
              </span>
            </div>
            {concluido.trocoCentavos > 0 && (
              <div className="rounded-lg bg-sun p-5">
                <span className="text-label text-sun-ink">Troco</span>
                <p className="font-display text-display text-sun-ink tabular-nums">
                  {formatarPreco(concluido.trocoCentavos)}
                </p>
              </div>
            )}
            <Button className="h-target-pdv" onClick={novoPedido}>
              Novo pedido
            </Button>
          </div>
        ) : etapa === 'cobrando' ? (
          <div className="flex flex-1 flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <span className="text-caption text-ink-muted">Cobrar</span>
              <span className="font-display text-display text-ink tabular-nums">
                {formatarPreco(total)}
              </span>
            </div>
            <ChoiceGrid
              label="Forma de pagamento"
              options={METODOS}
              value={metodo}
              onChange={(m) => {
                setMetodo(m);
                setErro('');
              }}
            />
            {metodo === 'dinheiro' && (
              <div className="flex flex-col gap-3">
                <TextField
                  label="Valor recebido"
                  inputMode="decimal"
                  placeholder="0,00"
                  autoFocus
                  value={recebido}
                  onChange={(e) => setRecebido(e.target.value)}
                  error={
                    recebidoCentavos !== null && recebidoCentavos < total
                      ? 'Valor menor que o total.'
                      : undefined
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setRecebido(String(total / 100).replace('.', ','))}
                  >
                    Valor exato
                  </Button>
                  {sugestoesDeNotas(total).map((nota) => (
                    <Button
                      key={nota}
                      variant="secondary"
                      onClick={() => setRecebido(String(nota / 100))}
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
                Confirmar pagamento
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
                  {carrinho.map((i) => (
                    <li key={i.productId} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-body-strong text-ink">{i.nome}</p>
                        <p className="text-caption text-ink-muted tabular-nums">
                          {formatarPreco(i.precoCentavos * i.quantidade)}
                        </p>
                      </div>
                      <QuantityStepper
                        value={i.quantidade}
                        itemName={i.nome}
                        onDecrement={() => setCarrinho((c) => removerUnidade(c, i.productId))}
                        onIncrement={() =>
                          setCarrinho((c) =>
                            adicionarItem(c, {
                              id: i.productId,
                              name: i.nome,
                              price_cents: i.precoCentavos,
                            }),
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-line bg-surface-strong p-5">
              <Switch checked={taxa} onChange={setTaxa} label="Taxa de serviço (10%)" showLabel />
              <div className="flex justify-between text-body text-ink-muted">
                <span>Subtotal · {itens === 1 ? '1 item' : `${itens} itens`}</span>
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
    </div>
  );
}
