import { DEFAULT_BRAND, normalizeHost, resolveBrandFromHost } from './brand';

/** O que o domínio acessado representa. */
export type Site =
  { kind: 'marca'; brand: string } | { kind: 'loja'; brand: string; store: string };

/** Resposta da função `resolver_dominio` do banco (null quando o domínio não está cadastrado). */
export interface DomainRecord {
  kind: 'marca' | 'loja';
  brand_slug: string;
  restaurant_slug: string | null;
}

/**
 * Decide o site a partir do domínio:
 * 1. domínio cadastrado e ativo no banco (vitrine de marca ou loja direta);
 * 2. subdomínio de .localhost em desenvolvimento (guapifood.localhost);
 * 3. marca padrão (previews do Netlify, IPs, domínios ainda não conectados).
 */
export function resolveSite(host: string, record: DomainRecord | null): Site {
  if (record?.kind === 'loja' && record.restaurant_slug) {
    return { kind: 'loja', brand: record.brand_slug, store: record.restaurant_slug };
  }
  if (record) return { kind: 'marca', brand: record.brand_slug };
  return { kind: 'marca', brand: resolveBrandFromHost(normalizeHost(host), {}, DEFAULT_BRAND) };
}
