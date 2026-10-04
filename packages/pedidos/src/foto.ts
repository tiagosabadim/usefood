import type { AppSupabaseClient } from '@usefood/db';

/** Link público da foto do produto (o bucket "cardapio" é público). */
export function urlDaFoto(supabase: AppSupabaseClient, caminho: string | null): string | null {
  return caminho ? supabase.storage.from('cardapio').getPublicUrl(caminho).data.publicUrl : null;
}
