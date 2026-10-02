import { StatusScreen, useAppContext } from '@usefood/app';
import { StorePage } from './store-page';

/**
 * Domínio de loja (ranchopasteis.com.br) → a loja na raiz.
 * Domínio de marca (usefood.com.br, guapifood.com.br) → vitrine na raiz e /[loja].
 * O roteador completo entra na E10/E11.
 */
export function App() {
  const { site } = useAppContext();
  if (site.kind === 'loja') return <StorePage slug={site.store} />;

  const slug = window.location.pathname.split('/').filter(Boolean)[0];
  if (slug) return <StorePage slug={slug.toLowerCase()} />;

  return (
    <StatusScreen
      title="Vitrine e lojas"
      description="App usefood, páginas das lojas e cardápio QR. As telas reais chegam a partir da E10."
    />
  );
}
