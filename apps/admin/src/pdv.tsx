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
import { canalUnico, type AppSupabaseClient, type Enums, type Tables } from '@usefood/db';
import {
  Alert,
  Button,
  CartList,
  Chip,
  cn,
  Icon,
  type IconName,
  ProductTile,
  SegmentedControl,
  TextField,
} from '@usefood/ui';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cobranca, ContaPaga, type Conta, type PagamentoFeito } from './cobranca';
import { ContasAbertas } from './contas-abertas';
import { TelaDaCozinha } from './cozinha';
import { tocarAviso } from './tela-escura';
import { PedidosOnline } from './pedidos-online';
import {
  agruparPorSecao,
  carregarCardapio,
  ListaDeEntregas,
  MontarItem,
  type OpcoesDoProduto,
  produtosDaSecao,
  Salao,
  type SecaoDoCardapio,
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
  euId,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
  /** Situação do caixa e o botão que abre o painel do caixa. */
  cabecalhoDoCaixa?: ReactNode;
  /** Avisos de impressão, no topo da área de produtos. */
  avisos?: ReactNode;
  /** Abrir mostrando o cardápio ou as mesas. */
  modoInicial?: 'cardapio' | 'salao';
  /** Quem está usando (para despachar entregas). */
  euId: string;
}) {
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [opcoes, setOpcoes] = useState<Map<string, Opcoes>>(new Map());
  const [categoriaAtual, setCategoriaAtual] = useState<string | null>(null);
  const [secoes, setSecoes] = useState<SecaoDoCardapio[]>([]);
  const [busca, setBusca] = useState('');
  const [montando, setMontando] = useState<Produto | null>(null);

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [dados, setDados] = useState<DadosDoPedido>(DADOS_INICIAIS);
  const tipo = dados.tipo;
  const atendimento = useAtendimento(supabase, loja.id);
  const [modo, setModo] = useState<'cardapio' | 'salao' | 'entregas' | 'online' | 'cozinha'>(
    modoInicial,
  );
  const [emPreparo, setEmPreparo] = useState(0);
  // Aviso quando o entregador dá baixa (em qualquer tela do menu rápido)
  const [entregue, setEntregue] = useState<{ numero: number; nome: string } | null>(null);
  const [abaDasEntregas, setAbaDasEntregas] = useState<'prontos' | 'entregues'>('prontos');
  const entreguesConhecidos = useRef<Set<string> | null>(null);
  const somDoAviso = useRef<AudioContext | null>(null);
  useEffect(() => {
    const liberar = () => {
      somDoAviso.current ??= new AudioContext();
    };
    window.addEventListener('pointerdown', liberar, { once: true });
    return () => window.removeEventListener('pointerdown', liberar);
  }, []);
  useEffect(() => {
    if (!entregue) return;
    const t = setTimeout(() => setEntregue(null), 10_000);
    return () => clearTimeout(t);
  }, [entregue]);
  const [esperandoOnline, setEsperandoOnline] = useState(0);
  const [entregasProntas, setEntregasProntas] = useState(0);

  // Contadores do menu rápido: pedidos online esperando e entregas prontas para sair
  useEffect(() => {
    let ativo = true;
    const contar = async () => {
      const [online, entregas, preparo, concluidas] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', loja.id)
          .eq('status', 'aguardando'),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', loja.id)
          .eq('type', 'delivery')
          .eq('status', 'pronto')
          .gte('created_at', new Date(Date.now() - 12 * 3_600_000).toISOString()),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', loja.id)
          .eq('status', 'em_preparo')
          .gte('created_at', new Date(Date.now() - 12 * 3_600_000).toISOString()),
        supabase
          .from('orders')
          .select('id, number, identifier')
          .eq('restaurant_id', loja.id)
          .eq('type', 'delivery')
          .eq('status', 'concluido')
          .gte('delivered_at', new Date(Date.now() - 12 * 3_600_000).toISOString())
          .limit(200),
      ]);
      if (!ativo) return;
      setEsperandoOnline(online.count ?? 0);
      setEntregasProntas(entregas.count ?? 0);
      setEmPreparo(preparo.count ?? 0);
      const lista = concluidas.data ?? [];
      if (entreguesConhecidos.current) {
        const novo = lista.find((o) => !entreguesConhecidos.current!.has(o.id));
        if (novo) {
          setEntregue({ numero: novo.number, nome: novo.identifier });
          if (somDoAviso.current) tocarAviso(somDoAviso.current);
        }
      }
      entreguesConhecidos.current = new Set(lista.map((o) => o.id));
    };
    void contar();
    const canal = canalUnico(supabase, `pdv-menu-${loja.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${loja.id}` },
        () => {
          void contar();
        },
      )
      .subscribe();
    const t = setInterval(() => void contar(), 20_000);
    return () => {
      ativo = false;
      clearInterval(t);
      void supabase.removeChannel(canal);
    };
  }, [supabase, loja.id]);

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
        // Chips só das categorias principais; as subcategorias entram dentro delas
        const secoesDoCardapio = agruparPorSecao(c.categorias, c.produtos);
        setSecoes(secoesDoCardapio);
        setCategorias(secoesDoCardapio.map((s) => s.categoria));
        setProdutos(c.produtos);
        setOpcoes(c.opcoes);
        setCategoriaAtual(secoesDoCardapio[0]?.categoria.id ?? null);
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
    const secao = secoes.find((s) => s.categoria.id === categoriaAtual);
    return secao ? produtosDaSecao(secao) : [];
  }, [produtos, secoes, categoriaAtual, busca]);

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
        aria-label="Menu rápido"
        className="flex gap-1 overflow-x-auto bg-brand p-2 lg:flex-col lg:gap-2 lg:overflow-y-auto lg:p-3"
      >
        {(
          [
            { id: 'voltar', rotulo: 'Painel', icone: 'voltar', onClick: onVoltar },
            { id: 'cardapio', rotulo: 'Vender', icone: 'pdv', onClick: () => setModo('cardapio') },
            { id: 'salao', rotulo: 'Mesas', icone: 'mesa', onClick: () => setModo('salao') },
            {
              id: 'entregas',
              rotulo: 'Entregas',
              icone: 'moto',
              onClick: () => {
                setAbaDasEntregas('prontos');
                setModo('entregas');
              },
              contador: entregasProntas,
            },
            {
              id: 'online',
              rotulo: 'Online',
              icone: 'loja',
              onClick: () => setModo('online'),
              contador: esperandoOnline,
            },
            {
              id: 'cozinha',
              rotulo: 'Cozinha',
              icone: 'cozinha',
              onClick: () => setModo('cozinha'),
              contador: emPreparo,
            },
          ] as {
            id: string;
            rotulo: string;
            icone: IconName;
            onClick: () => void;
            contador?: number;
          }[]
        ).map((item) => {
          const ativo = item.id === modo;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-current={ativo ? 'page' : undefined}
              aria-label={
                item.contador ? `${item.rotulo}: ${item.contador} esperando` : item.rotulo
              }
              className={cn(
                'relative flex min-h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-md px-2 text-micro lg:min-h-18',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas',
                ativo ? 'bg-canvas text-brand-text' : 'text-brand-ink hover:bg-canvas/15',
                item.id === 'voltar' && 'lg:mb-2',
              )}
            >
              <Icon name={item.icone} size={22} />
              {item.rotulo}
              {item.contador ? (
                <span className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-pill bg-sun px-1 text-micro text-sun-ink">
                  {item.contador}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <main className="flex min-w-0 flex-col gap-5 p-5 lg:overflow-y-auto lg:p-6">
        {entregue && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-md bg-success-soft px-4 py-3 text-success"
          >
            <span className="text-body-strong">
              Entregue: pedido #{String(entregue.numero).padStart(3, '0')} · {entregue.nome}
            </span>
            <Button
              variant="ghost"
              className="h-9"
              onClick={() => {
                setEntregue(null);
                setAbaDasEntregas('entregues');
                setModo('entregas');
              }}
            >
              Ver
            </Button>
          </div>
        )}
        {avisos}
        {modo === 'entregas' && (
          <section aria-label="Entregas" className="flex flex-col gap-4">
            <h1 className="font-display text-title-screen text-ink">Entregas</h1>
            <ListaDeEntregas
              key={abaDasEntregas}
              supabase={supabase}
              lojaId={loja.id}
              euId={euId}
              modo="loja"
              abaInicial={abaDasEntregas}
            />
          </section>
        )}
        {modo === 'cozinha' && <TelaDaCozinha supabase={supabase} loja={loja} encaixada />}
        {modo === 'online' && (
          <section aria-label="Pedidos online" className="flex flex-col gap-4">
            <h1 className="font-display text-title-screen text-ink">Pedidos online</h1>
            {esperandoOnline === 0 && (
              <p className="text-body text-ink-muted">Nenhum pedido online esperando agora.</p>
            )}
            <PedidosOnline supabase={supabase} lojaId={loja.id} emLinha />
          </section>
        )}
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
            modo !== 'cardapio' && 'hidden',
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

        {modo === 'cardapio' && !busca && (
          <div
            role="group"
            aria-label="Categorias"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {categorias.map((c) => (
              <Chip
                key={c.id}
                selected={c.id === categoriaAtual}
                onClick={() => {
                  setCategoriaAtual(c.id);
                  setBusca('');
                }}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        )}

        {modo !== 'cardapio' ? null : visiveis.length === 0 ? (
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
