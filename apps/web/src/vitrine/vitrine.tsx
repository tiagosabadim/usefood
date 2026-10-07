import { useAppContext } from '@usefood/app';
import { COZINHAS, formatarPreco, rotuloDaCozinha } from '@usefood/core';
import { urlDaFoto } from '@usefood/pedidos';
import { Alert, Icon, StoreCard, cn, type IconName } from '@usefood/ui';
import { useEffect, useMemo, useState } from 'react';
import { lerConta } from '../guardado';
import { PedidoEmAndamento } from '../loja/pedido-em-andamento';
import { navegar } from '../rotas';
import { BarraDoApp, useInstalar } from './barra';
import { CartaoDeOferta, type Oferta } from './ofertas';
import type { Database, Enums } from '@usefood/db';

type PratoDaCategoria = Database['public']['Functions']['vitrine_por_categoria']['Returns'][number];
import {
  distanciaKm,
  gravarFavoritos,
  guardarCidade,
  lembrarVolta,
  lerFavoritos,
  localGuardado,
  localPermitido,
  normalizar,
  pedirLocal,
  quandoAbre,
  resumoDaEntrega,
  textoDaDistancia,
  type Local,
  type LojaDaVitrine,
  type PratoEncontrado,
} from './vitrine-dados';

/** /delivery/<cidade>: o início do app (referência: Mockup do App de Delivery USE! FOOD). */
export function Vitrine({ cidade }: { cidade: string }) {
  const { supabase, site } = useAppContext();
  const instalar = useInstalar();
  const [lojas, setLojas] = useState<LojaDaVitrine[] | null>(null);
  const [nomeDaCidade, setNomeDaCidade] = useState('');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [pratos, setPratos] = useState<PratoEncontrado[]>([]);
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);
  const [local, setLocal] = useState<Local | null>(localGuardado);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [pratosDaCategoria, setPratosDaCategoria] = useState<PratoDaCategoria[]>([]);
  const [erro, setErro] = useState('');
  const endereco = lerConta().enderecos[0];

  useEffect(() => {
    if (!supabase) return;
    guardarCidade(cidade);
    void supabase
      .rpc('vitrine_da_cidade', { p_marca: site.brand, p_cidade: cidade })
      .then(({ data, error }) => {
        if (error)
          setErro('Não conseguimos carregar os restaurantes. Confira a internet e tente de novo.');
        setLojas(data ?? []);
      });
    void supabase
      .rpc('vitrine_ofertas', { p_marca: site.brand, p_cidade: cidade })
      .then(({ data }) => setOfertas(data ?? []));
    void supabase.rpc('vitrine_cidades', { p_marca: site.brand }).then(({ data }) => {
      const c = data?.find((x) => x.slug === cidade);
      if (c) setNomeDaCidade(`${c.cidade}/${c.uf}`);
    });
  }, [supabase, site.brand, cidade]);

  useEffect(() => {
    void localPermitido().then((ok) => {
      if (ok) void pedirLocal().then(setLocal, () => undefined);
    });
  }, []);

  useEffect(() => {
    if (nomeDaCidade) document.title = `Delivery em ${nomeDaCidade} · ${site.brand}`;
  }, [nomeDaCidade, site.brand]);

  useEffect(() => {
    const termo = busca.trim();
    if (!supabase || termo.length < 2) return;
    const t = setTimeout(() => {
      void supabase
        .rpc('vitrine_buscar', { p_marca: site.brand, p_cidade: cidade, p_termo: termo })
        .then(({ data }) => setPratos(data ?? []));
    }, 300);
    return () => clearTimeout(t);
  }, [supabase, site.brand, cidade, busca]);

  // Categoria escolhida: os pratos dela nas lojas da cidade (destaques e promoções primeiro)
  useEffect(() => {
    if (!supabase || !categoria) return;
    void supabase
      .rpc('vitrine_por_categoria', {
        p_marca: site.brand,
        p_cidade: cidade,
        p_cozinha: categoria as Enums<'cuisine_type'>,
      })
      .then(({ data }) => setPratosDaCategoria(data ?? []));
  }, [supabase, site.brand, cidade, categoria]);

  const foto = (caminho: string | null) =>
    supabase && caminho ? (urlDaFoto(supabase, caminho) ?? undefined) : undefined;
  const distancia = (l: LojaDaVitrine) =>
    local && l.latitude != null && l.longitude != null
      ? distanciaKm(local.lat, local.lng, l.latitude, l.longitude)
      : null;
  const buscando = busca.trim().length >= 2;
  // Categorias sempre visíveis (como na referência): as que têm lojas na cidade primeiro
  const categorias = useMemo(() => {
    const comLojas = new Set((lojas ?? []).flatMap((l) => l.cozinhas as string[]));
    return COZINHAS.map((c) => c.valor as string)
      .filter((c) => c !== 'outros')
      .sort((a, b) => Number(comLojas.has(b)) - Number(comLojas.has(a)));
  }, [lojas]);
  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    return (lojas ?? []).filter((l) => {
      if (categoria && !l.cozinhas.includes(categoria as never)) return false;
      if (!termo) return true;
      return [l.nome, l.bairro ?? '', ...l.cozinhas.map(rotuloDaCozinha)].some((t) =>
        normalizar(t).includes(termo),
      );
    });
  }, [lojas, busca, categoria]);
  const perto = (a: LojaDaVitrine, b: LojaDaVitrine) =>
    (distancia(a) ?? Infinity) - (distancia(b) ?? Infinity);
  const abertas = filtradas.filter((l) => l.aberta).sort(perto);
  const fechadas = filtradas.filter((l) => !l.aberta);
  // Destaques: abertas com capa primeiro (até 8)
  // Destaques: aparecem com 1 loja ou mais; abertas (com foto primeiro) e depois as fechadas
  const destaques = [
    ...[...abertas].sort(
      (a, b) =>
        Number(Boolean(b.logo_path ?? b.capa_path)) - Number(Boolean(a.logo_path ?? a.capa_path)),
    ),
    ...fechadas,
  ].slice(0, 10);

  const alternarFavorito = (slug: string) => {
    const nova = favoritos.includes(slug)
      ? favoritos.filter((s) => s !== slug)
      : [...favoritos, slug];
    setFavoritos(nova);
    gravarFavoritos(nova);
  };
  const abrirLoja = (slug: string, produtoId?: string) => {
    lembrarVolta(`/delivery/${cidade}`);
    navegar(`/delivery/${slug.replace(/^\//, '')}${produtoId ? `?produto=${produtoId}` : ''}`);
  };
  const resumo = (l: LojaDaVitrine) =>
    [`${l.tempo_min}–${l.tempo_max} min`, resumoDaEntrega(l)].join(' · ');
  const meta = (l: LojaDaVitrine) => {
    const km = distancia(l);
    return [
      l.cozinhas.map(rotuloDaCozinha).join(', ') || 'Restaurante',
      km != null ? textoDaDistancia(km) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <div className="min-h-dvh bg-canvas pb-28">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3.5">
          <div className="flex items-center justify-between gap-4">
            <img
              src="/marca/logo.webp"
              alt="USE! FOOD"
              width="95"
              height="44"
              className="h-10 w-auto shrink-0"
            />
            <button
              type="button"
              onClick={() => navegar('/delivery?trocar')}
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-md text-right focus-visible:outline-2 focus-visible:outline-brand"
            >
              <Icon name="local" size={20} className="shrink-0 text-brand-text" />
              <span className="flex min-w-0 flex-col">
                <span className="text-micro text-ink-muted">Entregar em</span>
                <span className="truncate text-label font-bold text-ink">
                  {endereco ? `${endereco.rua}, ${endereco.numero}` : nomeDaCidade || 'Sua cidade'}
                </span>
              </span>
              <Icon name="baixo" size={18} className="shrink-0 text-ink-muted" />
            </button>
          </div>
          <label className="relative block">
            <span className="sr-only">Buscar restaurantes ou pratos</span>
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted">
              <Icon name="busca" size={20} />
            </span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar restaurantes, pratos…"
              className="h-12 w-full rounded-pill border border-line bg-canvas pr-4 pl-12 text-body text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-brand"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-7 pt-4">
        <div className="flex flex-col gap-3 px-5 empty:hidden">
          <PedidoEmAndamento />
          <Alert>{erro}</Alert>
        </div>

        {categorias.length > 0 && (
          <div
            role="group"
            aria-label="Categorias"
            className="flex gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
          >
            {categorias.map((c) => {
              const ativa = categoria === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => setCategoria(ativa ? null : c)}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'flex size-16 items-center justify-center rounded-pill transition',
                      ativa ? 'bg-brand text-brand-ink' : 'bg-brand-soft text-brand-text',
                    )}
                  >
                    <Icon name={c as IconName} size={30} />
                  </span>
                  <span
                    className={cn(
                      'text-micro font-semibold',
                      ativa ? 'text-brand-text' : 'text-ink',
                    )}
                  >
                    {rotuloDaCozinha(c)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!buscando && !categoria && (
          <div className="px-5">
            <div className="tema-escuro relative flex h-40 items-center overflow-hidden rounded-[1.5rem] bg-canvas">
              <img
                src="/marca/hamburguer.webp"
                alt=""
                className="absolute inset-y-0 right-0 h-full w-[55%] object-cover [mask-image:linear-gradient(90deg,transparent,#000_35%)]"
              />
              <p className="relative max-w-[60%] pl-6 text-[1.375rem] leading-tight font-black tracking-[-0.03em] text-ink">
                Os melhores sabores da sua cidade<span className="text-accent">.</span>
              </p>
            </div>
          </div>
        )}

        {!lojas ? (
          <Esqueleto />
        ) : lojas.length === 0 ? (
          <div className="mx-5 flex flex-col gap-3 rounded-lg bg-surface p-6">
            <p className="text-body-strong text-ink">Ainda não há restaurantes nesta cidade.</p>
            <button
              type="button"
              onClick={() => navegar('/delivery?trocar')}
              className="w-fit text-label font-bold text-brand-text"
            >
              Escolher outra cidade
            </button>
          </div>
        ) : (
          <>
            {buscando && pratos.length > 0 && (
              <Secao titulo="Pratos">
                <ul className="mx-5 flex flex-col divide-y divide-line overflow-hidden rounded-lg bg-surface">
                  {pratos.map((p) => (
                    <li key={p.produto_id}>
                      <button
                        type="button"
                        onClick={() => abrirLoja(p.loja_slug, p.produto_id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-strong"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-body-strong text-ink">{p.produto}</span>
                          <span className="truncate text-caption text-ink-muted">
                            {p.loja_nome}
                            {p.loja_aberta ? '' : ' (fechada agora)'}
                          </span>
                          <span className="text-label font-bold text-ink">
                            {formatarPreco(p.preco_cents)}
                          </span>
                        </div>
                        {p.foto_path && (
                          <img
                            src={foto(p.foto_path)}
                            alt=""
                            loading="lazy"
                            className="size-16 shrink-0 rounded-md object-cover"
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </Secao>
            )}

            {categoria && !buscando && pratosDaCategoria.length > 0 && (
              <Secao titulo={`Pratos de ${rotuloDaCozinha(categoria)}`}>
                <ul className="mx-5 flex flex-col divide-y divide-line overflow-hidden rounded-lg bg-surface">
                  {pratosDaCategoria.slice(0, 20).map((p) => (
                    <li key={p.produto_id}>
                      <button
                        type="button"
                        onClick={() => abrirLoja(p.loja_slug, p.produto_id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-strong"
                      >
                        {p.foto_path && (
                          <img
                            src={foto(p.foto_path)}
                            alt=""
                            loading="lazy"
                            className="size-16 shrink-0 rounded-md object-cover"
                          />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-body-strong text-ink">{p.produto}</span>
                            {p.destaque && (
                              <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-micro font-bold text-brand-text">
                                Destaque
                              </span>
                            )}
                          </span>
                          <span className="truncate text-caption text-ink-muted">
                            {p.loja_nome}
                            {p.loja_aberta ? '' : ' (fechada agora)'}
                          </span>
                          <span className="flex items-baseline gap-1.5">
                            <span
                              className={cn(
                                'text-label font-bold tabular-nums',
                                p.preco_original_cents ? 'text-brand-text' : 'text-ink',
                              )}
                            >
                              {formatarPreco(p.preco_cents)}
                            </span>
                            {p.preco_original_cents && (
                              <s className="text-micro text-ink-muted tabular-nums">
                                {formatarPreco(p.preco_original_cents)}
                              </s>
                            )}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </Secao>
            )}

            {!buscando && !categoria && destaques.length > 0 && (
              <Secao
                titulo="Restaurantes em destaque"
                acao={{
                  texto: 'Ver todos',
                  onClick: () =>
                    document.getElementById('todos')?.scrollIntoView({ behavior: 'smooth' }),
                }}
              >
                <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                  {destaques.map((l) => (
                    <li key={l.slug} className="w-[7.75rem] shrink-0 snap-start">
                      <StoreCard
                        variant="compacto"
                        name={l.nome}
                        href={`/${l.slug}`}
                        onNavigate={abrirLoja}
                        meta={l.cozinhas.map(rotuloDaCozinha).join(', ') || 'Restaurante'}
                        delivery={`${l.tempo_min}–${l.tempo_max} min`}
                        open={l.aberta}
                        closedLabel={quandoAbre(l)}
                        photoUrl={foto(l.logo_path) ?? foto(l.capa_path)}
                      />
                    </li>
                  ))}
                </ul>
              </Secao>
            )}

            {!buscando && !categoria && ofertas.length > 0 && (
              <Secao
                titulo="Promoções"
                acao={{ texto: 'Ver todas', onClick: () => navegar('/delivery/ofertas') }}
              >
                <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                  {ofertas.slice(0, 10).map((o) => (
                    <li key={o.produto_id} className="w-40 shrink-0 snap-start">
                      <CartaoDeOferta oferta={o} onAbrir={abrirLoja} />
                    </li>
                  ))}
                </ul>
              </Secao>
            )}

            <div id="todos" className="flex scroll-mt-32 flex-col gap-7">
              <ListaDeLojas
                titulo={categoria ? rotuloDaCozinha(categoria) : 'Abertos agora'}
                lojas={abertas}
                {...{ abrirLoja, favoritos, alternarFavorito, meta, resumo, foto }}
              />
              <ListaDeLojas
                titulo="Abrem mais tarde"
                lojas={fechadas}
                {...{ abrirLoja, favoritos, alternarFavorito, meta, resumo, foto }}
              />
            </div>
            {filtradas.length === 0 && pratos.length === 0 && (
              <p className="px-5 text-body text-ink-muted">
                {categoria && !buscando
                  ? `Ainda não há restaurantes de ${rotuloDaCozinha(categoria)} na cidade.`
                  : 'Nada encontrado. Tente outro nome ou prato.'}
              </p>
            )}
          </>
        )}

        {instalar && (
          <div className="mx-5 flex items-center justify-between gap-4 rounded-lg bg-surface p-4">
            <span className="text-body text-ink">Tenha o USE! na tela do celular.</span>
            <button
              type="button"
              onClick={instalar}
              className="h-10 shrink-0 rounded-pill bg-brand px-4 text-label font-bold text-brand-ink"
            >
              Instalar app
            </button>
          </div>
        )}
      </main>

      <BarraDoApp ativo="inicio" cidade={cidade} />
    </div>
  );
}

function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: { texto: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-5">
        <h2 className="text-title-section font-extrabold tracking-[-0.02em] text-ink">{titulo}</h2>
        {acao && (
          <button
            type="button"
            onClick={acao.onClick}
            className="text-label font-bold text-brand-text"
          >
            {acao.texto}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Esqueleto() {
  return (
    <div role="status" aria-label="Carregando os restaurantes" className="flex flex-col gap-3 px-5">
      <div className="flex gap-3 overflow-hidden">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="h-52 w-60 shrink-0 rounded-lg bg-surface-strong motion-safe:animate-pulse"
          />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-24 rounded-lg bg-surface-strong motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

interface PropsDaLista {
  abrirLoja: (slug: string) => void;
  favoritos: string[];
  alternarFavorito: (slug: string) => void;
  meta: (l: LojaDaVitrine) => string;
  resumo: (l: LojaDaVitrine) => string;
  foto: (caminho: string | null) => string | undefined;
}

export function ListaDeLojas({
  titulo,
  lojas,
  ...p
}: PropsDaLista & { titulo: string; lojas: LojaDaVitrine[] }) {
  if (lojas.length === 0) return null;
  return (
    <Secao titulo={titulo}>
      <ul className="mx-5 flex flex-col divide-y divide-line overflow-hidden rounded-lg bg-surface">
        {lojas.map((l) => (
          <LinhaDaLoja key={l.slug} loja={l} {...p} />
        ))}
      </ul>
    </Secao>
  );
}

function LinhaDaLoja({
  loja: l,
  abrirLoja,
  favoritos,
  alternarFavorito,
  meta,
  resumo,
  foto,
}: PropsDaLista & { loja: LojaDaVitrine }) {
  const imagem = foto(l.logo_path) ?? foto(l.capa_path);
  const favorita = favoritos.includes(l.slug);
  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => abrirLoja(l.slug)}
        className="flex w-full items-center gap-4 px-4 py-3.5 pr-14 text-left transition active:bg-surface-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      >
        {imagem ? (
          <img
            src={imagem}
            alt=""
            loading="lazy"
            className={cn(
              'size-[4.5rem] shrink-0 rounded-md object-cover',
              !l.aberta && 'grayscale',
            )}
          />
        ) : (
          <span className="flex size-[4.5rem] shrink-0 items-center justify-center rounded-md bg-brand-soft text-title-section font-black text-brand-text">
            {l.nome.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body-strong text-ink">{l.nome}</span>
          <span className="truncate text-caption text-ink-muted">{meta(l)}</span>
          {l.aberta ? (
            <span
              className={cn(
                'text-caption',
                resumoDaEntrega(l) === 'Entrega grátis'
                  ? 'font-bold text-success'
                  : 'text-ink-muted',
              )}
            >
              {resumo(l)}
            </span>
          ) : (
            <span className="text-caption font-bold text-ink-muted">{quandoAbre(l)}</span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={() => alternarFavorito(l.slug)}
        aria-pressed={favorita}
        aria-label={favorita ? `Tirar ${l.nome} dos favoritos` : `Favoritar ${l.nome}`}
        className={cn(
          'absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill',
          favorita ? 'text-brand-text' : 'text-ink-muted',
        )}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={favorita ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      </button>
    </li>
  );
}
