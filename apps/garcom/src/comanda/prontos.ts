import type { AppSupabaseClient } from '@usefood/db';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ProntoParaLevar {
  id: string;
  number: number;
  identifier: string;
  ready_at: string | null;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    variant_name: string | null;
  }[];
}

const JANELA_MS = 6 * 3_600_000;

/**
 * Pedidos de mesa que a cozinha terminou e o garçom precisa levar.
 * Atualiza em tempo real e vibra o celular quando chega um novo.
 */
export function useProntos(supabase: AppSupabaseClient, lojaId: string) {
  const [prontos, setProntos] = useState<ProntoParaLevar[]>([]);
  const conhecidos = useRef<Set<string> | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(
        'id, number, identifier, ready_at, order_items(id, product_name, quantity, variant_name)',
      )
      .eq('restaurant_id', lojaId)
      .eq('identifier_type', 'mesa')
      .eq('status', 'pronto')
      .gte('created_at', new Date(Date.now() - JANELA_MS).toISOString())
      .order('ready_at');
    if (!data) return;
    const ids = new Set(data.map((p) => p.id));
    if (conhecidos.current && [...ids].some((id) => !conhecidos.current!.has(id))) {
      navigator.vibrate?.([200, 100, 200]);
    }
    conhecidos.current = ids;
    setProntos(data);
  }, [supabase, lojaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    const canal = supabase
      .channel(`garcom-prontos-${lojaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${lojaId}` },
        () => {
          void carregar();
        },
      )
      .subscribe();
    const t = setInterval(() => void carregar(), 15_000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(canal);
    };
  }, [supabase, lojaId, carregar]);

  return { prontos, recarregar: carregar };
}
