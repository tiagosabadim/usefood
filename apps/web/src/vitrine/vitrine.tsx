import { useAppContext } from '@usefood/app';
import { formatarPreco, rotuloDaCozinha } from '@usefood/core';
import { urlDaFoto } from '@usefood/pedidos';
import { Alert, Chip, Icon, cn } from '@usefood/ui';
import { useEffect, useMemo, useState } from 'react';
import { PedidoEmAndamento } from '../loja/pedido-em-andamento';
import { navegar } from '../rotas';
import { BarraDoApp, BotaoInstalar } from './barra';
import { LogoClaro } from './cidades';
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

/** /delivery/<cidade>: restaurantes da cidade, busca por restaurante e prato, categorias e favoritos. */
export function Vitrine({ cidade }: { cidade: string }) {
  const { supabase, site } = useAppContext();
  const [lojas, setLojas] = useState<LojaDaVitrine[] | null>(null);
  const [nomeDaCidade, setNomeDaCidade] = useState('');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [pratos, setPratos] = useState<PratoEncontrado[]>([]);
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);
  const [local, setLocal] = useState<Local | null>(localGuardado);
  const [erro, setErro] = useState('');

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
    void supabase.rpc('vitrine_cidades', { p_marca: site.brand }).then(({ data }) => {
      const c = data?.find((x) => x.slug === cidade);
      if (c) setNomeDaCidade(`${c.cidade}/${c.uf}`);
    });
  }, [supabase, site.brand, cidade]);

  // Localização: atualiza sem perguntar de novo, se a pessoa já tinha permitido
  useEffect(() => {
    void localPermitido().then((ok) => {
      if (ok) void pedirLocal().then(setLocal, () => undefined);
    });
  }, []);

  useEffect(() => {
    if (nomeDaCidade) document.title = `Delivery em ${nomeDaCidade} · ${site.brand}`;
  }, [nomeDaCidade, site.brand]);

  // Pratos: busca no banco depois que a pessoa para de digitar
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

  const distancia = (l: LojaDaVitrine) =>
    local && l.latitude != null && l.longitude != null
      ? distanciaKm(local.lat, local.lng, l.latitude, l.longitude)
      : null;
  const pratosVisiveis = busca.trim().length >= 2 ? pratos : [];
  const categorias = useMemo(() => [...new Set((lojas ?? []).flatMap((l) => l.cozinhas))], [lojas]);
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
  // Abertos: os mais perto primeiro (quando a localização é conhecida)
  const abertas = filtradas
    .filter((l) => l.aberta)
    .sort((a, b) => (distancia(a) ?? Infinity) - (distancia(b) ?? Infinity));
  const fechadas = filtradas.filter((l) => !l.aberta);
  const suasFavoritas =
    busca || categoria ? [] : (lojas ?? []).filter((l) => favoritos.includes(l.slug));

  const alternarFavorito = (slug: string) => {
    const nova = favoritos.includes(slug)
      ? favoritos.filter((s) => s !== slug)
      : [...favoritos, slug];
    setFavoritos(nova);
    gravarFavoritos(nova);
  };
  const abrirLoja = (slug: string) => {
    lembrarVolta(`/delivery/${cidade}`);
    navegar(`/${slug}`);
  };
  const cartao = { abrir: abrirLoja, favoritos, alternarFavorito, distancia };

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="tema-escuro sticky top-0 z-30 bg-canvas text-ink shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4">
          <div className="flex items-center justify-between gap-3">
            <LogoClaro className="h-9" />
            <BotaoInstalar />
          </div>
          <button
            type="button"
            onClick={() => navegar('/delivery?trocar')}
            className="flex min-h-11 w-fit items-center gap-1.5 rounded-pill pr-2 text-body-strong focus-visible:outline-2 focus-visible:outline-brand"
            aria-label={`Cidade: ${nomeDaCidade || 'carregando'}. Trocar de cidade`}
          >
            <Icon name="local" size={20} />
            {nomeDaCidade || 'Sua cidade'}
            <Icon name="baixo" size={18} />
          </button>
          <label className="relative block">
            <span className="sr-only">Buscar restaurante ou prato</span>
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted">
              <Icon name="busca" size={20} />
            </span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar restaurante ou prato"
              className="h-12 w-full rounded-pill border border-line bg-surface pr-4 pl-12 text-body placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-brand"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 pt-5">
        <PedidoEmAndamento />
        <Alert>{erro}</Alert>

        {categorias.length > 1 && (
          <div
            role="group"
            aria-label="Categorias"
            className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
          >
            <Chip selected={!categoria} onClick={() => setCategoria(null)}>
              Todos
            </Chip>
            {categorias.map((c) => (
              <Chip
                key={c}
                selected={categoria === c}
                onClick={() => setCategoria(categoria === c ? null : c)}
              >
                {rotuloDaCozinha(c)}
              </Chip>
            ))}
          </div>
        )}

        {!lojas ? (
          <Esqueleto />
        ) : lojas.length === 0 ? (
          <div className="flex flex-col gap-3 rounded-lg bg-surface p-6">
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
            {pratosVisiveis.length > 0 && (
              <section aria-labelledby="t-pratos" className="flex flex-col gap-3">
                <h2 id="t-pratos" className="text-title-section font-black text-ink">
                  Pratos
                </h2>
                <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg bg-surface">
                  {pratosVisiveis.map((p) => (
                    <li key={p.produto_id}>
                      <button
                        type="button"
                        onClick={() => abrirLoja(p.loja_slug)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-strong"
                      >
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-body-strong text-ink">{p.produto}</span>
                          <span className="truncate text-caption text-ink-muted">
                            {p.loja_nome}
                            {p.loja_aberta ? '' : ' (fechada agora)'}
                          </span>
                          <span className="text-label font-bold text-ink">
                            {formatarPreco(p.preco_cents)}
                          </span>
                        </div>
                        {p.foto_path && supabase && (
                          <img
                            src={urlDaFoto(supabase, p.foto_path)!}
                            alt=""
                            loading="lazy"
                            className="size-16 shrink-0 rounded-md object-cover"
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <ListaDeLojas titulo="Seus favoritos" lojas={suasFavoritas} {...cartao} />
            <ListaDeLojas titulo="Abertos agora" lojas={abertas} {...cartao} />
            <ListaDeLojas titulo="Abrem mais tarde" lojas={fechadas} {...cartao} />
            {filtradas.length === 0 && pratosVisiveis.length === 0 && (
              <p className="text-body text-ink-muted">
                Nada encontrado com essa busca. Tente outro nome ou prato.
              </p>
            )}
          </>
        )}
      </main>

      <BarraDoApp ativo="restaurantes" cidade={cidade} />
    </div>
  );
}

/** Blocos no formato dos cartões enquanto os restaurantes carregam. */
function Esqueleto() {
  return (
    <div role="status" aria-label="Carregando os restaurantes" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg bg-surface p-3.5">
          <span className="size-16 shrink-0 rounded-md bg-surface-strong motion-safe:animate-pulse" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-4 w-1/2 rounded-pill bg-surface-strong motion-safe:animate-pulse" />
            <span className="h-3 w-3/4 rounded-pill bg-surface-strong motion-safe:animate-pulse" />
          </span>
        </div>
      ))}
    </div>
  );
}

interface PropsDoCartao {
  abrir: (slug: string) => void;
  favoritos: string[];
  alternarFavorito: (slug: string) => void;
  distancia: (l: LojaDaVitrine) => number | null;
}

function ListaDeLojas({
  titulo,
  lojas,
  ...props
}: PropsDoCartao & { titulo: string; lojas: LojaDaVitrine[] }) {
  if (lojas.length === 0) return null;
  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <h2 className="text-title-section font-black text-ink">{titulo}</h2>
      <ul className="flex flex-col gap-3">
        {lojas.map((l) => (
          <CartaoDaLoja key={l.slug} loja={l} {...props} />
        ))}
      </ul>
    </section>
  );
}

function CartaoDaLoja({
  loja: l,
  abrir,
  favoritos,
  alternarFavorito,
  distancia,
}: PropsDoCartao & { loja: LojaDaVitrine }) {
  const { supabase } = useAppContext();
  const logo = supabase ? urlDaFoto(supabase, l.logo_path) : null;
  const favorita = favoritos.includes(l.slug);
  const km = distancia(l);
  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => abrir(l.slug)}
        className="flex w-full items-center gap-4 rounded-lg bg-surface p-3.5 pr-14 text-left transition hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-brand"
      >
        {logo ? (
          <img
            src={logo}
            alt=""
            loading="lazy"
            className={cn('size-16 shrink-0 rounded-md object-cover', !l.aberta && 'grayscale')}
          />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-surface-strong text-title-section font-black text-ink-muted">
            {l.nome.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-body-strong text-ink">{l.nome}</span>
          <span className="truncate text-caption text-ink-muted">
            {[l.cozinhas.map(rotuloDaCozinha).join(', '), km != null ? textoDaDistancia(km) : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {l.aberta ? (
            <span className="flex flex-wrap gap-x-3 text-caption text-ink-muted">
              <span>
                {l.tempo_min}–{l.tempo_max} min
              </span>
              <span
                className={cn(resumoDaEntrega(l) === 'Entrega grátis' && 'font-bold text-success')}
              >
                {resumoDaEntrega(l)}
              </span>
              {l.pedido_minimo_cents > 0 && (
                <span>Mínimo {formatarPreco(l.pedido_minimo_cents)}</span>
              )}
            </span>
          ) : (
            <span className="w-fit rounded-pill bg-surface-strong px-2.5 py-0.5 text-caption font-bold text-ink-muted">
              {quandoAbre(l)}
            </span>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={() => alternarFavorito(l.slug)}
        aria-pressed={favorita}
        aria-label={favorita ? `Tirar ${l.nome} dos favoritos` : `Favoritar ${l.nome}`}
        className={cn(
          'absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill transition hover:bg-surface-strong',
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
