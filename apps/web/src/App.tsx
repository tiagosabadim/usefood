import { StatusScreen, useAppContext } from '@usefood/app';
import { Acompanhar } from './loja/acompanhar';
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
  if (slug) {
    const loja = slug.toLowerCase();
    if (a === 'pedido' && token && TOKEN.test(token))
      return <Acompanhar token={token} voltar={`/${loja}`} />;
    if (a === 'conta') return <MinhaConta base={`/${loja}`} />;
    return <Loja slug={loja} base={`/${loja}`} />;
  }

  return (
    <StatusScreen
      title="Vitrine usefood"
      description="As lojas da sua cidade em um só lugar. A vitrine chega no bloco 3; cada loja já tem o seu endereço."
    />
  );
}
