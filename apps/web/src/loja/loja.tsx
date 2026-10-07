import { useAppContext } from '@usefood/app';
import {
  adicionarItem,
  DIAS_DA_SEMANA,
  formatarPreco,
  formatarTelefone,
  type ItemCarrinho,
  quantidadeDoProduto,
  quantidadeTotal,
  resumoDoHorario,
  rotuloDaCozinha,
  subtotalCentavos,
} from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import {
  carregarCardapio,
  MontarItem,
  urlDaFoto,
  type Cardapio,
  type ProdutoDoCardapio,
} from '@usefood/pedidos';
import { Button, CartList, Icon, Panel, ProductRow, Sheet, cn, type IconName } from '@usefood/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { gravarSacola, lerSacola } from '../guardado';
import { navegar } from '../rotas';
import { gravarFavoritos, lerFavoritos, voltaParaVitrine } from '../vitrine/vitrine-dados';
import { Checkout } from './checkout';
import { buscarLoja, whatsapp, type Horario, type LojaPublica } from './dados';
import { PedidoEmAndamento } from './pedido-em-andamento';

const hora = (t: string) => t.slice(0, 5);
const semAcento = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function textoDaEntrega(loja: LojaPublica): string {
  if (!loja.accepts_delivery) return 'Só retirada';
  if (loja.delivery_fee_mode === 'gratis') return 'Entrega grátis';
  if (loja.free_delivery_above_cents)
    return `Grátis acima de ${formatarPreco(loja.free_delivery_above_cents)}`;
  return loja.delivery_fee_mode === 'bairro' ? 'Taxa pelo bairro' : 'Taxa pela distância';
}

export function Loja({ slug, base }: { slug: string; base: string }) {
  const { supabase, brand } = useAppContext();
  const [estado, setEstado] = useState<
    | { tipo: 'carregando' }
    | { tipo: 'nao-encontrada' }
    | {
        tipo: 'pronta';
        loja: LojaPublica;
        horarios: Horario[];
        aberta: boolean;
        cardapio: Cardapio;
      }
  >({ tipo: 'carregando' });

  useEffect(() => {
    if (!supabase) return;
    let ativo = true;
    void (async () => {
      const achada = await buscarLoja(supabase, brand, slug).catch(() => null);
      if (!achada) {
        if (ativo) setEstado({ tipo: 'nao-encontrada' });
        return;
      }
      const cardapio = await carregarCardapio(supabase, achada.loja.id).catch(() => null);
      if (ativo)
        setEstado(cardapio ? { tipo: 'pronta', ...achada, cardapio } : { tipo: 'nao-encontrada' });
    })();
    return () => {
      ativo = false;
    };
  }, [supabase, brand, slug]);

  if (!supabase || estado.tipo === 'carregando') {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10 text-body text-ink-muted">Abrindo a loja…</main>
    );
  }
  if (estado.tipo === 'nao-encontrada') {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 px-5 py-16">
        <h1 className="font-display text-display text-ink">Loja não encontrada</h1>
        <p className="text-body text-ink-muted">
          Confira o endereço. Lojas em cadastro ou fora do ar não aparecem.
        </p>
      </main>
    );
  }
  return <PaginaDaLoja supabase={supabase} base={base} {...estado} />;
}

