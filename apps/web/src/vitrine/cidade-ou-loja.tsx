import { useAppContext } from '@usefood/app';
import { useEffect, useState } from 'react';
import { Loja } from '../loja/loja';
import { Vitrine } from './vitrine';
import { cidadeGuardada, esquecerCidade } from './vitrine-dados';

// Cidades da marca: consultadas uma vez por visita e guardadas na memória
let cidadesConhecidas: Set<string> | null = null;
let consulta: Promise<Set<string>> | null = null;

/**
 * /delivery/<nome>: a vitrine, quando é uma cidade com lojas; senão, a loja aberta pelo app
 * (o pedido feito nela fica marcado como vindo do app de delivery). Sempre confere na lista de
 * cidades (nunca pela cidade guardada no aparelho, que pode estar errada).
 */
export function CidadeOuLoja({ nome }: { nome: string }) {
  const { supabase, site } = useAppContext();
  const [eCidade, setECidade] = useState<boolean | null>(() =>
    cidadesConhecidas ? cidadesConhecidas.has(nome) : null,
  );

  useEffect(() => {
    if (eCidade !== null || !supabase) return;
    let ativo = true;
    consulta ??= Promise.resolve(supabase.rpc('vitrine_cidades', { p_marca: site.brand })).then(
      ({ data }) => {
        cidadesConhecidas = new Set((data ?? []).map((c) => c.slug));
        // Cidade guardada que não existe (ex.: nome de loja gravado por engano): esquece
        const guardada = cidadeGuardada();
        if (data && guardada && !cidadesConhecidas.has(guardada)) esquecerCidade();
        return cidadesConhecidas;
      },
    );
    void consulta.then((cidades) => {
      if (ativo) setECidade(cidades.has(nome));
    });
    return () => {
      ativo = false;
    };
  }, [supabase, site.brand, nome, eCidade]);

  if (eCidade === null) {
    return (
      <div
        role="status"
        aria-label="Carregando"
        className="flex min-h-dvh items-center justify-center bg-canvas"
      >
        <span
          aria-hidden="true"
          className="size-10 rounded-pill border-4 border-line border-t-accent motion-safe:animate-spin"
        />
      </div>
    );
  }
  return eCidade ? (
    <Vitrine cidade={nome} />
  ) : (
    <Loja slug={nome} base={`/delivery/${nome}`} noApp />
  );
}
