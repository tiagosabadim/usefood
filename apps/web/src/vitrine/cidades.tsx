import { useAppContext } from '@usefood/app';
import { Alert, Icon } from '@usefood/ui';
import { useEffect, useMemo, useState } from 'react';
import { navegar } from '../rotas';
import {
  cidadeGuardada,
  cidadeMaisPerto,
  guardarCidade,
  normalizar,
  pedirLocal,
  type CidadeDaVitrine,
} from './vitrine-dados';

const SPLASH_MINIMO_MS = 1400;
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/**
 * /delivery: splash animada; enquanto ela roda, carrega as cidades e descobre a cidade
 * (a já escolhida, a única com lojas ou a mais perto pela localização). Achou: entra direto.
 * Não achou: a tela de escolha, no visual da home. "?trocar" vai direto para a escolha.
 */
export function EscolherCidade() {
  const { supabase, site } = useAppContext();
  const trocar = new URLSearchParams(window.location.search).has('trocar');
  const [fase, setFase] = useState<'splash' | 'lista'>(trocar ? 'lista' : 'splash');
  const [cidades, setCidades] = useState<CidadeDaVitrine[] | null>(null);
  const [busca, setBusca] = useState('');
  const [procurando, setProcurando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let ativo = true;
    const inicio = Date.now();
    const entrar = async (slug: string) => {
      await esperar(Math.max(0, SPLASH_MINIMO_MS - (Date.now() - inicio)));
      if (!ativo) return;
      guardarCidade(slug);
      navegar(`/delivery/${slug}`, { substituir: true });
    };
    void (async () => {
      const { data, error } = await supabase.rpc('vitrine_cidades', { p_marca: site.brand });
      if (!ativo) return;
      const lista = data ?? [];
      setCidades(lista);
      if (error)
        setAviso('Não conseguimos carregar as cidades. Confira a internet e tente de novo.');
      if (trocar) return;
      const guardada = cidadeGuardada();
      if (guardada && lista.some((c) => c.slug === guardada)) return entrar(guardada);
      if (lista.length === 1) return entrar(lista[0]!.slug);
      if (lista.length > 1) {
        try {
          const local = await pedirLocal();
          const perto = cidadeMaisPerto(lista, local.lat, local.lng);
          if (perto) return entrar(perto.slug);
        } catch {
          // sem permissão ou sem resposta: escolhe na lista
        }
      }
      await esperar(Math.max(0, SPLASH_MINIMO_MS - (Date.now() - inicio)));
      if (ativo) setFase('lista');
    })();
    return () => {
      ativo = false;
    };
  }, [supabase, site.brand, trocar]);

  const escolher = (slug: string) => {
    guardarCidade(slug);
    navegar(`/delivery/${slug}`);
  };

  async function usarLocalizacao() {
    if (!cidades?.length) return;
    setProcurando(true);
    setAviso('');
    try {
      const local = await pedirLocal();
      const perto = cidadeMaisPerto(cidades, local.lat, local.lng);
      if (perto) return escolher(perto.slug);
      setAviso('Ainda não chegamos perto de você. Escolha uma cidade na lista.');
    } catch {
      setAviso('Sem permissão para a localização. Escolha a cidade na lista.');
    }
    setProcurando(false);
  }

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return (cidades ?? []).filter(
      (c) => !termo || normalizar(`${c.cidade} ${c.uf}`).includes(termo),
    );
  }, [cidades, busca]);

  if (fase === 'splash') return <Splash />;

  return (
    <div className="min-h-dvh bg-canvas pb-10">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
          <img
            src="/marca/logo.webp"
            alt="USE! FOOD"
            width="95"
            height="44"
            className="h-10 w-auto self-start"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-[1.75rem] leading-tight font-black tracking-[-0.03em] text-ink">
              Onde você está?
            </h1>
            <p className="text-body text-ink-muted">
              Escolha sua cidade para ver os restaurantes que entregam aí.
            </p>
          </div>
          <label className="relative block">
            <span className="sr-only">Buscar cidade</span>
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted">
              <Icon name="busca" size={20} />
            </span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cidade"
              className="h-12 w-full rounded-pill border border-line bg-canvas pr-4 pl-12 text-body text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-brand"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-5">
        <button
          type="button"
          onClick={() => void usarLocalizacao()}
          disabled={procurando || !cidades?.length}
          className="flex w-full items-center gap-4 rounded-lg bg-surface p-4 text-left transition active:bg-surface-strong disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-brand text-brand-ink">
            <Icon name="local" size={22} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-strong text-ink">
              {procurando ? 'Procurando…' : 'Usar minha localização'}
            </span>
            <span className="text-caption text-ink-muted">
              Encontra a cidade mais perto de você
            </span>
          </span>
          <Icon name="voltar" size={18} className="shrink-0 rotate-180 text-ink-muted" />
        </button>
        <Alert>{aviso}</Alert>

        <section aria-labelledby="t-cidades" className="flex flex-col gap-3">
          <h2
            id="t-cidades"
            className="text-title-section font-extrabold tracking-[-0.02em] text-ink"
          >
            Cidades com o USE!
          </h2>
          {!cidades ? (
            <div role="status" aria-label="Carregando as cidades" className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-[4.5rem] rounded-lg bg-surface-strong motion-safe:animate-pulse"
                />
              ))}
            </div>
          ) : visiveis.length === 0 ? (
            <p className="text-body text-ink-muted">
              {cidades.length === 0
                ? 'Ainda não há restaurantes publicados. Volte em breve!'
                : 'Nenhuma cidade com esse nome.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg bg-surface">
              {visiveis.map((c) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => escolher(c.slug)}
                    className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition active:bg-surface-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
                      <Icon name="local" size={20} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-strong text-ink">
                        {c.cidade}/{c.uf}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {c.lojas} {c.lojas === 1 ? 'restaurante' : 'restaurantes'}
                      </span>
                    </span>
                    <Icon name="voltar" size={18} className="shrink-0 rotate-180 text-ink-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <a
          href="/franquia"
          className="flex items-center gap-4 rounded-lg border border-dashed border-line-strong p-4 text-left no-underline transition hover:bg-surface"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-strong text-ink">Não achou sua cidade?</span>
            <span className="text-caption text-ink-muted">
              Leve o USE! para ela: seja franqueado ou parceiro.
            </span>
          </span>
          <Icon name="voltar" size={18} className="shrink-0 rotate-180 text-brand-text" />
        </a>
      </main>
    </div>
  );
}

/** Abertura do app: logo surgindo, frase e barrinha laranja enquanto descobre a cidade. */
function Splash() {
  return (
    <div
      role="status"
      aria-label="Abrindo o USE!"
      className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-surface px-8"
    >
      <img
        src="/marca/logo.webp"
        alt="USE! FOOD"
        width="190"
        height="88"
        className="splash-logo h-24 w-auto"
      />
      <p className="splash-texto text-body text-ink-muted">O delivery da sua cidade</p>
      <span
        aria-hidden="true"
        className="splash-texto relative mt-2 h-1 w-28 overflow-hidden rounded-pill bg-surface-strong"
      >
        <span className="splash-barra absolute inset-y-0 left-0 w-1/3 rounded-pill bg-accent" />
      </span>
    </div>
  );
}
