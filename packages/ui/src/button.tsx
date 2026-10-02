import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:brightness-95',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-strong',
  ghost: 'text-ink hover:bg-surface',
  danger: 'bg-danger text-canvas hover:brightness-95',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Mostra que a ação está em andamento e impede clique duplo. */
  loading?: boolean;
}

/** Alvo de toque de 48 px (target-control); cantos radius-md. */
export function Button({
  variant = 'primary',
  loading = false,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex min-h-target-control items-center justify-center gap-2 rounded-md px-5 text-label',
        'transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading ? 'Aguarde…' : children}
    </button>
  );
}
