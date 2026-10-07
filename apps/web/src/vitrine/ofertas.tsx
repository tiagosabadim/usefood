import { useAppContext } from '@usefood/app';
import { formatarPreco } from '@usefood/core';
import type { Database } from '@usefood/db';
import { urlDaFoto } from '@usefood/pedidos';
import { useEffect, useState } from 'react';
import { navegar } from '../rotas';
import { BarraDoApp, TopoDoApp } from './barra';
import { cidadeGuardada, lembrarVolta } from './vitrine-dados';

export type Oferta = Database['public']['Functions']['vitrine_ofertas']['Returns'][number];

/** Cartão de oferta: foto, desconto, nome, preço da promoção e o antigo riscado, e a loja. */
export function CartaoDeOferta({
  oferta: o,
  onAbrir,
}: {
  oferta: Oferta;
  onAbrir: (slug: string, produtoId: string) => void;
}) {
  const { supabase } = useAppContext();
  const foto = supabase && o.foto_path ? urlDaFoto(supabase, o.foto_path) : null;
  const desconto = Math.round(((o.preco_cents - o.promo_cents) / o.preco_cents) * 100);
  return (
    <button
      type="button"
      onClick={() => onAbrir(o.loja_slug, o.produto_id)}
      className="flex w-full flex-col gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-strong">
        {foto && (
          <img
            src={foto}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <span className="absolute top-2 left-2 rounded-pill bg-brand px-2 py-0.5 text-micro font-black text-brand-ink">
          -{desconto}%
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="line-clamp-1 text-label font-bold text-ink">{o.produto}</span>
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-label font-black text-brand-text tabular-nums">
            {formatarPreco(o.promo_cents)}
          </span>
          <s className="text-micro text-ink-muted tabular-nums">{formatarPreco(o.preco_cents)}</s>
        </span>
        <span className="truncate text-caption text-ink-muted">
          {o.loja_nome}
          {o.loja_aberta ? '' : ' · fechada agora'}
        </span>
      </span>
    </button>
  );
}

/** /delivery/ofertas: produtos em promoção nos restaurantes da cidade. */
export function Ofertas() {
  const { supabase, site } = useAppContext();
  const cidade = cidadeGuardada();
  const [ofertas, setOfertas] = useState<Oferta[] | null>(null);

  useEffect(() => {
    if (!supabase || !cidade) return;
    void supabase
      .rpc('vitrine_ofertas', { p_marca: site.brand, p_cidade: cidade })
      .then(({ data }) => setOfertas(data ?? []));
  }, [supabase, site.brand, cidade]);

  const abrir = (slug: string, produtoId: string) => {
    if (cidade) lembrarVolta(`/delivery/${cidade}`);
    navegar(`/${slug}?produto=${produtoId}`);
  };

  return (
    <div className="min-h-dvh bg-canvas pb-28">
      <TopoDoApp titulo="Ofertas" voltarPara={cidade ? `/delivery/${cidade}` : '/delivery'} />
      <main className="mx-auto w-full max-w-3xl px-5 pt-5">
        {!ofertas ? (
          <div
            role="status"
            aria-label="Carregando as ofertas"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3"
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="aspect-[4/5] rounded-lg bg-surface-strong motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : ofertas.length === 0 ? (
          <div className="flex flex-col gap-2 rounded-lg bg-surface p-6">
            <p className="text-body-strong text-ink">Nenhuma oferta agora.</p>
            <p className="text-body text-ink-muted">
              Quando os restaurantes da cidade colocarem produtos em promoção, eles aparecem aqui.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {ofertas.map((o) => (
              <li key={o.produto_id}>
                <CartaoDeOferta oferta={o} onAbrir={abrir} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <BarraDoApp ativo="ofertas" cidade={cidade} />
    </div>
  );
}
