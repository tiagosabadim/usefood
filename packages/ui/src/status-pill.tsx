import type { ReactNode } from 'react';
import { cn } from './cn';

export type StatusTone = 'sucesso' | 'neutro' | 'destaque' | 'erro';

const TONS: Record<StatusTone, string> = {
  sucesso: 'bg-success-soft text-success',
  neutro: 'bg-surface-strong text-ink-muted',
  destaque: 'bg-sun text-sun-ink',
  erro: 'bg-danger-soft text-danger',
};

/** Estado em uma ou duas palavras: Aberto, Pausado, Pago, Novidade. Nunca só a cor: sempre com texto. */
export function StatusPill({
  tone = 'neutro',
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-pill px-3 py-1 text-micro',
        TONS[tone],
      )}
    >
      {children}
    </span>
  );
}
