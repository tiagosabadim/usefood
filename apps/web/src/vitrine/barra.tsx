import { BottomNav, Icon } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { navegar, voltar } from '../rotas';

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

/** Topo das telas do menu do app: seta de voltar e o título. */
export function TopoDoApp({ titulo, cidade }: { titulo: string; cidade: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => voltar(cidade ? `/delivery/${cidade}` : '/delivery')}
          className="flex size-11 shrink-0 items-center justify-center rounded-pill text-ink focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Icon name="voltar" size={22} />
        </button>
        <h1 className="text-title-section font-extrabold tracking-[-0.02em] text-ink">{titulo}</h1>
      </div>
    </header>
  );
}
