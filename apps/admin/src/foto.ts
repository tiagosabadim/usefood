import { dimensoesReduzidas } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';

const BUCKET = 'cardapio';
const LADO_MAXIMO = 1200;

/** Link público da foto (o bucket é público: o cardápio do cliente lê direto). */
export function urlDaFoto(supabase: AppSupabaseClient, caminho: string | null): string | null {
  return caminho ? supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl : null;
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, 0.85));
}

/** Reduz para no máximo 1200 px e converte para WebP (ou JPG, se o navegador não gerar WebP). */
async function prepararFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height, LADO_MAXIMO);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Este navegador não consegue preparar a foto.');
  contexto.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const webp = await paraBlob(canvas, 'image/webp');
  if (webp?.type === 'image/webp') return webp;
  const jpg = await paraBlob(canvas, 'image/jpeg');
  if (!jpg) throw new Error('Não foi possível preparar a foto.');
  return jpg;
}

/** Envia para <restaurant_id>/<produto>-<data>.webp e devolve o caminho salvo. */
export async function enviarFoto(
  supabase: AppSupabaseClient,
  restaurantId: string,
  productId: string,
  arquivo: File,
): Promise<string> {
  const blob = await prepararFoto(arquivo);
  const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `${restaurantId}/${productId}-${Date.now()}.${extensao}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return caminho;
}

export async function apagarFoto(supabase: AppSupabaseClient, caminho: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([caminho]);
}
