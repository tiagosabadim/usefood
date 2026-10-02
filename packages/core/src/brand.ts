/** Marca usada quando o domínio não pertence a nenhuma marca conhecida. */
export const DEFAULT_BRAND = 'usefood';

/** Mapa hostname → slug da marca (espelha a tabela brand_domains). */
export type BrandDomainMap = Readonly<Record<string, string>>;

/** Remove porta, `www.` e maiúsculas: `WWW.GuapiFood.com.br:443` → `guapifood.com.br`. */
export function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');
}

/**
 * Descobre a marca pelo domínio acessado.
 *
 * 1. Domínio cadastrado em `domains` (produção: guapifood.com.br).
 * 2. Subdomínio de `.localhost` em desenvolvimento (guapifood.localhost).
 * 3. Qualquer outro caso (preview do Netlify, IP) cai na marca padrão.
 */
export function resolveBrandFromHost(
  host: string,
  domains: BrandDomainMap = {},
  fallback: string = DEFAULT_BRAND,
): string {
  const normalized = normalizeHost(host);
  const known = domains[normalized];
  if (known) return known;

  if (normalized.endsWith('.localhost')) {
    const label = normalized.slice(0, -'.localhost'.length).split('.').pop();
    if (label) return label;
  }

  return fallback;
}