/** Página da loja: topo com informações, busca e abas fixas, destaques, produtos em lista e sacola. */
function PaginaDaLoja({
  supabase,
  base,
  loja,
  horarios,
  aberta,
  cardapio,
}: {
  supabase: AppSupabaseClient;
  base: string;
  loja: LojaPublica;
  horarios: Horario[];
  aberta: boolean;
  cardapio: Cardapio;
}) {
  const [volta] = useState(() => voltaParaVitrine());
  const [aba, setAba] = useState<'cardapio' | 'sobre'>('cardapio');
  const [favorita, setFavorita] = useState(() => lerFavoritos().includes(loja.slug));
  const [sacola, setSacola] = useState<ItemCarrinho[]>(() => lerSacola(loja.id));
  const [aberto, setAberto] = useState<ProdutoDoCardapio | null>(null);
  const [vendoSacola, setVendoSacola] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [busca, setBusca] = useState('');
  const [secaoAtiva, setSecaoAtiva] = useState<string | null>(null);
  const abas = useRef<HTMLDivElement>(null);

  useEffect(() => gravarSacola(loja.id, sacola), [loja.id, sacola]);

  const foto = (caminho: string | null) => urlDaFoto(supabase, caminho);
  const itens = quantidadeTotal(sacola);
  const subtotal = subtotalCentavos(sacola);
  const categorias = cardapio.categorias.filter((c) =>
    cardapio.produtos.some((p) => p.category_id === c.id),
  );
  // Destaques: os marcados como destaque; sem nenhum marcado, os que têm foto
  const marcados = cardapio.produtos.filter((p) => p.is_featured);
  const destaques = (
    marcados.length ? marcados : cardapio.produtos.filter((p) => p.photo_path)
  ).slice(0, 8);
  const horario = resumoDoHorario(horarios, aberta, new Date());

  const encontrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    if (!termo) return null;
    return cardapio.produtos.filter((p) =>
      semAcento(`${p.name} ${p.description ?? ''}`).includes(termo),
    );
  }, [busca, cardapio.produtos]);

  // A aba acompanha a seção que está na tela
  useEffect(() => {
    if (encontrados) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((e) => e.isIntersecting);
        if (visivel) setSecaoAtiva(visivel.target.id.replace('cat-', ''));
      },
      { rootMargin: '-140px 0px -65% 0px' },
    );
    categorias.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) observador.observe(el);
    });
    return () => observador.disconnect();
  }, [categorias, encontrados]);

  useEffect(() => {
    const aba = abas.current?.querySelector<HTMLElement>(`[data-aba="${secaoAtiva}"]`);
    if (aba && abas.current)
      abas.current.scrollTo({ left: aba.offsetLeft - 20, behavior: 'smooth' });
  }, [secaoAtiva]);

  const preco = (p: ProdutoDoCardapio) => {
    const tamanhos = cardapio.opcoes.get(p.id)?.tamanhos ?? [];
    const menor = tamanhos.length
      ? Math.min(...tamanhos.map((t) => t.precoCentavos))
      : p.price_cents;
    return tamanhos.length > 1 ? `a partir de ${formatarPreco(menor)}` : formatarPreco(menor);
  };
  const linha = (p: ProdutoDoCardapio) => (
    <li key={p.id}>
      <ProductRow
        name={p.name}
        description={
          p.combo_texto ? [p.combo_texto, p.description].filter(Boolean).join(' · ') : p.description
        }
        priceLabel={preco(p)}
        originalPriceLabel={
          p.preco_original_cents ? formatarPreco(p.preco_original_cents) : undefined
        }
        badge={
          p.preco_original_cents
            ? `-${Math.round(((p.preco_original_cents - p.price_cents) / p.preco_original_cents) * 100)}%`
            : p.is_featured
              ? 'Destaque'
              : p.is_combo
                ? 'Combo'
                : undefined
        }
        imageUrl={foto(p.photo_path)}
        quantity={quantidadeDoProduto(sacola, p.id)}
        onClick={() => setAberto(p)}
      />
    </li>
  );
  const continuar = () => {
    setVendoSacola(false);
    setFechando(true);
    window.scrollTo(0, 0);
  };

  if (fechando) {
    return (
      <Checkout
        supabase={supabase}
        loja={loja}
        aberta={aberta}
        itens={sacola}
        onVoltar={() => setFechando(false)}
        onFeito={(token) => {
          setSacola([]);
          gravarSacola(loja.id, []);
          navegar(`${base}/pedido/${token}`);
        }}
      />
    );
  }

  const sobre = (
    <div className="flex flex-col gap-5">
      {loja.description && <p className="text-body text-ink">{loja.description}</p>}
      <section className="flex flex-col gap-1">
        <h3 className="text-label text-ink-muted">Endereço</h3>
        <p className="text-body text-ink">
          {loja.street}, {loja.street_number} · {loja.district}
          {loja.city ? ` · ${loja.city}` : ''}
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-label text-ink-muted">Horários</h3>
        <ul className="flex flex-col gap-1">
          {DIAS_DA_SEMANA.map((dia, n) => {
            const doDia = horarios.filter((h) => h.weekday === n);
            const hoje = n === new Date().getDay();
            return (
              <li
                key={dia}
                className={cn(
                  'flex justify-between gap-3 text-body',
                  hoje ? 'text-body-strong text-ink' : 'text-ink',
                )}
              >
                <span>
                  {dia}
                  {hoje ? ' (hoje)' : ''}
                </span>
                <span className={doDia.length ? '' : 'text-ink-muted'}>
                  {doDia.length
                    ? doDia.map((h) => `${hora(h.opens)}–${hora(h.closes)}`).join(', ')
                    : 'Fechado'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="text-label text-ink-muted">Entrega</h3>
        <p className="text-body text-ink">
          {textoDaEntrega(loja)} · {loja.prep_minutes_min}–{loja.prep_minutes_max} min
          {loja.accepts_pickup ? ' · Também dá para retirar na loja' : ''}
        </p>
        <p className="text-body text-ink">
          {loja.min_order_cents
            ? `Pedido mínimo ${formatarPreco(loja.min_order_cents)}`
            : 'Sem pedido mínimo'}
        </p>
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="text-label text-ink-muted">Pagamento</h3>
        <p className="text-body text-ink">
          Na entrega ou na retirada: dinheiro, Pix, crédito e débito.
        </p>
      </section>
      {loja.phone && (
        <a
          href={whatsapp(loja.phone, `Oi, ${loja.name}! Vim pela loja online.`)}
          target="_blank"
          rel="noreferrer"
        >
          <Button className="h-target-pdv w-full">
            Falar com a loja · {formatarTelefone(loja.phone)}
          </Button>
        </a>
      )}
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col pb-28 lg:px-8 lg:pb-12">
      {loja.status !== 'ativo' && (
        // Só a equipe enxerga loja fora do ar (está logada); o cliente vê "Loja não encontrada"
        <p role="status" className="bg-sun px-5 py-3 text-body text-sun-ink lg:mt-4 lg:rounded-md">
          <strong>Prévia:</strong> só você está vendo. Para os clientes acessarem, publique a loja
          em Loja online no painel.
        </p>
      )}

      <div className="relative aspect-[4/3] max-h-[22rem] w-full overflow-hidden bg-surface-strong lg:mt-4 lg:aspect-[4/1] lg:rounded-lg">
        {loja.cover_path && (
          <img src={foto(loja.cover_path)!} alt="" className="size-full object-cover" />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgb(0_0_0/0.45),transparent)]"
        />
        <div className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between">
          {volta ? (
            <BotaoSobreFoto
              rotulo="Voltar para os restaurantes"
              icone="voltar"
              onClick={() => navegar(volta)}
            />
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <BotaoSobreFoto
              rotulo={favorita ? 'Tirar dos favoritos' : 'Favoritar'}
              icone="coracao"
              ativo={favorita}
              onClick={() => {
                const nova = favorita
                  ? lerFavoritos().filter((x) => x !== loja.slug)
                  : [...lerFavoritos(), loja.slug];
                gravarFavoritos(nova);
                setFavorita(!favorita);
              }}
            />
            {typeof navigator.share === 'function' && (
              <BotaoSobreFoto
                rotulo="Compartilhar a loja"
                icone="compartilhar"
                onClick={() =>
                  void navigator
                    .share({ title: loja.name, url: window.location.href })
                    .catch(() => undefined)
                }
              />
            )}
            <BotaoSobreFoto
              rotulo="Minha conta"
              icone="perfil"
              onClick={() => navegar(volta ? '/delivery/conta' : `${base}/conta`)}
            />
          </div>
        </div>
      </div>

      <header className="relative z-10 -mt-7 flex flex-col gap-4 rounded-t-[1.75rem] bg-canvas px-5 pt-5 lg:mt-5 lg:rounded-none lg:px-0 lg:pt-0">
        <div className="flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
            {loja.logo_path ? (
              <img
                src={foto(loja.logo_path)!}
                alt={`Logo ${loja.name}`}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-title-section font-black text-ink-muted">
                {loja.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-[1.75rem] leading-[1.1] font-black tracking-[-0.03em] text-ink">
              {loja.name}
            </h1>
            <p className="text-caption text-ink-muted">
              {[
                (loja.cuisines ?? []).map(rotuloDaCozinha).join(', '),
                `${loja.prep_minutes_min}–${loja.prep_minutes_max} min`,
                textoDaEntrega(loja),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p
              className={cn(
                'flex items-center gap-1.5 text-caption font-bold',
                aberta ? 'text-success' : 'text-ink-muted',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('size-2 rounded-pill', aberta ? 'bg-success' : 'bg-line-strong')}
              />
              {horario.titulo} · {horario.detalhe}
            </p>
          </div>
        </div>

        <div role="tablist" aria-label="Loja" className="flex border-b border-line">
          {(['cardapio', 'sobre'] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={aba === a}
              onClick={() => setAba(a)}
              className={cn(
                '-mb-px flex-1 border-b-2 pb-3 text-label font-bold transition',
                aba === a ? 'border-brand text-brand-text' : 'border-transparent text-ink-muted',
              )}
            >
              {a === 'cardapio' ? 'Cardápio' : 'Sobre'}
            </button>
          ))}
        </div>
        <PedidoEmAndamento lojaSlug={loja.slug} base={base} />
      </header>

      {aba === 'sobre' && <div className="px-5 pt-5 pb-10 lg:px-0">{sobre}</div>}
      <div
        className={cn(
          'lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8',
          aba !== 'cardapio' && 'hidden',
        )}
      >
        <div className="min-w-0">
          <div className="sticky top-0 z-20 mt-1 flex flex-col gap-3 bg-canvas px-5 pt-3 lg:mt-0 lg:px-0">
            <label className="relative block">
              <span className="sr-only">Buscar no cardápio</span>
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted">
                <Icon name="busca" size={20} />
              </span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar no cardápio"
                className="h-11 w-full rounded-pill border border-line bg-surface pr-4 pl-12 text-body text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-brand"
              />
            </label>
            {!encontrados && (
              <div
                ref={abas}
                role="tablist"
                aria-label="Categorias"
                className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none]"
              >
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    data-aba={c.id}
                    aria-selected={secaoAtiva === c.id}
                    onClick={() =>
                      document
                        .getElementById(`cat-${c.id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className={cn(
                      'h-9 shrink-0 rounded-pill px-4 text-label font-bold whitespace-nowrap transition',
                      secaoAtiva === c.id
                        ? 'bg-brand text-brand-ink'
                        : 'border border-line bg-surface text-ink',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-8 px-5 pt-5 lg:px-0">
            {encontrados ? (
              <section aria-label="Resultado da busca" className="flex flex-col">
                <h2 className="text-label text-ink-muted">
                  {encontrados.length
                    ? `${encontrados.length} encontrado${encontrados.length > 1 ? 's' : ''}`
                    : 'Nada encontrado com esse nome.'}
                </h2>
                <ul className="flex flex-col divide-y divide-line">{encontrados.map(linha)}</ul>
              </section>
            ) : (
              <>
                {destaques.length > 2 && (
                  <section aria-labelledby="t-destaques" className="flex flex-col gap-3">
                    <h2 id="t-destaques" className="font-display text-title-section text-ink">
                      Destaques
                    </h2>
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {destaques.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => setAberto(p)}
                            className="relative flex w-full flex-col overflow-hidden rounded-lg bg-surface text-left active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <span className="relative block aspect-[4/3] w-full bg-surface-strong">
                              <img
                                src={foto(p.photo_path)!}
                                alt=""
                                loading="lazy"
                                className="absolute inset-0 size-full object-cover"
                              />
                            </span>
                            <span className="flex flex-col gap-1 p-3 pr-12">
                              <span className="line-clamp-2 text-label font-bold text-ink">
                                {p.name}
                              </span>
                              <span className="flex flex-wrap items-baseline gap-x-1.5">
                                <span
                                  className={cn(
                                    'text-label font-bold tabular-nums',
                                    p.preco_original_cents ? 'text-brand-text' : 'text-ink',
                                  )}
                                >
                                  {preco(p)}
                                </span>
                                {p.preco_original_cents && (
                                  <s className="text-micro text-ink-muted tabular-nums">
                                    {formatarPreco(p.preco_original_cents)}
                                  </s>
                                )}
                              </span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-pill bg-brand text-brand-ink"
                            >
                              <Icon name="mais" size={18} />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {categorias.map((c) => (
                  <section
                    key={c.id}
                    id={`cat-${c.id}`}
                    aria-labelledby={`t-${c.id}`}
                    className="flex scroll-mt-36 flex-col"
                  >
                    <h2 id={`t-${c.id}`} className="font-display text-title-section text-ink">
                      {c.name}
                    </h2>
                    <ul className="flex flex-col divide-y divide-line">
                      {cardapio.produtos.filter((p) => p.category_id === c.id).map(linha)}
                    </ul>
                  </section>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Computador: sacola sempre à vista */}
        <aside className="sticky top-4 hidden lg:block">
          <Panel title="Sua sacola">
            <CartList
              items={sacola}
              onChange={setSacola}
              viagem="nenhum"
              imageFor={(id) =>
                foto(cardapio.produtos.find((p) => p.id === id)?.photo_path ?? null)
              }
              emptyText="Sua sacola está vazia. Escolha um produto do cardápio."
            />
            {sacola.length > 0 && (
              <Button className="h-target-pdv w-full" onClick={continuar}>
                Continuar · {formatarPreco(subtotal)}
              </Button>
            )}
          </Panel>
        </aside>
      </div>

      {itens > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
          <button
            type="button"
            onClick={() => setVendoSacola(true)}
            className="flex h-14 w-full items-center justify-between gap-3 rounded-pill bg-brand px-3 pr-5 text-body font-bold text-brand-ink shadow-[0_8px_24px_rgb(0_0_0/0.18)] active:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex size-9 items-center justify-center rounded-pill bg-[rgb(255_255_255/0.22)] tabular-nums">
              {itens}
            </span>
            <span>Ver carrinho</span>
            <span className="tabular-nums">{formatarPreco(subtotal)}</span>
          </button>
        </div>
      )}

      {vendoSacola && (
        <Sheet
          open
          onClose={() => setVendoSacola(false)}
          title="Meu carrinho"
          footer={
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between text-body">
                <span className="text-ink-muted">Subtotal</span>
                <span className="text-title-section font-black text-ink tabular-nums">
                  {formatarPreco(subtotal)}
                </span>
              </div>
              <p className="text-caption text-ink-muted">
                A taxa de entrega aparece no próximo passo, com o seu endereço.
              </p>
              <Button
                className="h-target-pdv w-full"
                disabled={sacola.length === 0}
                onClick={continuar}
              >
                Finalizar pedido
              </Button>
            </div>
          }
        >
          <CartList
            items={sacola}
            onChange={setSacola}
            viagem="nenhum"
            imageFor={(id) => foto(cardapio.produtos.find((p) => p.id === id)?.photo_path ?? null)}
            emptyText="Seu carrinho está vazio."
          />
        </Sheet>
      )}

      {aberto && (
        <MontarItem
          produto={aberto}
          tamanhos={cardapio.opcoes.get(aberto.id)?.tamanhos ?? []}
          grupos={cardapio.opcoes.get(aberto.id)?.grupos ?? []}
          fotoUrl={foto(aberto.photo_path)}
          rotuloDoBotao="Adicionar ao carrinho"
          onFechar={() => setAberto(null)}
          onAdicionar={(item) => {
            setSacola((s) => adicionarItem(s, item));
            setAberto(null);
          }}
        />
      )}
    </main>
  );
}

/** Botão redondo sobre a capa da loja (voltar, favoritar, compartilhar, conta). */
function BotaoSobreFoto({
  rotulo,
  icone,
  onClick,
  ativo = false,
}: {
  rotulo: string;
  icone: IconName;
  onClick: () => void;
  ativo?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-pressed={icone === 'coracao' ? ativo : undefined}
      onClick={onClick}
      className={cn(
        'flex size-11 items-center justify-center rounded-pill bg-[rgb(255_255_255/0.92)] shadow-md backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        ativo ? 'text-brand-text' : 'text-[#141414]',
      )}
    >
      {icone === 'coracao' ? (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={ativo ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      ) : (
        <Icon name={icone} size={22} />
      )}
    </button>
  );
}
