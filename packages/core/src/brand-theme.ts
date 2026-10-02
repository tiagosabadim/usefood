/** Os únicos tokens que uma marca pode trocar; todo o resto do visual é igual entre marcas. */
export const BRAND_TOKENS = ['brand', 'brand-ink', 'brand-soft', 'brand-text'] as const;
type BrandToken = (typeof BRAND_TOKENS)[number];
type BrandColors = Partial<Record<BrandToken, string>>;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function pick(value: unknown): BrandColors {
  if (!value || typeof value !== 'object') return {};
  const out: BrandColors = {};
  for (const token of BRAND_TOKENS) {
    const color = (value as Record<string, unknown>)[token];
    // Só cor hexadecimal entra no CSS: o tema vem do banco e pode ter sido digitado por um franqueado.
    if (typeof color === 'string' && HEX.test(color)) out[token] = color.toLowerCase();
  }
  return out;
}

const declarations = (colors: BrandColors) =>
  Object.entries(colors)
    .map(([token, color]) => `--uf-${token}: ${color};`)
    .join(' ');

/**
 * CSS que aplica as cores de uma marca por cima do tema padrão.
 * Aceita `{ light: {...}, dark: {...} }` ou um objeto só (vale para os dois modos).
 * Retorna '' quando não há nada válido para trocar.
 */
export function brandThemeCss(theme: unknown): string {
  const raw = (theme && typeof theme === 'object' ? theme : {}) as Record<string, unknown>;
  const hasModes = 'light' in raw || 'dark' in raw;
  const light = pick(hasModes ? raw.light : raw);
  const dark = { ...light, ...pick(hasModes ? raw.dark : raw) };

  const parts: string[] = [];
  if (Object.keys(light).length) parts.push(`:root { ${declarations(light)} }`);
  if (Object.keys(dark).length) {
    parts.push(
      `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${declarations(dark)} } }`,
      `:root[data-theme='dark'] { ${declarations(dark)} }`,
    );
  }
  return parts.join('\n');
}
