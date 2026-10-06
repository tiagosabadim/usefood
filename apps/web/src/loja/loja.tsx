import { useAppContext } from '@usefood/app';
import {
  adicionarItem,
  DIAS_DA_SEMANA,
  formatarPreco,
  formatarTelefone,
  quantidadeDoProduto,
  quantidadeTotal,
  resumoDoHorario,
  subtotalCentavos,
  type ItemCarrinho,
} from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import {
  carregarCardapio,
  MontarItem,
  urlDaFoto,
  type Cardapio,
  type ProdutoDoCardapio,
} from '@usefood/pedidos';
import {
  Button,
  CartList,
  Icon,
  Panel,
  ProductRow,
  Sheet,
  TextField,
  cn,
  type IconName,
} from '@usefood/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { gravarSacola, lerSacola } from '../guardado';
import { navegar } from '../rotas';
import { voltaParaVitrine } from '../vitrine/vitrine-dados';
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
  const [sacola, setSacola] = useState<ItemCarrinho[]>(() => lerSacola(loja.id));
  const [aberto, setAberto] = useState<ProdutoDoCardapio | null>(null);
  const [vendoSacola, setVendoSacola] = useState(false);
  const [vendoPerfil, setVendoPerfil] = useState(false);
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
  const destaques = cardapio.produtos.filter((p) => p.photo_path).slice(0, 8);
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
        description={p.description}
        priceLabel={preco(p)}
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

  const informacoes: { icone: IconName; texto: string; destaque?: boolean }[] = [
    { icone: 'calendario', texto: `${horario.titulo} · ${horario.detalhe}`, destaque: aberta },
    { icone: 'relogio', texto: `${loja.prep_minutes_min}–${loja.prep_minutes_max} min` },
    { icone: 'moto', texto: textoDaEntrega(loja) },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col pb-28 lg:px-8 lg:pb-12">
      {volta && (
        <nav aria-label="Voltar" className="px-4 pt-3 lg:px-0">
          <button
            type="button"
            onClick={() => navegar(volta)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-label font-bold text-ink focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Icon name="voltar" size={20} /> Restaurantes
          </button>
        </nav>
      )}
      {loja.status !== 'ativo' && (
        // Só a equipe enxerga loja fora do ar (está logada); o cliente vê "Loja não encontrada"
        <p role="status" className="bg-sun px-5 py-3 text-body text-sun-ink lg:mt-4 lg:rounded-md">
          <strong>Prévia:</strong> só você está vendo. Para os clientes acessarem, publique a loja
          em Loja online no painel.
        </p>
      )}

      <div className="relative aspect-[2/1] w-full overflow-hidden bg-surface-strong lg:mt-4 lg:aspect-[4/1] lg:rounded-lg">
        {loja.cover_path && (
          <img src={foto(loja.cover_path)!} alt="" className="size-full object-cover" />
        )}
        <button
          type="button"
          aria-label="Minha conta"
          onClick={() => navegar(`${base}/conta`)}
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-pill bg-canvas text-ink shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Icon name="perfil" size={22} />
        </button>
      </div>

      <header className="flex flex-col gap-4 px-5 lg:px-0">
        <div className="flex items-end gap-4">
          <div className="relative z-10 -mt-10 flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-pill border-4 border-canvas bg-surface-strong">
            {loja.logo_path ? (
              <img
                src={foto(loja.logo_path)!}
                alt={`Logo ${loja.name}`}
                className="size-full object-cover"
              />
            ) : (
              <span className="font-display text-title-section text-ink-muted">
                {loja.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col pb-1">
            <h1 className="font-display text-title-screen text-ink">{loja.name}</h1>
            <button
              type="button"
              className="self-start text-label text-brand-text"
              onClick={() => setVendoPerfil(true)}
            >
              Ver mais sobre a loja
            </button>
          </div>
        </div>
        {loja.description && <p className="text-body text-ink-muted">{loja.description}</p>}

        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {informacoes.map((i) => (
              <li
                key={i.icone}
                className={cn(
                  'flex items-center gap-2 text-label',
                  i.destaque ? 'text-success' : 'text-ink',
                )}
              >
                <Icon name={i.icone} size={18} />
                {i.texto}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-caption text-ink-muted">
              {loja.min_order_cents
                ? `Pedido mínimo ${formatarPreco(loja.min_order_cents)}`
                : 'Sem pedido mínimo'}
            </span>
            {loja.phone && (
              <a
                href={whatsapp(loja.phone, `Oi, ${loja.name}! Vim pela loja online.`)}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="secondary" className="h-10">
                  <Icon name="conversa" size={18} /> Falar com a loja
                </Button>
              </a>
            )}
          </div>
        </div>
        <PedidoEmAndamento lojaSlug={loja.slug} base={base} />
      </header>

      <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="sticky top-0 z-20 mt-5 flex flex-col gap-3 border-b border-line bg-canvas px-5 pt-3 lg:mt-0 lg:px-0">
            <TextField
              label="Buscar no cardápio"
              placeholder="Buscar no cardápio"
              className="[&>label]:sr-only"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {!encontrados && (
              <div
                ref={abas}
                role="tablist"
                aria-label="Categorias"
                className="-mb-px flex gap-1 overflow-x-auto"
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
                      'shrink-0 border-b-2 px-3 pb-3 text-label whitespace-nowrap transition',
                      secaoAtiva === c.id
                        ? 'border-brand text-brand-text'
                        : 'border-transparent text-ink-muted hover:text-ink',
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
                    <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
                      {destaques.map((p) => (
                        <li key={p.id} className="w-40 shrink-0">
                          <button
                            type="button"
                            onClick={() => setAberto(p)}
                            className="flex w-full flex-col gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-strong">
                              <img
                                src={foto(p.photo_path)!}
                                alt=""
                                loading="lazy"
                                className="absolute inset-0 size-full object-cover"
                              />
                            </span>
                            <span className="line-clamp-2 text-label text-ink">{p.name}</span>
                            <span className="text-body-strong text-ink tabular-nums">
                              {preco(p)}
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
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
          <Button className="h-target-pdv w-full" onClick={() => setVendoSacola(true)}>
            Ver sacola · {itens === 1 ? '1 item' : `${itens} itens`} · {formatarPreco(subtotal)}
          </Button>
        </div>
      )}

      {vendoSacola && (
        <Sheet
          open
          onClose={() => setVendoSacola(false)}
          title="Sua sacola"
          footer={
            <Button
              className="h-target-pdv w-full"
              disabled={sacola.length === 0}
              onClick={continuar}
            >
              Continuar · {formatarPreco(subtotal)}
            </Button>
          }
        >
          <CartList
            items={sacola}
            onChange={setSacola}
            viagem="nenhum"
            imageFor={(id) => foto(cardapio.produtos.find((p) => p.id === id)?.photo_path ?? null)}
            emptyText="Sua sacola está vazia."
          />
        </Sheet>
      )}

      {vendoPerfil && (
        <Sheet open onClose={() => setVendoPerfil(false)} title={loja.name}>
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
        </Sheet>
      )}

      {aberto && (
        <MontarItem
          produto={aberto}
          tamanhos={cardapio.opcoes.get(aberto.id)?.tamanhos ?? []}
          grupos={cardapio.opcoes.get(aberto.id)?.grupos ?? []}
          fotoUrl={foto(aberto.photo_path)}
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
