import { cn } from './cn';
import { Icon } from './icon';

export interface ThemeToggleProps {
  /** Tema que está na tela agora. */
  value: 'claro' | 'escuro';
  onChange: (value: 'claro' | 'escuro') => void;
  className?: string;
}

/** Botãozinho de tema: mostra a lua no claro (vai para o escuro) e o sol no escuro (volta para o claro). */
export function ThemeToggle({ value, onChange, className }: ThemeToggleProps) {
  const escuro = value === 'escuro';
  return (
    <button
      type="button"
      onClick={() => onChange(escuro ? 'claro' : 'escuro')}
      aria-label={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      className={cn(
        'flex size-11 items-center justify-center rounded-pill border border-line-strong bg-surface text-ink transition',
        'hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className,
      )}
    >
      <Icon name={escuro ? 'sol' : 'lua'} size={20} />
    </button>
  );
}
