import { useAppContext } from '@usefood/app';
import { Acompanhar } from './loja/acompanhar';
import { EscolherCidade } from './vitrine/cidades';
import { Favoritos } from './vitrine/favoritos';
import { Vitrine } from './vitrine/vitrine';
import { InicioDaMarca } from './marca/paginas';
import { MinhaConta } from './loja/conta';
import { Loja } from './loja/loja';
import { useCaminho } from './rotas';

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Domínio de loja (ranchopasteis.com.br): a loja na raiz e /pedido/<token>.
 * Domínio de marca (usefood.com.br): vitrine na raiz, /<loja> e /<loja>/pedido/<token>.
 */
export function App() {
  const { site } = useAppContext();
  const partes = useCaminho().split('/').filter(Boolean);

  if (site.kind === 'loja') {
    const [a, token] = partes;
    if (a === 'pedido' && token && TOKEN.test(token))
      return <Acompanhar token={token} voltar="/" />;
    if (a === 'conta') return <MinhaConta base="" />;
    return <Loja slug={site.store} base="" />;
  }

  const [slug, a, token] = partes;
  // /restaurantes e /franquia são páginas estáticas (apps/web/restaurantes, apps/web/franquia);
  // se alguém chegar aqui pelo app, recarrega a página certa
  if (slug === 'restaurantes' || slug === 'franquia' || slug === 'parceiros') {
    window.location.replace(slug === 'parceiros' ? '/franquia' : `/${slug}`);
    return null;
  }
  // App de delivery: escolher a cidade, vitrine da cidade e pedidos/conta
  if (slug === 'delivery') {
    if (!a) return <EscolherCidade />;
    if (a === 'pedidos') return <MinhaConta base="/delivery" modo="pedidos" />;
    if (a === 'conta' || a === 'perfil') return <MinhaConta base="/delivery" modo="perfil" />;
    if (a === 'favoritos') return <Favoritos />;
    return <Vitrine cidade={a.toLowerCase()} />;
  }
  if (slug) {
    const loja = slug.toLowerCase();
    if (a === 'pedido' && token && TOKEN.test(token))
      return <Acompanhar token={token} voltar={`/${loja}`} />;
    if (a === 'conta') return <MinhaConta base={`/${loja}`} />;
    return <Loja slug={loja} base={`/${loja}`} />;
  }

  return <InicioDaMarca />;
}
