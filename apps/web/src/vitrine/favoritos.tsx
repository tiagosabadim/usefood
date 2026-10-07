import { useAppContext } from '@usefood/app';
import { rotuloDaCozinha } from '@usefood/core';
import { urlDaFoto } from '@usefood/pedidos';
import { useEffect, useState } from 'react';
import { navegar } from '../rotas';
import { BarraDoApp, TopoDoApp } from './barra';
import { ListaDeLojas } from './vitrine';
import {
  cidadeGuardada,
  gravarFavoritos,
  lembrarVolta,
  lerFavoritos,
  resumoDaEntrega,
  type LojaDaVitrine,
} from './vitrine-dados';

/** /delivery/favoritos: os restaurantes com coração, da cidade escolhida. */
export function Favoritos() {
  const { supabase, site } = useAppContext();
  const cidade = cidadeGuardada();
  const [lojas, setLojas] = useState<LojaDaVitrine[] | null>(null);
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);

  useEffect(() => {
    if (!supabase || !cidade) return;
    void supabase
      .rpc('vitrine_da_cidade', { p_marca: site.brand, p_cidade: cidade })
      .then(({ data }) => setLojas(data ?? []));
  }, [supabase, site.brand, cidade]);

  const alternarFavorito = (slug: string) => {
    const nova = favoritos.includes(slug)
      ? favoritos.filter((s) => s !== slug)
      : [...favoritos, slug];
    setFavoritos(nova);
    gravarFavoritos(nova);
  };
  const minhas = (lojas ?? []).filter((l) => favoritos.includes(l.slug));

  return (
    <div className="min-h-dvh bg-canvas pb-28">
      <TopoDoApp titulo="Favoritos" voltarPara={cidade ? `/delivery/${cidade}` : '/delivery'} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-5">
        {lojas && minhas.length === 0 ? (
          <div className="mx-5 flex flex-col gap-2 rounded-lg bg-surface p-6">
            <p className="text-body-strong text-ink">Nenhum favorito ainda.</p>
            <p className="text-body text-ink-muted">
              Toque no coração de um restaurante para encontrá-lo aqui.
            </p>
          </div>
        ) : (
          <ListaDeLojas
            titulo="Seus restaurantes"
            lojas={minhas}
            favoritos={favoritos}
            alternarFavorito={alternarFavorito}
            abrirLoja={(slug) => {
              if (cidade) lembrarVolta(`/delivery/${cidade}`);
              navegar(`/${slug}`);
            }}
            meta={(l) => l.cozinhas.map(rotuloDaCozinha).join(', ') || 'Restaurante'}
            resumo={(l) => `${l.tempo_min}–${l.tempo_max} min · ${resumoDaEntrega(l)}`}
            foto={(c) => (supabase && c ? (urlDaFoto(supabase, c) ?? undefined) : undefined)}
          />
        )}
      </main>
      <BarraDoApp ativo="favoritos" cidade={cidade} />
    </div>
  );
}
