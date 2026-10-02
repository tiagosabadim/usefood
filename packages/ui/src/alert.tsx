import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'erro' | 'info' | 'sucesso';

const TONS: Record<Tone, string> = {
  erro: 'bg-danger-soft text-danger',
  info: 'bg-brand-soft text-brand-text',
  sucesso: 'bg-success-soft text-success',
};

/** Recado curto sobre o que aconteceu e o que fazer. Erros são anunciados na hora para leitores de tela. */
export function Alert({
  tone = 'erro',
  children,
  className,
}: {
  tone?: Tone;
  children?: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role={tone === 'erro' ? 'alert' : 'status'}
      className={cn('rounded-md px-4 py-3 text-body', TONS[tone], className)}
    >
      {children}
    </p>
  );
}
