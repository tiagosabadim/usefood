import {
  adicionarItem,
  formatarPreco,
  itemSimples,
  quantidadeDoProduto,
  quantidadeTotal,
  DADOS_INICIAIS,
  parametrosDoPedido,
  rotuloDaConta,
  subtotalCentavos,
  type DadosDoPedido,
  type ItemCarrinho,
  type NovoItem,
} from '@usefood/core';
import type { AppSupabaseClient, Enums, Tables } from '@usefood/db';
import {
  Alert,
  Button,
  CartList,
  cn,
  Icon,
  ProductTile,
  SegmentedControl,
  TextField,
} from '@usefood/ui';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Cobranca, ContaPaga, type Conta, type PagamentoFeito } from './cobranca';
import { ContasAbertas } from './contas-abertas';
import {
  carregarCardapio,
  MontarItem,
  type OpcoesDoProduto,
  Salao,
  SEM_OPCOES,
  TipoEIdentificacao,
  urlDaFoto,
  useAtendimento,
} from '@usefood/pedidos';

type Categoria = Pick<Tables<'categories'>, 'id' | 'name'>;
type Produto = Pick<
  Tables<'products'>,
  'id' | 'category_id' | 'name' | 'price_cents' | 'photo_path'
>;
type TipoPedido = Enums<'order_type'>;
type Opcoes = OpcoesDoProduto;
type Painel =
  | { tela: 'pedido' }
  | { tela: 'contas'; abrir?: string }
  | { tela: 'cobrando'; conta: Conta; pedidoId: string | null }
  | { tela: 'paga'; conta: Conta; pagamentos: PagamentoFeito[]; pedidoId: string | null };

const ERROS_CONHECIDOS = new Set(['P0001', 'P0002', '22023', '42501']);
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
  const [dados, setDados] = useState<DadosDoPedido>(DADOS_INICIAIS);
  const tipo = dados.tipo;
  const atendimento = useAtendimento(supabase, loja.id);
  const [modo, setModo] = useState<'cardapio' | 'salao'>(modoInicial);

  const [painel, setPainel] = useState<Painel>({ tela: 'pedido' });
  const [contasAbertas, setContasAbertas] = useState(0);
  const [enviando, setEnviando] = useState<'cozinha' | 'cobrar' | null>(null);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState('');

  useEffect(() => {
    let ativo = true;
    carregarCardapio(supabase, loja.id)
      .then((c) => {
        if (!ativo) return;
        setCategorias(c.categorias);
        setProdutos(c.produtos);
        setOpcoes(c.opcoes);
        setCategoriaAtual(c.categorias[0]?.id ?? null);
        setCarregando(false);
      })
      .catch(() => {
        if (!ativo) return;
        setFalhou(true);
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
  const parametros = parametrosDoPedido(dados, atendimento);
  const identificacaoFalta = !parametros.ok;
  const montandoPedido = painel.tela === 'pedido';

  function tocarProduto(p: Produto) {
    const o = opcoes.get(p.id) ?? SEM_OPCOES;
    if (o.tamanhos.length > 0 || o.grupos.length > 0) setMontando(p);
    else setCarrinho((c) => adicionarItem(c, itemSimples(p)));
  }

  function escolherTipo(novo: TipoPedido, identificador = '') {
    setDados({ ...DADOS_INICIAIS, tipo: novo, identificador });
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
    if (!parametros.ok) return;
    setEnviando(destino);
    const identificacao = parametros.p_identificador_tipo;
    const { data, error } = await supabase.rpc('criar_pedido', {
      p_restaurant_id: loja.id,
      p_tipo: parametros.p_tipo,
      p_identificador_tipo: identificacao,
      p_identificador: parametros.p_identificador,
      p_itens: carrinho.map((i) => ({
        product_id: i.productId,
        quantidade: i.quantidade,
        variant_id: i.tamanhoId,
        adicionais: i.adicionais.map((a) => a.id),
        observacao: i.observacao || null,
        para_viagem: i.paraViagem,
      })),
      p_pagamento_previsto: parametros.p_pagamento_previsto,
      p_troco_para_cents: parametros.p_troco_para_cents,
      p_celular: parametros.p_celular,
      p_endereco: parametros.p_endereco,
      p_taxa_entrega_cents: parametros.p_taxa_entrega_cents,
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
              escolherTipo('mesa', label);
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
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
        className="flex flex-col border-t border-line bg-surface lg:overflow-y-auto lg:border-t-0 lg:border-l"
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
              escolherTipo('mesa', mesa);
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
              <TipoEIdentificacao
                dados={dados}
                onChange={setDados}
                atendimento={atendimento}
                entrega={{ supabase, lojaId: loja.id, subtotalCentavos: subtotal }}
              />
            </div>

            <div className="flex flex-1 flex-col px-5 lg:overflow-y-auto">
              <Alert tone="sucesso" className="mt-4">
                {enviado}
              </Alert>
              <CartList
                items={carrinho}
                onChange={setCarrinho}
                viagem={tipo === 'retirada' || tipo === 'delivery' ? 'sempre' : 'escolher'}
                imageFor={fotoDoProduto}
              />
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
                    {!parametros.ok && parametros.motivo}
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
