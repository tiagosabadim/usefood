import { useAppContext } from '@usefood/app';
import { Alert, Button, Icon } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { navegar } from '../rotas';
import {
  cidadeGuardada,
  cidadeMaisPerto,
  guardarCidade,
  type CidadeDaVitrine,
} from './vitrine-dados';

/** /delivery: escolher a cidade (pela localização ou na lista). Lembra a escolha no aparelho. */
export function EscolherCidade() {
  const { supabase, site } = useAppContext();
  const [cidades, setCidades] = useState<CidadeDaVitrine[] | null>(null);
  const [procurando, setProcurando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const guardada = cidadeGuardada();
    if (guardada && !new URLSearchParams(window.location.search).has('trocar')) {
      navegar(`/delivery/${guardada}`, { substituir: true });
      return;
    }
    if (!supabase) return;
    void supabase.rpc('vitrine_cidades', { p_marca: site.brand }).then(({ data, error }) => {
      if (error)
        setAviso('Não conseguimos carregar as cidades. Confira a internet e tente de novo.');
      setCidades(data ?? []);
    });
  }, [supabase, site.brand]);

  const escolher = (slug: string) => {
    guardarCidade(slug);
    navegar(`/delivery/${slug}`);
  };

  function usarLocalizacao() {
    if (!navigator.geolocation || !cidades)
      return setAviso('Este aparelho não informa a localização. Escolha na lista.');
    setProcurando(true);
    setAviso('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProcurando(false);
        const perto = cidadeMaisPerto(cidades, pos.coords.latitude, pos.coords.longitude);
        if (perto) escolher(perto.slug);
        else setAviso('Ainda não chegamos perto de você. Escolha uma cidade na lista.');
      },
      () => {
        setProcurando(false);
        setAviso('Sem permissão para a localização. Escolha a cidade na lista.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-5 pt-14 pb-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-[clamp(2.5rem,10vw,3.5rem)] leading-[0.95] font-black tracking-[-0.045em] text-ink">
          Deu fome<span className="text-accent">?</span>
        </h1>
        <p className="text-body text-ink-muted">
          Escolha a sua cidade para ver os restaurantes que entregam aí.
        </p>
      </div>

      <Button
        className="h-target-pdv"
        loading={procurando}
        disabled={!cidades?.length}
        onClick={usarLocalizacao}
      >
        <Icon name="local" size={20} /> Usar minha localização
      </Button>
      <Alert>{aviso}</Alert>

      <section aria-labelledby="t-cidades" className="flex flex-col gap-3">
        <h2 id="t-cidades" className="text-title-section font-black text-ink">
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
                  <span className="text-body-strong text-ink">
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
    </main>
  );
}
