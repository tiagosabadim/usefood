/**
 * Endereços que nenhuma loja pode usar em usefood.com.br/[loja]: áreas do sistema e rotas.
 * Manter em sincronia com a tabela `reserved_slugs` (supabase/migrations).
 */
export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'ajuda',
  'api',
  'app',
  'apps',
  'assets',
  'blog',
  'busca',
  'buscar',
  'cadastro',
  'cardapio',
  'carrinho',
  'checkout',
  'cidade',
  'cidades',
  'console',
  'conta',
  'cozinha',
  'dashboard',
  'delivery',
  'entrar',
  'franquia',
  'garcom',
  'kds',
  'leads',
  'login',
  'loja',
  'lojas',
  'mesa',
  'minha-conta',
  'painel',
  'para-restaurantes',
  'parceiros',
  'pdv',
  'pedido',
  'pedidos',
  'privacidade',
  'restaurante',
  'restaurantes',
  'sair',
  'static',
  'status',
  'suporte',
  'termos',
  'www',
];

/** 3 a 40 caracteres: letras minúsculas, números e hífen, sem hífen nas pontas. */
const SLUG_FORMAT = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export type SlugCheck = { ok: true } | { ok: false; reason: 'formato' | 'reservado' };

export function checkStoreSlug(slug: string): SlugCheck {
  if (!SLUG_FORMAT.test(slug) || slug.includes('--')) return { ok: false, reason: 'formato' };
  if (RESERVED_SLUGS.includes(slug)) return { ok: false, reason: 'reservado' };
  return { ok: true };
}

/** "Lanchonete do Zé & Cia" → "lanchonete-do-ze-cia" */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}
