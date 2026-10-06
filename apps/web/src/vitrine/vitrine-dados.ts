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

/** Distância em km entre dois pontos (fórmula de haversine). */
export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const raio = (g: number) => (g * Math.PI) / 180;
  const dLat = raio(lat2 - lat1);
  const dLng = raio(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(raio(lat1)) * Math.cos(raio(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** "850 m" ou "2,3 km". */
export const textoDaDistancia = (km: number) =>
  km < 1
    ? `${Math.max(100, Math.round((km * 1000) / 50) * 50)} m`
    : `${km.toFixed(1).replace('.', ',')} km`;

/** Cidade com lojas mais perto (pelo centro das lojas de cada cidade), até um limite em km. */
export function cidadeMaisPerto(
  cidades: CidadeDaVitrine[],
  lat: number,
  lng: number,
  limiteKm = 80,
): CidadeDaVitrine | null {
  const distancia = (c: CidadeDaVitrine) =>
    c.latitude == null || c.longitude == null
      ? Infinity
      : distanciaKm(lat, lng, c.latitude, c.longitude);
  const ordenadas = [...cidades].sort((a, b) => distancia(a) - distancia(b));
  return ordenadas[0] && distancia(ordenadas[0]) <= limiteKm ? ordenadas[0] : null;
}

// Localização do aparelho (guardada para mostrar a distância de cada loja)
export interface Local {
  lat: number;
  lng: number;
}
const CHAVE_LOCAL = 'usefood.local';
export function localGuardado(): Local | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? 'null') as
      (Local & { em: number }) | null;
    return v && Date.now() - v.em < 6 * 3_600_000 ? { lat: v.lat, lng: v.lng } : null;
  } catch {
    return null;
  }
}
/** Pede a localização ao aparelho e guarda. */
export function pedirLocal(): Promise<Local> {
  return new Promise((ok, falha) => {
    if (!navigator.geolocation) return falha(new Error('sem localização'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const local = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...local, em: Date.now() }));
        } catch {
          // sem armazenamento
        }
        ok(local);
      },
      falha,
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  });
}
/** A pessoa já permitiu a localização antes (então dá para atualizar sem perguntar de novo). */
export async function localPermitido(): Promise<boolean> {
  try {
    return (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted';
  } catch {
    return false;
  }
}

// Favoritos (no aparelho)
const CHAVE_FAVORITOS = 'usefood.favoritos';
export function lerFavoritos(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_FAVORITOS) ?? '[]') as string[];
  } catch {
    return [];
  }
}
export function gravarFavoritos(slugs: string[]): void {
  try {
    localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(slugs));
  } catch {
    // sem armazenamento
  }
}

/** Sem acento e em minúsculas, para a busca. */
export const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
