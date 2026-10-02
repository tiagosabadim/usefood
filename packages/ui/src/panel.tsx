import type { ReactNode } from 'react';
import { cn } from './cn';

export interface PanelProps {
  title?: ReactNode;
  /** Ações à direita do título (botões, contagem). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Liga o título ao bloco para leitores de tela. */
  id?: string;
}

/** Bloco de conteúdo sobre surface, com borda line e cantos radius-lg. Separação por borda, nunca sombra. */
export function Panel({ title, actions, children, className, id }: PanelProps) {
  const tituloId = id ? `${id}-titulo` : undefined;
  return (
    <section
      aria-labelledby={title ? tituloId : undefined}
      className={cn('flex flex-col gap-3 rounded-lg border border-line bg-surface p-5', className)}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 id={tituloId} className="font-display text-title-section text-ink">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
