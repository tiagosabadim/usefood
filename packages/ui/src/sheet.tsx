import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './icon';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Ações fixas no rodapé (Salvar, Cancelar). */
  footer?: ReactNode;
}

/**
 * Painel lateral para editar sem sair da tela (editar produto).
 * Usa o <dialog> nativo: foco preso dentro, Esc fecha, o fundo fica inerte.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (open && !dialogo.open) dialogo.showModal();
    if (!open && dialogo.open) dialogo.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      onClose={onClose}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-lg overflow-hidden border-l border-line bg-canvas p-0 text-ink backdrop:bg-ink/40 sm:rounded-l-lg"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
          <h2 id={tituloId} className="font-display text-title-section text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Icon name="fechar" />
          </button>
        </header>
        <div
          className={cn(
            'flex flex-1 flex-col gap-6 overflow-y-auto px-6 pt-5',
            footer ? 'pb-5' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          )}
        >
          {children}
        </div>
        {footer && (
          <footer className="border-t border-line bg-surface px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
