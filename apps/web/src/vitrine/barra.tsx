import { Icon, cn } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { navegar } from '../rotas';

/** Barra de baixo do app: Restaurantes e Pedidos. */
export function BarraDoApp({
  ativo,
  cidade,
}: {
  ativo: 'restaurantes' | 'pedidos';
  cidade: string | null;
}) {
  const item = (
    id: 'restaurantes' | 'pedidos',
    rotulo: string,
    icone: 'inicio' | 'pedidos',
    destino: string,
  ) => (
    <button
      type="button"
      onClick={() => navegar(destino)}
      aria-current={ativo === id ? 'page' : undefined}
      className={cn(
        'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-micro font-bold',
        ativo === id ? 'text-brand-text' : 'text-ink-muted',
      )}
    >
      <Icon name={icone} size={22} />
      {rotulo}
    </button>
  );
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex w-full max-w-3xl">
        {item(
          'restaurantes',
          'Restaurantes',
          'inicio',
          cidade ? `/delivery/${cidade}` : '/delivery',
        )}
        {item('pedidos', 'Pedidos', 'pedidos', '/delivery/conta')}
      </div>
    </nav>
  );
}

interface EventoDeInstalar extends Event {
  prompt: () => Promise<void>;
}

/** "Instalar app" aparece quando o navegador permite (Android e computador). */
export function BotaoInstalar() {
  const [evento, setEvento] = useState<EventoDeInstalar | null>(null);
  useEffect(() => {
    const guardar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoDeInstalar);
    };
    window.addEventListener('beforeinstallprompt', guardar);
    return () => window.removeEventListener('beforeinstallprompt', guardar);
  }, []);
  if (!evento) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void evento.prompt();
        setEvento(null);
      }}
      className="inline-flex h-10 items-center gap-2 rounded-pill border border-line-strong px-4 text-label font-bold text-ink"
    >
      <Icon name="mais" size={18} /> Instalar app
    </button>
  );
}
