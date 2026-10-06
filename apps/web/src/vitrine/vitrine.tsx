import { useAppContext } from '@usefood/app';
import { formatarPreco, rotuloDaCozinha } from '@usefood/core';
import { urlDaFoto } from '@usefood/pedidos';
import { Alert, Chip, Icon, cn } from '@usefood/ui';
import { useEffect, useMemo, useState } from 'react';
import { navegar } from '../rotas';
import { BarraDoApp, BotaoInstalar } from './barra';
import {
  guardarCidade,
  lembrarVolta,
  normalizar,
  quandoAbre,
  resumoDaEntrega,
  type LojaDaVitrine,
  type PratoEncontrado,
} from './vitrine-dados';

/** /delivery/<cidade>: restaurantes da cidade, busca por restaurante e prato, categorias. */
export function Vitrine({ cidade }: { cidade: string }) {
  const { supabase, site } = useAppContext();
  const [lojas, setLojas] = useState<LojaDaVitrine[] | null>(null);
  const [nomeDaCidade, setNomeDaCidade] = useState('');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [pratos, setPratos] = useState<PratoEncontrado[]>([]);
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

  useEffect(() => {
    if (lojas && nomeDaCidade) document.title = `Delivery em ${nomeDaCidade} · ${site.brand}`;
  }, [lojas, nomeDaCidade, site.brand]);

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
  const abertas = filtradas.filter((l) => l.aberta);
  const fechadas = filtradas.filter((l) => !l.aberta);

  const abrirLoja = (slug: string) => {
    lembrarVolta(`/delivery/${cidade}`);
    navegar(`/${slug}`);
  };

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="tema-escuro bg-canvas text-ink">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navegar('/delivery?trocar')}
              className="flex min-h-11 items-center gap-1.5 rounded-pill pr-2 text-body-strong text-ink focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={`Cidade: ${nomeDaCidade || 'carregando'}. Trocar de cidade`}
            >
              <Icon name="local" size={20} />
              {nomeDaCidade || 'Sua cidade'}
              <Icon name="baixo" size={18} />
            </button>
            <BotaoInstalar />
          </div>
          <h1 className="text-[2rem] leading-none font-black tracking-[-0.04em]">
            Deu fome<span className="text-accent">?</span>
          </h1>
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
              className="h-12 w-full rounded-pill border border-line bg-surface pr-4 pl-12 text-body text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-brand"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 pt-5">
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
          <p className="text-body text-ink-muted">Carregando os restaurantes…</p>
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

            <ListaDeLojas titulo="Abertos agora" lojas={abertas} abrir={abrirLoja} />
            <ListaDeLojas titulo="Abrem mais tarde" lojas={fechadas} abrir={abrirLoja} />
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

function ListaDeLojas({
  titulo,
  lojas,
  abrir,
}: {
  titulo: string;
  lojas: LojaDaVitrine[];
  abrir: (slug: string) => void;
}) {
  const { supabase } = useAppContext();
  if (lojas.length === 0) return null;
  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <h2 className="text-title-section font-black text-ink">{titulo}</h2>
      <ul className="flex flex-col gap-3">
        {lojas.map((l) => {
          const logo = supabase ? urlDaFoto(supabase, l.logo_path) : null;
          return (
            <li key={l.slug}>
              <button
                type="button"
                onClick={() => abrir(l.slug)}
                className="flex w-full items-center gap-4 rounded-lg bg-surface p-3.5 text-left transition hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-brand"
              >
                {logo ? (
                  <img
                    src={logo}
                    alt=""
                    loading="lazy"
                    className="size-16 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-surface-strong text-title-section font-black text-ink-muted">
                    {l.nome.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-body-strong text-ink">{l.nome}</span>
                  {l.cozinhas.length > 0 && (
                    <span className="truncate text-caption text-ink-muted">
                      {l.cozinhas.map(rotuloDaCozinha).join(', ')}
                    </span>
                  )}
                  {l.aberta ? (
                    <span className="flex flex-wrap gap-x-3 text-caption text-ink-muted">
                      <span>
                        {l.tempo_min}–{l.tempo_max} min
                      </span>
                      <span
                        className={cn(
                          resumoDaEntrega(l) === 'Entrega grátis' && 'font-bold text-success',
                        )}
                      >
                        {resumoDaEntrega(l)}
                      </span>
                      {l.pedido_minimo_cents > 0 && (
                        <span>Mínimo {formatarPreco(l.pedido_minimo_cents)}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-caption font-bold text-ink-muted">{quandoAbre(l)}</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
