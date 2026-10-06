import { formatarPreco } from '@usefood/core';
import type { Database } from '@usefood/db';

export type LojaDaVitrine = Database['public']['Functions']['vitrine_da_cidade']['Returns'][number];
export type CidadeDaVitrine = Database['public']['Functions']['vitrine_cidades']['Returns'][number];
export type PratoEncontrado = Database['public']['Functions']['vitrine_buscar']['Returns'][number];

const CHAVE_CIDADE = 'usefood.cidade';
const CHAVE_VOLTAR = 'usefood.voltar';

export function cidadeGuardada(): string | null {
  try {
    return localStorage.getItem(CHAVE_CIDADE);
  } catch {
    return null;
  }
}
export function guardarCidade(slug: string): void {
  try {
    localStorage.setItem(CHAVE_CIDADE, slug);
  } catch {
    // sem armazenamento: só nesta visita
  }
}

/** A loja mostra "voltar para os restaurantes" quando o cliente veio da vitrine. */
export function lembrarVolta(caminho: string): void {
  try {
    sessionStorage.setItem(CHAVE_VOLTAR, caminho);
  } catch {
    // sem armazenamento
  }
}
export function voltaParaVitrine(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_VOLTAR);
  } catch {
    return null;
  }
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "Abre hoje às 18:00", "Abre amanhã às 11:00", "Abre quinta às 18:00" ou "Fechada". */
export function quandoAbre(
  l: Pick<LojaDaVitrine, 'abre_em_dias' | 'abre_as'>,
  hoje = new Date(),
): string {
  if (l.abre_em_dias == null || !l.abre_as) return 'Fechada';
  const hora = l.abre_as.slice(0, 5);
  if (l.abre_em_dias === 0) return `Abre hoje às ${hora}`;
  if (l.abre_em_dias === 1) return `Abre amanhã às ${hora}`;
  return `Abre ${DIAS[(hoje.getDay() + l.abre_em_dias) % 7]} às ${hora}`;
}

/** "Entrega grátis", "Entrega a partir de R$ 5,00" ou "Só retirada". */
export function resumoDaEntrega(
  l: Pick<LojaDaVitrine, 'entrega' | 'taxa_modo' | 'taxa_minima_cents'>,
): string {
  if (!l.entrega) return 'Só retirada';
  if (l.taxa_modo === 'gratis' || l.taxa_minima_cents === 0) return 'Entrega grátis';
  if (l.taxa_minima_cents == null) return 'Entrega com taxa';
  return `Entrega a partir de ${formatarPreco(l.taxa_minima_cents)}`;
}

/** Cidade com lojas mais perto de onde a pessoa está (pelo centro das lojas de cada cidade). */
export function cidadeMaisPerto(
  cidades: CidadeDaVitrine[],
  lat: number,
  lng: number,
): CidadeDaVitrine | null {
  const raio = (g: number) => (g * Math.PI) / 180;
  const distancia = (c: CidadeDaVitrine) => {
    if (c.latitude == null || c.longitude == null) return Infinity;
    const dLat = raio(c.latitude - lat);
    const dLng = raio(c.longitude - lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(raio(lat)) * Math.cos(raio(c.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  };
  const ordenadas = [...cidades].sort((a, b) => distancia(a) - distancia(b));
  return ordenadas[0] && distancia(ordenadas[0]) < Infinity ? ordenadas[0] : null;
}

/** Sem acento e em minúsculas, para a busca. */
export const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
