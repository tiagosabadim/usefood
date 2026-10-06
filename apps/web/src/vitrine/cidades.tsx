import { useAppContext } from '@usefood/app';
import { Alert, Button, Icon } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { navegar } from '../rotas';
import {
  cidadeGuardada,
  cidadeMaisPerto,
  guardarCidade,
  pedirLocal,
  type CidadeDaVitrine,
} from './vitrine-dados';

/** Logo do USE! na versão clara (para fundo escuro), derivado do original. */
export const LogoClaro = ({ className = 'h-9' }: { className?: string }) => (
  <img
    src="/marca/logo.webp"
    alt="USE! FOOD"
    width="95"
    height="44"
    className={`${className} w-auto [filter:invert(1)_hue-rotate(180deg)] mix-blend-screen`}
  />
);

/**
 * /delivery: na primeira vez, pega a localização e já entra na cidade mais perto.
 * Sem permissão ou longe de todas: a lista. Com cidade guardada: vai direto para ela.
 */
export function EscolherCidade() {
  const { supabase, site } = useAppContext();
  const trocar = new URLSearchParams(window.location.search).has('trocar');
  const [cidades, setCidades] = useState<CidadeDaVitrine[] | null>(null);
  const [procurando, setProcurando] = useState(!trocar);
  const [aviso, setAviso] = useState('');

  const escolher = (slug: string, substituir = false) => {
    guardarCidade(slug);
    navegar(`/delivery/${slug}`, { substituir });
  };

  useEffect(() => {
    const guardada = cidadeGuardada();
    if (guardada && !trocar) return escolher(guardada, true);
    if (!supabase) return;
    let ativo = true;
    void supabase.rpc('vitrine_cidades', { p_marca: site.brand }).then(async ({ data, error }) => {
      if (!ativo) return;
      if (error)
        setAviso('Não conseguimos carregar as cidades. Confira a internet e tente de novo.');
      const lista = data ?? [];
      setCidades(lista);
      if (trocar || lista.length === 0) return setProcurando(false);
      if (lista.length === 1) return escolher(lista[0]!.slug, true);
      try {
        const local = await pedirLocal();
        const perto = cidadeMaisPerto(lista, local.lat, local.lng);
        if (!ativo) return;
        if (perto) return escolher(perto.slug, true);
        setAviso('Ainda não chegamos perto de você. Escolha uma cidade na lista.');
      } catch {
        // sem permissão ou sem resposta: escolhe na lista
      }
      if (ativo) setProcurando(false);
    });
    return () => {
      ativo = false;
    };
  }, [supabase, site.brand, trocar]);

  async function usarLocalizacao() {
    if (!cidades) return;
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

  return (
    <div className="tema-escuro min-h-dvh bg-canvas text-ink">
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-10">
        <LogoClaro className="h-11" />
        {procurando ? (
          <div role="status" className="flex flex-1 flex-col justify-center gap-4 pb-20">
            <span
              className="size-10 motion-safe:animate-spin rounded-pill border-4 border-line border-t-accent"
              aria-hidden="true"
            />
            <p className="text-[clamp(2rem,8vw,2.75rem)] leading-tight font-black tracking-[-0.04em]">
              Procurando restaurantes perto de você…
            </p>
            <button
              type="button"
              onClick={() => setProcurando(false)}
              className="w-fit text-label font-bold text-brand-text underline-offset-4 hover:underline"
            >
              Escolher a cidade na lista
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <h1 className="text-[clamp(2.5rem,10vw,3.5rem)] leading-[0.95] font-black tracking-[-0.045em]">
                Deu fome<span className="text-accent">?</span>
              </h1>
              <p className="text-body text-ink-muted">
                Escolha a sua cidade para ver os restaurantes que entregam aí.
              </p>
            </div>
            <Button
              className="h-target-pdv"
              disabled={!cidades?.length}
              onClick={() => void usarLocalizacao()}
            >
              <Icon name="local" size={20} /> Usar minha localização
            </Button>
            <Alert>{aviso}</Alert>
            <section aria-labelledby="t-cidades" className="flex flex-col gap-3">
              <h2 id="t-cidades" className="text-title-section font-black">
                Cidades com o USE!
              </h2>
              {!cidades ? (
                <p className="text-body text-ink-muted">Carregando as cidades…</p>
              ) : cidades.length === 0 ? (
                <p className="text-body text-ink-muted">
                  Ainda não há restaurantes publicados. Volte em breve!
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  {cidades.map((c) => (
                    <li key={c.slug}>
                      <button
                        type="button"
                        onClick={() => escolher(c.slug)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-surface-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                      >
                        <span className="text-body-strong">
                          {c.cidade}/{c.uf}
                        </span>
                        <span className="text-caption text-ink-muted">
                          {c.lojas} {c.lojas === 1 ? 'restaurante' : 'restaurantes'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
