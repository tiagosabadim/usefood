import { useAppContext } from '@usefood/app';
import { checkStoreSlug } from '@usefood/core';
import { useEffect, useState } from 'react';

type Store =
  | { kind: 'carregando' }
  | { kind: 'encontrada'; name: string }
  | { kind: 'nao-encontrada' }
  | { kind: 'erro'; message: string };

/** Provisória: prova que usefood.com.br/[loja] encontra a loja certa da marca certa. */
export function StorePage({ slug }: { slug: string }) {
  const { brand, supabase } = useAppContext();
  const validSlug = checkStoreSlug(slug).ok;
  const [store, setStore] = useState<Store>(
    validSlug && supabase ? { kind: 'carregando' } : { kind: 'nao-encontrada' },
  );

  useEffect(() => {
    if (!validSlug || !supabase) return;
    let active = true;

    (async () => {
      const brandRow = await supabase.from('brands').select('id').eq('slug', brand).maybeSingle();
      if (brandRow.error) throw brandRow.error;
      if (!brandRow.data) return { kind: 'nao-encontrada' } as const;

      const storeRow = await supabase
        .from('restaurants')
        .select('name')
        .eq('brand_id', brandRow.data.id)
        .eq('slug', slug)
        .maybeSingle();
      if (storeRow.error) throw storeRow.error;
      return storeRow.data
        ? ({ kind: 'encontrada', name: storeRow.data.name } as const)
        : ({ kind: 'nao-encontrada' } as const);
    })()
      .then((result) => active && setStore(result))
      .catch((error: Error) => active && setStore({ kind: 'erro', message: error.message }));

    return () => {
      active = false;
    };
  }, [brand, slug, supabase, validSlug]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-6 py-16">
      <p className="text-caption text-ink-muted">
        {brand} / {slug}
      </p>
      {store.kind === 'carregando' && (
        <p className="text-body text-ink-muted">Procurando a loja…</p>
      )}
      {store.kind === 'encontrada' && (
        <>
          <h1 className="font-display text-display">{store.name}</h1>
          <p className="text-body text-ink-muted">Cardápio e pedidos desta loja chegam na E11.</p>
        </>
      )}
      {store.kind === 'nao-encontrada' && (
        <>
          <h1 className="font-display text-display">Loja não encontrada</h1>
          <p className="text-body text-ink-muted">
            Confira o endereço. Lojas ainda em cadastro só aparecem depois de ativadas.
          </p>
        </>
      )}
      {store.kind === 'erro' && <p>Não foi possível buscar a loja: {store.message}</p>}
    </main>
  );
}
