import { recorteCentral, TAMANHO_DA_FOTO, type Recorte, type Tamanho } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';

const BUCKET = 'cardapio';

export { urlDaFoto } from '@usefood/pedidos';

function paraBlob(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, 0.85));
}

/**
 * Recorta no formato padrão (4:3) e salva em até 1200 × 900, em WebP (ou JPG, se o navegador
 * não gerar WebP). Sem recorte escolhido, usa o centro da foto.
 */
async function prepararFoto(
  fonte: Blob,
  recorte?: Recorte,
  tamanho: Tamanho = TAMANHO_DA_FOTO,
): Promise<Blob> {
  const bitmap = await createImageBitmap(fonte);
  const proporcao = tamanho.largura / tamanho.altura;
  const r = recorte ?? recorteCentral({ largura: bitmap.width, altura: bitmap.height }, proporcao);
  const largura = Math.min(tamanho.largura, Math.round(r.largura));
  const altura = Math.round(largura / proporcao);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Este navegador não consegue preparar a foto.');
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(bitmap, r.x, r.y, r.largura, r.altura, 0, 0, largura, altura);
  bitmap.close();

  const webp = await paraBlob(canvas, 'image/webp');
  if (webp?.type === 'image/webp') return webp;
  const jpg = await paraBlob(canvas, 'image/jpeg');
  if (!jpg) throw new Error('Não foi possível preparar a foto.');
  return jpg;
}

/** Envia para <restaurant_id>/<nome>-<data>.webp, no tamanho pedido, e devolve o caminho salvo. */
export async function enviarImagem(
  supabase: AppSupabaseClient,
  restaurantId: string,
  nome: string,
  fonte: Blob,
  recorte?: Recorte,
  tamanho: Tamanho = TAMANHO_DA_FOTO,
): Promise<string> {
  const blob = await prepararFoto(fonte, recorte, tamanho);
  const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `${restaurantId}/${nome}-${Date.now()}.${extensao}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return caminho;
}

/** Foto de produto (4:3, 1200 × 900). */
export function enviarFoto(
  supabase: AppSupabaseClient,
  restaurantId: string,
  productId: string,
  fonte: Blob,
  recorte?: Recorte,
) {
  return enviarImagem(supabase, restaurantId, productId, fonte, recorte);
}

/** Baixa a foto atual para enquadrar de novo. */
export async function baixarFoto(url: string): Promise<Blob> {
  const resposta = await fetch(url, { cache: 'no-store' });
  if (!resposta.ok) throw new Error('Não foi possível abrir a foto atual.');
  return resposta.blob();
}

export async function apagarFoto(supabase: AppSupabaseClient, caminho: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([caminho]);
}
