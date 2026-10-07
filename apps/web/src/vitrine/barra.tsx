import { BottomNav } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { navegar } from '../rotas';

type Aba = 'inicio' | 'pedidos' | 'favoritos' | 'ofertas' | 'perfil';

/** Barra de baixo do app (BottomNav do design system): Início, Pedidos, Favoritos, Ofertas e Minha conta. */
export function BarraDoApp({ ativo, cidade }: { ativo: Aba; cidade: string | null }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto w-full max-w-3xl">
        <BottomNav
          label="App"
          onNavigate={(href) => navegar(href)}
          items={[
            {
              label: 'Início',
              icon: 'inicio',
              href: cidade ? `/delivery/${cidade}` : '/delivery',
              current: ativo === 'inicio',
            },
            {
              label: 'Pedidos',
              icon: 'pedidos',
              href: '/delivery/pedidos',
              current: ativo === 'pedidos',
            },
            {
              label: 'Favoritos',
              icon: 'coracao',
              href: '/delivery/favoritos',
              current: ativo === 'favoritos',
            },
            {
              label: 'Ofertas',
              icon: 'ofertas',
              href: '/delivery/ofertas',
              current: ativo === 'ofertas',
            },
            {
              label: 'Minha conta',
              icon: 'perfil',
              href: '/delivery/conta',
              current: ativo === 'perfil',
            },
          ]}
        />
      </div>
    </div>
  );
}

interface EventoDeInstalar extends Event {
  prompt: () => Promise<void>;
}

/** "Instalar app" aparece quando o navegador permite (Android e computador). */
export function useInstalar(): (() => void) | null {
  const [evento, setEvento] = useState<EventoDeInstalar | null>(null);
  useEffect(() => {
    const guardar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoDeInstalar);
    };
    window.addEventListener('beforeinstallprompt', guardar);
    return () => window.removeEventListener('beforeinstallprompt', guardar);
  }, []);
  return evento
    ? () => {
        void evento.prompt();
        setEvento(null);
      }
    : null;
}
