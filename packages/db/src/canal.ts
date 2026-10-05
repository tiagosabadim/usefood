import type { AppSupabaseClient } from './client';

/**
 * Escuta em tempo real com nome único. Duas telas abertas ao mesmo tempo (ou a troca rápida
 * de uma tela para outra) não podem usar o mesmo nome: a biblioteca devolve a escuta que já
 * existe e dá erro ao acrescentar ouvintes depois de assinar.
 */
export function canalUnico(supabase: AppSupabaseClient, nome: string) {
  const sufixo =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return supabase.channel(`${nome}-${sufixo}`);
}
